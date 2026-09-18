/* =========================================================
   FRALLAN, liten worker
   Tar emot dagens läge från appen, håller engångsuppgifter som
   föräldrapanelen lägger till, och svarar med en lägesbild i samma
   form som de andra apparna. Inga notiser än, men prenumerationen
   kan tas emot redan nu.
   ========================================================= */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key"
};

const SUBSCRIPTION_KEY = "subscription";
const STATE_KEY = "state";
const HISTORY_PREFIX = "history:";
const EXTRA_PREFIX = "extra:";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" }
  });
}

// Svensk lokaltid, så dygnet bryts när Olle sover och inte mitt på dagen.
function stockholmParts(date) {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10)
  };
}

// Allt under /admin kräver nyckeln, om den är satt. Appens egna anrop är öppna.
function adminKeyOk(request, url, env) {
  if (!env.ADMIN_TOKEN) return true;
  const given = request.headers.get("X-Admin-Key") || url.searchParams.get("key") || "";
  return given === env.ADMIN_TOKEN;
}

async function readExtras(env, dateStr) {
  const raw = await env.PUSH_KV.get(EXTRA_PREFIX + dateStr);
  const list = raw ? JSON.parse(raw) : [];
  return Array.isArray(list) ? list : [];
}

async function writeExtras(env, dateStr, list) {
  await env.PUSH_KV.put(EXTRA_PREFIX + dateStr, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 60 });
}

async function mergeHistory(env, dateStr, patch) {
  const raw = await env.PUSH_KV.get(HISTORY_PREFIX + dateStr);
  const existing = raw ? JSON.parse(raw) : {};
  const merged = { ...existing, ...patch };
  await env.PUSH_KV.put(HISTORY_PREFIX + dateStr, JSON.stringify(merged));
  return merged;
}

const HUNGER_DECAY_PER_HOUR = 6; // samma takt som appen räknar med
const HAPPINESS_DECAY_PER_HOUR = 3;

async function buildSummary(env) {
  const now = new Date();
  const { dateStr } = stockholmParts(now);
  const subRaw = await env.PUSH_KV.get(SUBSCRIPTION_KEY);
  const stateRaw = await env.PUSH_KV.get(STATE_KEY);
  const state = stateRaw ? JSON.parse(stateRaw) : null;
  const todayRaw = await env.PUSH_KV.get(HISTORY_PREFIX + dateStr);
  const today = todayRaw ? JSON.parse(todayRaw) : null;
  const tasks = today && Array.isArray(today.tasks) ? today.tasks : [];

  // appen räknar ner hunger och humör i telefonen, servern hör bara av sig vid synk
  const timmarSedanSynk = state && state.lastSyncAt ? (now - new Date(state.lastSyncAt)) / 3600000 : null;
  const uppskatta = (varde, takt) =>
    typeof varde === "number" && timmarSedanSynk !== null
      ? Math.max(10, Math.round(varde - timmarSedanSynk * takt))
      : null;

  const history = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = stockholmParts(d).dateStr;
    const raw = await env.PUSH_KV.get(HISTORY_PREFIX + key);
    const rec = raw ? JSON.parse(raw) : null;
    const recTasks = rec && Array.isArray(rec.tasks) ? rec.tasks : [];
    history.push({
      date: key,
      done: recTasks.filter((t) => t.done).length,
      total: recTasks.length,
      allDone: !!(rec && rec.allDoneToday)
    });
  }

  return {
    app: "frallan",
    title: "Frallan",
    child: "Olle",
    now: now.toISOString(),
    dateStr,
    notifications: !!subRaw,
    lastSyncAt: state ? state.lastSyncAt : null,
    lastNagAt: null,
    allDoneToday: !!(state && state.allDoneToday),
    hunger: uppskatta(state && state.hunger, HUNGER_DECAY_PER_HOUR),
    happiness: uppskatta(state && state.happiness, HAPPINESS_DECAY_PER_HOUR),
    hungerAtSync: state && typeof state.hunger === "number" ? state.hunger : null,
    happinessAtSync: state && typeof state.happiness === "number" ? state.happiness : null,
    hoursSinceSync: timmarSedanSynk === null ? null : Math.round(timmarSedanSynk * 10) / 10,
    level: state && typeof state.level === "number" ? state.level : null,
    streak: state && typeof state.streak === "number" ? state.streak : null,
    petName: state && state.petName ? state.petName : null,
    doneToday: tasks.filter((t) => t.done).length,
    totalToday: tasks.length,
    tasks,
    remindersSentToday: [],
    supportsExtra: true,
    extra: await readExtras(env, dateStr),
    affirmation: null,
    history
  };
}

function csvEscape(value) {
  const s = String(value);
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Kolumnerna byggs av de uppgifter som faktiskt förekommer, så rapporten
// följer med när uppgiftslistan i appen ändras.
async function buildReportCsv(env) {
  const records = {};
  let cursor;
  do {
    const page = await env.PUSH_KV.list({ prefix: HISTORY_PREFIX, cursor });
    for (const key of page.keys) {
      const raw = await env.PUSH_KV.get(key.name);
      if (raw) records[key.name.slice(HISTORY_PREFIX.length)] = JSON.parse(raw);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const kolumner = [];
  Object.values(records).forEach((rec) =>
    (rec.tasks || []).forEach((t) => {
      if (!kolumner.some((k) => k.id === t.id)) kolumner.push({ id: t.id, label: t.text || t.id });
    })
  );

  const veckodagar = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
  const rows = [["Datum", "Veckodag", ...kolumner.map((k) => k.label), "Allt klart den dagen"]];

  Object.keys(records)
    .sort()
    .forEach((dateStr) => {
      const rec = records[dateStr];
      const per = Object.fromEntries((rec.tasks || []).map((t) => [t.id, t]));
      const rad = [dateStr, veckodagar[new Date(dateStr + "T12:00:00Z").getUTCDay()]];
      kolumner.forEach((k) => rad.push(per[k.id] ? (per[k.id].done ? "Ja" : "Nej") : "–"));
      rad.push(rec.allDoneToday ? "Ja" : "Nej");
      rows.push(rad);
    });

  return new Response("﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n"), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="frallan-rapport.csv"'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    if (path === "/subscribe" && request.method === "POST") {
      await env.PUSH_KV.put(SUBSCRIPTION_KEY, JSON.stringify(await request.json()));
      return json({ ok: true });
    }

    if (path === "/unsubscribe" && request.method === "POST") {
      await env.PUSH_KV.delete(SUBSCRIPTION_KEY);
      return json({ ok: true });
    }

    if (path === "/sync" && request.method === "POST") {
      const body = await request.json();
      const { dateStr } = stockholmParts(new Date());
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      await env.PUSH_KV.put(
        STATE_KEY,
        JSON.stringify({
          lastSyncAt: new Date().toISOString(),
          lastSyncDateStr: dateStr,
          allDoneToday: !!body.allDoneToday,
          hunger: typeof body.hunger === "number" ? body.hunger : null,
          happiness: typeof body.happiness === "number" ? body.happiness : null,
          level: typeof body.level === "number" ? body.level : null,
          streak: typeof body.streak === "number" ? body.streak : null,
          petName: typeof body.petName === "string" ? body.petName : null
        })
      );
      await mergeHistory(env, dateStr, {
        tasks,
        allDoneToday: !!body.allDoneToday,
        updatedAt: new Date().toISOString()
      });
      return json({ ok: true });
    }

    if (path === "/extra" && request.method === "GET") {
      const dateStr = url.searchParams.get("date") || stockholmParts(new Date()).dateStr;
      return json({ date: dateStr, tasks: await readExtras(env, dateStr) });
    }

    if ((path.startsWith("/admin") || path === "/report") && !adminKeyOk(request, url, env)) {
      return text("Fel eller saknad nyckel. Lägg till ?key=... i adressen.", 401);
    }

    if (path === "/report" && request.method === "GET") return buildReportCsv(env);

    if (path === "/admin/summary" && request.method === "GET") {
      return json(await buildSummary(env));
    }

    if (path === "/admin/extra" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const innehall = (body.text || "").trim();
      if (!innehall) return json({ ok: false, error: "ingen text" }, 400);
      const dateStr = body.date || stockholmParts(new Date()).dateStr;
      const list = await readExtras(env, dateStr);
      const task = {
        id: "extra-" + dateStr + "-" + Math.random().toString(36).slice(2, 8),
        emoji: (body.emoji || "⭐").slice(0, 4),
        text: innehall.slice(0, 80),
        reward: ["food", "love", "both"].includes(body.gives) ? body.gives : "both",
        section: body.section || "eftermiddag",
        date: dateStr
      };
      list.push(task);
      await writeExtras(env, dateStr, list);
      return json({ ok: true, task, tasks: list });
    }

    if (path === "/admin/extra/delete" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const dateStr = body.date || stockholmParts(new Date()).dateStr;
      const list = (await readExtras(env, dateStr)).filter((t) => t.id !== body.id);
      await writeExtras(env, dateStr, list);
      return json({ ok: true, tasks: list });
    }

    if (path === "/admin/status" && request.method === "GET") {
      const { dateStr, minutesOfDay } = stockholmParts(new Date());
      const subRaw = await env.PUSH_KV.get(SUBSCRIPTION_KEY);
      const stateRaw = await env.PUSH_KV.get(STATE_KEY);
      return text(
        [
          "=== Frallan status ===",
          "",
          `Prenumeration finns: ${subRaw ? "JA" : "NEJ (appen har ingen notisknapp än)"}`,
          `Svensk lokaltid nu: ${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")} (${dateStr})`,
          "",
          `Sync-status: ${stateRaw || "appen har aldrig synkat"}`,
          `Extrauppgifter idag: ${JSON.stringify(await readExtras(env, dateStr))}`
        ].join("\n")
      );
    }

    if (path === "/" || path === "") return text("Frallan worker is running");

    return json({ error: "not found" }, 404);
  }
};
