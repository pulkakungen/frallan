"use strict";

/* =========================================================
   FRALLAN – kawaii uppgifts-app med kiwifågel & räv
   Målgrupp: Olle, snart 7 år, läser inte så bra än.
   Därför: max tre korta ord per text, inga bisatser, stora
   emoji och en högtalarknapp som läser upp uppgiften.
   ========================================================= */

const DEMO_MODE = new URLSearchParams(location.search).get("demo") === "1";
const STORAGE_KEY = DEMO_MODE ? "frallan_demo_state_v1" : "frallan_state_v1";

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("sw.js");
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------------------
   Djuren
   --------------------------------------------------------- */
// Maten följer djuret: kiwifågeln äter larver, räven äter möss.
const PETS = {
  kiwi: {
    label: "Kiwi",
    foodEmoji: "🐛",
    foodWord: "larv",
    names: ["Kiwi", "Nappe", "Pippi"],
    hungryBubbles: ["Jag vill ha en larv 🐛", "Larv, tack! 🥺"],
    foodMessages: ["Mums! 🐛", "Gott! 😋", "Tack! 💚"]
  },
  fox: {
    label: "Räv",
    foodEmoji: "🐭",
    foodWord: "mus",
    names: ["Rufus", "Luring", "Svansen"],
    hungryBubbles: ["Jag vill ha en mus 🐭", "Mus, tack! 🥺"],
    foodMessages: ["Mums! 🐭", "Gott! 😋", "Tack! 🧡"]
  }
};

function petCfg() {
  return PETS[state.petType] || PETS.kiwi;
}

/* ---------------------------------------------------------
   Uppgifter
   --------------------------------------------------------- */
// days: veckodagar (0=söndag ... 6=lördag). Ingen lista = varje dag.
const DAG_MAN = 1, DAG_TIS = 2, DAG_ONS = 3, DAG_TORS = 4, DAG_FRE = 5, DAG_LOR = 6, DAG_SON = 0;
const VARDAGAR = [DAG_MAN, DAG_TIS, DAG_ONS, DAG_TORS, DAG_FRE];

const TASK_SECTIONS = [
  {
    id: "morgon",
    emoji: "🌅",
    title: "Morgon",
    tasks: [
      { id: "vakna", emoji: "☀️", text: "Vakna" },
      { id: "klader", emoji: "👕", text: "Ta på kläder" },
      { id: "frukost", emoji: "🥣", text: "Ät frukost" },
      { id: "tander-morgon", emoji: "🪥", text: "Borsta tänder" },
      { id: "frukt", emoji: "🍎", text: "Packa frukt" },
      { id: "gympa", emoji: "🩳", text: "Ta med gympakläder", days: [DAG_TIS, DAG_TORS] },
      { id: "vaska", emoji: "🎒", text: "Ta väskan" },
      { id: "skolan", emoji: "🏫", text: "Gå till skolan", days: VARDAGAR }
    ]
  },
  {
    id: "eftermiddag",
    emoji: "🌤️",
    title: "Eftermiddag",
    tasks: [
      { id: "gaby", emoji: "🧸", text: "Plocka Gabys saker" },
      { id: "lego", emoji: "🧱", text: "Ta undan lego" },
      { id: "magneter", emoji: "🧲", text: "Ta undan magneter" },
      { id: "bilar", emoji: "🚗", text: "Ta undan bilarna" },
      { id: "tvatt", emoji: "🧺", text: "Tvätt i korgen" },
      { id: "besticken", emoji: "🍴", text: "Töm besticken" },
      { id: "duka", emoji: "🍽️", text: "Duka" },
      { id: "laslaxa", emoji: "📖", text: "Gör läsläxan" },
      { id: "lordagsgodis", emoji: "🍬", text: "Handla lördagsgodis", days: [DAG_LOR] }
    ]
  },
  {
    id: "kvall",
    emoji: "🌙",
    title: "Kväll",
    tasks: [
      { id: "duscha", emoji: "🚿", text: "Duscha", days: [DAG_ONS, DAG_FRE] },
      { id: "tander-kvall", emoji: "🪥", text: "Borsta tänder" },
      { id: "packa-vaska", emoji: "🎒", text: "Packa skolväskan" },
      { id: "saga", emoji: "📚", text: "Läs en saga" },
      { id: "sova", emoji: "😴", text: "Sova gott" }
    ]
  }
];

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - start) / 86400000) + 1;
}

// task.days: bara vissa veckodagar. task.parity: "even"/"odd" ger varannan dag.
function isTaskActiveOnDate(task, date) {
  if (task.days && !task.days.includes(date.getDay())) return false;
  if (task.parity) {
    const isEven = dayOfYear(date) % 2 === 0;
    if (task.parity === "even" && !isEven) return false;
    if (task.parity === "odd" && isEven) return false;
  }
  return true;
}
function activeTasksForSection(section, date) {
  const d = date === undefined ? new Date() : date;
  return section.tasks.filter((t) => isTaskActiveOnDate(t, d));
}
function totalTasksForDate(date) {
  return TASK_SECTIONS.reduce((s, sec) => s + activeTasksForSection(sec, date).length, 0);
}
function totalTasksToday() {
  return totalTasksForDate(new Date());
}

const XP_PER_TASK = 10;
const FOOD_PER_TASK = 1;
const LOVE_PER_TASK = 1;
const MAX_FOOD = 4;
const MAX_LOVE = 4;

// Snabbare nivåer än i Sassibrass: en sjuåring behöver se att det händer saker.
function xpToNext(level) {
  return 100 + (level - 1) * 40;
}

/* ---------------------------------------------------------
   Korta peppmeddelanden
   --------------------------------------------------------- */
const TASK_MESSAGES = [
  "Bra jobbat! 🎉",
  "Så duktig! ⭐",
  "Wow! 🌟",
  "Toppen! 👏",
  "Du är bäst! 💚",
  "Ja! 🎊",
  "Snyggt! ✨",
  "Grymt! 🔥",
  "Perfekt! 🏅",
  "Heja dig! 💪"
];

const SECTION_COMPLETE_MESSAGES = ["Hela listan klar! 🎉", "Allt klart! 🏆", "Woho! 🎊"];
const ALL_DONE_MESSAGES = ["Hela dagen klar! 🏆", "Du klarade allt! 🌟", "Bäst i hela världen! 👑"];
const LEVEL_UP_MESSAGES = ["Ny nivå! 🆙", "Du gick upp! 🌟", "Ditt djur blev starkare! 💪"];
const LOVE_MESSAGES = ["Kram! 🤗", "Jag gillar dig! 💚", "Mysigt! 💛"];

const GREETING_MORNING = ["God morgon! ☀️", "Hej! Ny dag! 🌅"];
const GREETING_AFTERNOON = ["Hej igen! 🌳", "Hur går det? 🦊"];
const GREETING_EVENING = ["God kväll! 🌙", "Snart natt! ✨"];

const LOW_HAPPINESS_BUBBLE = ["Jag vill ha en kram 🤗", "Klappa mig! 🥺"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isConsecutiveDay(prevStr, curStr) {
  if (!prevStr) return false;
  const prev = new Date(prevStr + "T00:00:00");
  const cur = new Date(curStr + "T00:00:00");
  return Math.round((cur - prev) / 86400000) === 1;
}

/* ---------------------------------------------------------
   Uppläsning – Olle läser inte så bra, så appen får läsa högt
   --------------------------------------------------------- */
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "sv-SE";
    utter.rate = 0.9;
    const svVoice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("sv"));
    if (svVoice) utter.voice = svVoice;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    /* uppläsning är en bonus, aldrig ett krav */
  }
}

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */
function defaultState() {
  return {
    petType: null,
    petName: "",
    level: 1,
    xp: 0,
    food: 2,
    love: 2,
    hunger: 80,
    happiness: 80,
    lastStatDecayAt: null,
    hasBaby: false,
    babyName: "",
    babyLevel: 20,
    streak: 0,
    lastActiveDate: null,
    completedToday: {},
    rewardedToday: {},
    totalCompleted: 0,
    sectionsCollapsed: {},
    history: {}
  };
}

// Demoläget fyller på med ett färdigt djur och en veckas historik, så appen
// går att visa upp utan att röra Olles riktiga sparning.
function seedDemoState() {
  const s = defaultState();
  s.petType = "fox";
  s.petName = "Rufus";
  s.level = 7;
  s.xp = 120;
  s.food = 3;
  s.love = 3;
  s.hunger = 72;
  s.happiness = 88;
  s.streak = 4;
  s.totalCompleted = 61;
  s.lastActiveDate = todayStr();
  s.lastStatDecayAt = new Date().toISOString();

  const today = new Date();
  for (let back = 6; back >= 0; back--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const tasks = [];
    TASK_SECTIONS.forEach((section) => {
      activeTasksForSection(section, d).forEach((t, i) => {
        // äldre dagar är nästan helt klara, dagens är halvvägs
        const done = back === 0 ? i % 2 === 0 : back % 4 !== 0 || i % 5 !== 0;
        tasks.push({ id: t.id, text: t.text, done });
      });
    });
    const done = tasks.filter((t) => t.done).length;
    s.history[key] = { tasks, done, total: tasks.length, allDone: done === tasks.length };
    if (back === 0) tasks.forEach((t) => { if (t.done) s.completedToday[t.id] = true; });
  }
  return s;
}

let state = loadState();
if (DEMO_MODE && !state.petType) {
  state = seedDemoState();
  saveState();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Historiken är underlaget för rapporten. En post per dag, med alla
// uppgifter som gällde just den dagen och om de blev gjorda.
const HISTORY_MAX_DAYS = 400;

function recordToday() {
  const tasks = [];
  TASK_SECTIONS.forEach((section) => {
    activeTasksForSection(section).forEach((t) => {
      tasks.push({ id: t.id, text: t.text, done: !!state.completedToday[t.id] });
    });
  });
  const done = tasks.filter((t) => t.done).length;
  state.history[todayStr()] = { tasks, done, total: tasks.length, allDone: tasks.length > 0 && done === tasks.length };

  const dates = Object.keys(state.history).sort();
  while (dates.length > HISTORY_MAX_DAYS) delete state.history[dates.shift()];
  saveState();
}

function handleDailyReset() {
  const today = todayStr();
  if (state.lastActiveDate === today) return;

  if (state.lastActiveDate) {
    const completedCount = Object.keys(state.completedToday).length;
    const wasFullDay = completedCount >= totalTasksForDate(new Date(state.lastActiveDate + "T00:00:00"));
    const consecutive = isConsecutiveDay(state.lastActiveDate, today);

    if (wasFullDay && (consecutive || state.streak === 0)) {
      state.streak += 1;
    } else if (!consecutive || !wasFullDay) {
      state.streak = 0;
    }
  }

  state.completedToday = {};
  state.rewardedToday = {};
  state.lastActiveDate = today;
  saveState();
}

const HUNGER_DECAY_PER_HOUR = 4;
const HAPPINESS_DECAY_PER_HOUR = 3;

// Hunger och humör sjunker med verklig förfluten tid, inte en gång per dygn.
function applyStatDecay() {
  const now = new Date();
  if (!state.lastStatDecayAt) {
    state.lastStatDecayAt = now.toISOString();
    saveState();
    return;
  }
  const hoursElapsed = (now - new Date(state.lastStatDecayAt)) / (60 * 60 * 1000);
  if (hoursElapsed < 0.1) return;

  state.hunger = Math.round(clamp(state.hunger - hoursElapsed * HUNGER_DECAY_PER_HOUR, 10, 100));
  state.happiness = Math.round(clamp(state.happiness - hoursElapsed * HAPPINESS_DECAY_PER_HOUR, 10, 100));
  state.lastStatDecayAt = now.toISOString();
  saveState();
}

/* ---------------------------------------------------------
   Djur-SVG (kawaii)
   --------------------------------------------------------- */
function eyesMarkup(mood, cx1, cx2, cy) {
  if (mood === "love") {
    const heart = (cx) => `
      <path d="M${cx} ${cy + 6} C${cx - 8} ${cy - 4}, ${cx - 2} ${cy - 12}, ${cx} ${cy - 6}
               C${cx + 2} ${cy - 12}, ${cx + 8} ${cy - 4}, ${cx} ${cy + 6} Z" fill="#ff6f9c"/>`;
    return heart(cx1) + heart(cx2);
  }
  if (mood === "sad") {
    return `
      <circle cx="${cx1}" cy="${cy}" r="7" fill="#3a2e45"/>
      <circle cx="${cx2}" cy="${cy}" r="7" fill="#3a2e45"/>
      <path d="M${cx1 - 6} ${cy - 10} q6 -6 12 0" stroke="#3a2e45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M${cx2 - 6} ${cy - 10} q6 -6 12 0" stroke="#3a2e45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="${cx1 + 3}" cy="${cy + 10}" r="2.5" fill="#bfe4ff"/>
    `;
  }
  if (mood === "yum") {
    return `
      <path d="M${cx1 - 9} ${cy + 2} q9 -12 18 0" stroke="#3a2e45" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M${cx2 - 9} ${cy + 2} q9 -12 18 0" stroke="#3a2e45" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    `;
  }
  return `
    <circle cx="${cx1}" cy="${cy}" r="10.5" fill="#4a3a32"/>
    <circle cx="${cx2}" cy="${cy}" r="10.5" fill="#4a3a32"/>
    <circle cx="${cx1 - 3.5}" cy="${cy - 3.5}" r="3.4" fill="#fff"/>
    <circle cx="${cx2 - 3.5}" cy="${cy - 3.5}" r="3.4" fill="#fff"/>
    <circle cx="${cx1 + 2.5}" cy="${cy + 2.5}" r="1.4" fill="#fff" opacity="0.8"/>
    <circle cx="${cx2 + 2.5}" cy="${cy + 2.5}" r="1.4" fill="#fff" opacity="0.8"/>
  `;
}

function blushMarkup(cx1, cx2, cy) {
  return `<ellipse cx="${cx1}" cy="${cy}" rx="11" ry="6.5" fill="#ffb4c6" opacity="0.65"/>
          <ellipse cx="${cx2}" cy="${cy}" rx="11" ry="6.5" fill="#ffb4c6" opacity="0.65"/>`;
}

// Pynt låses upp varannan nivå och blir kvar. Bara de två senaste visas,
// annars blir det rörigt på en liten yta.
const ACCESSORY_TIERS = [
  {
    level: 2,
    label: "Mössa",
    markup: `<g transform="translate(100,34)">
      <path d="M-30 6 Q-30 -20 0 -20 Q30 -20 30 6 Z" fill="#ff8f6b"/>
      <rect x="-33" y="4" width="66" height="9" rx="4.5" fill="#ffd0b8"/>
      <circle cx="0" cy="-24" r="7" fill="#ffd0b8"/>
    </g>`
  },
  {
    level: 4,
    label: "Löv",
    markup: `<g transform="translate(150,40) rotate(20)">
      <path d="M0 0 Q16 -10 24 4 Q14 18 0 0 Z" fill="#8ad06b" stroke="#5fb04a" stroke-width="1.5"/>
      <path d="M2 1 L22 4" stroke="#5fb04a" stroke-width="1.5"/>
    </g>`
  },
  {
    level: 6,
    label: "Krona",
    markup: `<g transform="translate(80,14)">
      <path d="M0 18 L6 2 L14 14 L20 -2 L26 14 L34 2 L40 18 Z" fill="#ffd93d" stroke="#e0a800" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="20" cy="4" r="3" fill="#ff6f9c"/>
    </g>`
  },
  {
    level: 8,
    label: "Ryggsäck",
    markup: `<g transform="translate(28,128)">
      <rect x="-14" y="-12" width="28" height="30" rx="8" fill="#8ad6b0" stroke="#5fb78d" stroke-width="2"/>
      <rect x="-9" y="2" width="18" height="10" rx="3" fill="#e6fff2"/>
      <path d="M-8 -12 Q0 -22 8 -12" stroke="#5fb78d" stroke-width="3" fill="none"/>
    </g>`
  },
  {
    level: 10,
    label: "Boll",
    markup: `<g transform="translate(128,164)">
      <circle cx="0" cy="0" r="13" fill="#fff" stroke="#3a2e45" stroke-width="2"/>
      <path d="M0 -13 L0 13 M-13 0 L13 0" stroke="#3a2e45" stroke-width="2"/>
    </g>`
  },
  {
    level: 12,
    label: "Solglasögon",
    markup: `<g transform="translate(101,82)">
      <ellipse cx="-20" cy="0" rx="11" ry="9" fill="#4a3f5c"/>
      <ellipse cx="20" cy="0" rx="11" ry="9" fill="#4a3f5c"/>
      <path d="M-9 -2 Q0 -9 9 -2" stroke="#4a3f5c" stroke-width="3" fill="none"/>
      <ellipse cx="-23" cy="-3" rx="3" ry="2" fill="#fff" opacity="0.5"/>
      <ellipse cx="17" cy="-3" rx="3" ry="2" fill="#fff" opacity="0.5"/>
    </g>`
  },
  {
    level: 14,
    label: "Nalle",
    markup: `<g transform="translate(28,130)">
      <circle cx="0" cy="6" r="9" fill="#e0b98a"/>
      <circle cx="-7" cy="-2" r="4" fill="#e0b98a"/>
      <circle cx="7" cy="-2" r="4" fill="#e0b98a"/>
      <circle cx="0" cy="16" r="7" fill="#e0b98a"/>
      <circle cx="-3" cy="5" r="1.2" fill="#3a2e45"/>
      <circle cx="3" cy="5" r="1.2" fill="#3a2e45"/>
      <path d="M-2 9 Q0 11 2 9" stroke="#3a2e45" stroke-width="1" fill="none" stroke-linecap="round"/>
    </g>`
  },
  {
    level: 16,
    label: "Ballong",
    markup: `<g transform="translate(28,46)">
      <ellipse cx="0" cy="0" rx="15" ry="18" fill="#ff8fa8"/>
      <ellipse cx="-5" cy="-6" rx="4" ry="5" fill="#fff" opacity="0.5"/>
      <path d="M0 18 L-3 23 L3 23 Z" fill="#e9738e"/>
      <path d="M0 23 Q7 40 -1 58" stroke="#c9b8a0" stroke-width="2" fill="none"/>
    </g>`
  },
  {
    level: 18,
    label: "Stjärnor",
    markup: `<g fill="#ffe98a">
      <path d="M58 24 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z"/>
      <path d="M162 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z"/>
      <path d="M176 66 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z"/>
    </g>`
  }
];

function accessoryMarkup(level) {
  const earned = ACCESSORY_TIERS.filter((t) => level >= t.level);
  return earned.slice(-2).map((t) => t.markup).join("");
}

function petSizeScale(level) {
  if (level >= 20) return 1.4;
  if (level >= 14) return 1.28;
  if (level >= 7) return 1.14;
  return 1;
}

// Båda djuren ritas i sticker-stil: mjuka rundade former, tunn ljus kontur,
// inga spetsiga hörn. Allt som kan rundas av rundas av.
const OUTLINE = "#96754f";
const SW = 2.4;

function kiwiBeakMarkup(mood) {
  if (mood === "yum") {
    return `
      <path d="M102 94 Q140 88 162 92 Q170 95 162 99 Q140 104 102 104 Z"
            fill="#e8b273" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M102 110 Q140 112 162 118 Q170 121 162 123 Q140 122 102 120 Z"
            fill="#d99a58" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>
    `;
  }
  return `<path d="M102 96 Q142 94 166 100 Q175 104 166 108 Q142 116 102 114 Z"
                fill="#e8b273" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
}

// Mjuk prickig fjäderdräkt.
const KIWI_SPECKS = [
  [66, 60], [90, 50], [118, 54], [142, 66], [56, 84], [150, 90],
  [62, 112], [146, 118], [78, 132], [120, 134], [100, 142], [134, 42],
  [74, 44], [48, 100], [154, 104], [98, 64]
];

function renderKiwiSVG(mood, level) {
  const specks = KIWI_SPECKS.map(
    ([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.6" fill="#a2764c" opacity="0.4" transform="rotate(-20 ${x} ${y})"/>`
  ).join("");
  return `
  <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="170" rx="44" ry="6" fill="#000" opacity="0.06"/>

    <!-- mjuka små ben med rundade tår -->
    <path d="M85 148 L82 160 M115 148 L118 160" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round"/>
    <path d="M85 148 L82 160 M115 148 L118 160" stroke="#e8b273" stroke-width="6" stroke-linecap="round"/>
    <path d="M74 162 L90 162 M110 162 L126 162" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round"/>
    <path d="M74 162 L90 162 M110 162 L126 162" stroke="#e8b273" stroke-width="6" stroke-linecap="round"/>

    <!-- rund, luddig kropp -->
    <path d="M100 34 C142 34 162 62 162 94 C162 126 136 152 100 152 C64 152 38 126 38 94 C38 62 58 34 100 34 Z"
          fill="#c9956a" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M100 152 C74 152 56 138 50 122 C72 140 100 142 100 142 C100 142 128 140 150 122 C144 138 126 152 100 152 Z"
          fill="#e3bf98" opacity="0.85"/>
    ${specks}

    <!-- liten mjuk vinge -->
    <path d="M58 92 Q78 106 68 124" stroke="${OUTLINE}" stroke-width="${SW}" fill="none" stroke-linecap="round"/>

    ${blushMarkup(68, 134, 92)}
    ${eyesMarkup(mood, 84, 124, 72)}
    ${kiwiBeakMarkup(mood)}
    ${accessoryMarkup(level)}
  </svg>`;
}

function foxMouthMarkup(mood) {
  if (mood === "yum") {
    return `<ellipse cx="100" cy="128" rx="8" ry="7" fill="#a5445c"/>
            <ellipse cx="100" cy="130" rx="4.5" ry="3.5" fill="#ff8fa8"/>`;
  }
  if (mood === "sad") {
    return `<path d="M91 130 q9 -8 18 0" stroke="${OUTLINE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M100 124 q-6 9 -12 2 M100 124 q6 9 12 2" stroke="${OUTLINE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
}

function renderFoxSVG(mood, level) {
  // Svansen är ett tjockt streck med runda ändar, så den blir luddig och mjuk.
  const tailPath = "M128 146 Q172 142 172 110 Q172 88 158 84";
  return `
  <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="172" rx="44" ry="6" fill="#000" opacity="0.06"/>

    <path d="${tailPath}" stroke="${OUTLINE}" stroke-width="40" fill="none" stroke-linecap="round"/>
    <path d="${tailPath}" stroke="#ef9f52" stroke-width="35" fill="none" stroke-linecap="round"/>
    <path d="M166 96 Q172 88 159 84" stroke="#fff8ef" stroke-width="33" fill="none" stroke-linecap="round"/>

    <!-- stora rundade öron med mörka toppar -->
    <path d="M52 58 Q38 20 62 14 Q84 24 88 46 Q68 48 52 58 Z"
          fill="#ef9f52" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M62 14 Q44 20 44 36 Q54 26 68 24 Z" fill="#6b5340"/>
    <path d="M60 50 Q54 30 66 26 Q78 32 78 44 Q68 44 60 50 Z" fill="#ffd2b4"/>
    <path d="M148 58 Q162 20 138 14 Q116 24 112 46 Q132 48 148 58 Z"
          fill="#ef9f52" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M138 14 Q156 20 156 36 Q146 26 132 24 Z" fill="#6b5340"/>
    <path d="M140 50 Q146 30 134 26 Q122 32 122 44 Q132 44 140 50 Z" fill="#ffd2b4"/>

    <!-- kropp med mörka rävstrumpor -->
    <ellipse cx="100" cy="146" rx="42" ry="27" fill="#ef9f52" stroke="${OUTLINE}" stroke-width="${SW}"/>
    <ellipse cx="100" cy="152" rx="26" ry="18" fill="#fff8ef"/>
    <ellipse cx="78" cy="164" rx="13" ry="8" fill="#6b5340" stroke="${OUTLINE}" stroke-width="${SW}"/>
    <ellipse cx="122" cy="164" rx="13" ry="8" fill="#6b5340" stroke="${OUTLINE}" stroke-width="${SW}"/>

    <!-- huvud som smalnar av till en lång mjuk nos -->
    <path d="M100 24
             C134 24 154 44 154 70
             C154 84 149 94 140 100
             C132 105 124 108 117 112
             C113 122 108 134 100 140
             C92 134 87 122 83 112
             C76 108 68 105 60 100
             C51 94 46 84 46 70
             C46 44 66 24 100 24 Z"
          fill="#ef9f52" stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"/>

    <!-- vitt nosparti hela vägen ut på nosen -->
    <path d="M68 98 Q100 114 132 98 Q131 122 113 135 Q100 143 87 135 Q69 122 68 98 Z" fill="#fff8ef"/>
    <path d="M56 80 Q60 56 78 46 Q64 66 62 86 Z" fill="#fff8ef" opacity="0.3"/>

    ${blushMarkup(64, 136, 92)}
    ${eyesMarkup(mood, 80, 120, 74)}

    <!-- liten rundad nostryne längst ut -->
    <path d="M92 112 Q100 108 108 112 Q106 121 100 122 Q94 121 92 112 Z" fill="#4a3a32"/>
    ${foxMouthMarkup(mood)}
    ${accessoryMarkup(level)}
  </svg>`;
}

function petSVG(type, mood, level) {
  return type === "fox" ? renderFoxSVG(mood, level) : renderKiwiSVG(mood, level);
}

let currentMood = "happy";
function updatePetAvatars(mood) {
  currentMood = mood || currentMood;
  const svg = petSVG(state.petType, currentMood, state.level);
  const mini = document.getElementById("pet-avatar");
  const big = document.getElementById("pet-avatar-big");
  if (mini) mini.innerHTML = svg;
  if (big) big.innerHTML = svg;

  const sizeWrap = document.getElementById("pet-size-wrap");
  if (sizeWrap) sizeWrap.style.transform = `scale(${petSizeScale(state.level)})`;
}

function flashMood(mood, duration = 1400) {
  updatePetAvatars(mood);
  setTimeout(() => updatePetAvatars("happy"), duration);
}

/* ---------------------------------------------------------
   UI: toasts, konfetti, flygande emoji
   --------------------------------------------------------- */
function showToast(text, big) {
  const layer = document.getElementById("toast-layer");
  const el = document.createElement("div");
  el.className = "toast" + (big ? " big" : "");
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

const CONFETTI_COLORS = ["#ff8f6b", "#8ad6b0", "#ffd93d", "#7fc4ef", "#f0913f"];
function burstConfetti(count) {
  const layer = document.getElementById("confetti-layer");
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    const size = 6 + Math.random() * 6;
    el.style.left = Math.random() * 100 + "vw";
    el.style.width = size + "px";
    el.style.height = size * 0.6 + "px";
    el.style.background = pick(CONFETTI_COLORS);
    el.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    el.style.opacity = String(0.8 + Math.random() * 0.2);
    layer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

function floatEmojiFromPet(emoji) {
  const stage = document.querySelector(".pet-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.className = "float-emoji";
  el.textContent = emoji;
  const rect = stage.getBoundingClientRect();
  el.style.left = rect.width / 2 - 12 + (Math.random() * 40 - 20) + "px";
  el.style.top = "50px";
  stage.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/* ---------------------------------------------------------
   Rendering
   --------------------------------------------------------- */
function setBubble(text) {
  const el = document.getElementById("pet-bubble");
  if (el) el.textContent = text;
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 10) return pick(GREETING_MORNING);
  if (h < 17) return pick(GREETING_AFTERNOON);
  return pick(GREETING_EVENING);
}

function updateStatsUI() {
  const cfg = petCfg();
  document.getElementById("pet-name-display").textContent = state.petName;
  document.getElementById("pet-level").textContent = "Nivå " + state.level;
  document.getElementById("hunger-icon").textContent = cfg.foodEmoji;
  document.getElementById("feed-emoji").textContent = cfg.foodEmoji;

  const xpPct = clamp((state.xp / xpToNext(state.level)) * 100, 0, 100);
  document.getElementById("xp-fill").style.width = xpPct + "%";
  document.getElementById("hunger-fill").style.width = state.hunger + "%";
  document.getElementById("happiness-fill").style.width = state.happiness + "%";

  document.getElementById("streak-count").textContent = state.streak;
  document.getElementById("food-count").textContent = state.food;
  document.getElementById("love-count").textContent = state.love;

  document.getElementById("feed-btn").disabled = state.food <= 0;
  document.getElementById("love-btn").disabled = state.love <= 0;

  const doneCount = Object.keys(state.completedToday).length;
  const totalToday = totalTasksToday();
  document.getElementById("daily-progress-text").textContent = `${doneCount} / ${totalToday}`;
  document.getElementById("daily-progress-fill").style.width = clamp((doneCount / totalToday) * 100, 0, 100) + "%";

  if (state.hunger <= 25) setBubble(pick(cfg.hungryBubbles));
  else if (state.happiness <= 25) setBubble(pick(LOW_HAPPINESS_BUBBLE));
}

function renderTaskSections() {
  const container = document.getElementById("task-sections");
  container.innerHTML = "";

  TASK_SECTIONS.forEach((section) => {
    const todaysTasks = activeTasksForSection(section);
    if (todaysTasks.length === 0) return;

    const doneInSection = todaysTasks.filter((t) => state.completedToday[t.id]).length;
    const collapsed = !!state.sectionsCollapsed[section.id];

    const sectionEl = document.createElement("div");
    sectionEl.className = "task-section" + (collapsed ? " collapsed" : "");
    sectionEl.innerHTML = `
      <div class="task-section-header" data-section="${section.id}">
        <span class="task-section-emoji">${section.emoji}</span>
        <span class="task-section-title">${section.title}</span>
        <span class="task-section-progress">${doneInSection}/${todaysTasks.length}</span>
        <span class="task-section-chevron">▾</span>
      </div>
      <ul class="task-list">
        ${todaysTasks
          .map((t) => {
            const done = !!state.completedToday[t.id];
            return `
            <li class="task-item${done ? " done" : ""}" data-task="${t.id}" data-section="${section.id}">
              <span class="task-checkbox">${done ? "✓" : ""}</span>
              <span class="task-emoji">${t.emoji}</span>
              <span class="task-label">${t.text}</span>
              <button class="speak-btn" data-speak="${t.text}" title="Lyssna" aria-label="Lyssna">🔊</button>
            </li>`;
          })
          .join("")}
      </ul>
    `;
    container.appendChild(sectionEl);
  });
}

function renderAll() {
  updatePetAvatars("happy");
  updateStatsUI();
  renderTaskSections();
  renderBabyAvatar();
  setBubble(greetingForNow());
  document.getElementById("demo-badge").hidden = !DEMO_MODE;
}

/* ---------------------------------------------------------
   Unge: dyker upp på nivå 20 och stannar kvar.
   Inga val och ingen text att läsa, bara något gulligt att se.
   --------------------------------------------------------- */
const BABY_NAMES = { kiwi: "Lillkiwi", fox: "Lillräv" };

function renderBabyAvatar() {
  const wrap = document.getElementById("baby-avatar-wrap");
  if (!wrap) return;
  if (!state.hasBaby) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  document.getElementById("baby-avatar").innerHTML = petSVG(state.petType, "happy", 1);
  document.getElementById("baby-name-tag").textContent = state.babyName;
}

function checkBabyMilestone() {
  if (state.hasBaby || state.level < state.babyLevel) return;
  state.hasBaby = true;
  state.babyName = BABY_NAMES[state.petType] || "Lillen";
  saveState();
  renderBabyAvatar();
  showToast("En liten unge kom! 🍼", true);
  burstConfetti(30);
}

/* ---------------------------------------------------------
   Logik
   --------------------------------------------------------- */
function completeTask(taskId, sectionId) {
  if (state.completedToday[taskId]) {
    delete state.completedToday[taskId];
    recordToday();
    renderTaskSections();
    updateStatsUI();
    return;
  }

  state.completedToday[taskId] = true;

  if (!state.rewardedToday[taskId]) {
    state.rewardedToday[taskId] = true;
    state.xp += XP_PER_TASK;
    state.food = clamp(state.food + FOOD_PER_TASK, 0, MAX_FOOD);
    state.love = clamp(state.love + LOVE_PER_TASK, 0, MAX_LOVE);
    state.totalCompleted += 1;

    const levelBefore = state.level;
    let leveledUp = false;
    while (state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level);
      state.level += 1;
      state.food = clamp(state.food + 2, 0, MAX_FOOD);
      state.love = clamp(state.love + 2, 0, MAX_LOVE);
      leveledUp = true;
    }

    showToast(pick(TASK_MESSAGES));
    burstConfetti(14);
    flashMood("love", 900);

    if (leveledUp) {
      setTimeout(() => {
        showToast(pick(LEVEL_UP_MESSAGES), true);
        burstConfetti(30);
      }, 350);

      const newAccessory = ACCESSORY_TIERS.find((t) => t.level > levelBefore && t.level <= state.level);
      const newSizeTier = [7, 14, 20].find((l) => l > levelBefore && l <= state.level);
      let extraDelay = 900;
      if (newAccessory) {
        setTimeout(() => {
          showToast(`Ny sak: ${newAccessory.label}! ✨`, true);
          burstConfetti(24);
        }, extraDelay);
        extraDelay += 550;
      }
      if (newSizeTier) {
        setTimeout(() => {
          showToast("Djuret växte! 🌟", true);
          burstConfetti(24);
        }, extraDelay);
      }

      checkBabyMilestone();
    }

    const section = TASK_SECTIONS.find((s) => s.id === sectionId);
    const sectionDone = activeTasksForSection(section).every((t) => state.completedToday[t.id]);
    if (sectionDone) {
      setTimeout(() => showToast(pick(SECTION_COMPLETE_MESSAGES)), leveledUp ? 750 : 400);
      burstConfetti(20);
    }

    if (Object.keys(state.completedToday).length >= totalTasksToday()) {
      setTimeout(() => {
        showToast(pick(ALL_DONE_MESSAGES), true);
        burstConfetti(50);
      }, sectionDone ? 1100 : 500);
    }
  }

  recordToday();
  renderTaskSections();
  updateStatsUI();
}

function pulseBigAvatar() {
  const big = document.getElementById("pet-avatar-big");
  big.classList.add("pulse-once");
  setTimeout(() => big.classList.remove("pulse-once"), 500);
}

function feedPet() {
  if (state.food <= 0) return;
  const cfg = petCfg();
  state.food -= 1;
  state.hunger = clamp(state.hunger + 20, 0, 100);
  saveState();
  updateStatsUI();
  floatEmojiFromPet(cfg.foodEmoji);
  setBubble(pick(cfg.foodMessages));
  flashMood("yum", 900);
  pulseBigAvatar();
}

function lovePet() {
  if (state.love <= 0) return;
  state.love -= 1;
  state.happiness = clamp(state.happiness + 20, 0, 100);
  saveState();
  updateStatsUI();
  floatEmojiFromPet("💚");
  setBubble(pick(LOVE_MESSAGES));
  flashMood("love", 900);
  pulseBigAvatar();
}

/* ---------------------------------------------------------
   Startskärm
   --------------------------------------------------------- */
function initStartScreen() {
  let chosenPet = null;
  const choices = document.querySelectorAll(".pet-choice");
  const nameInput = document.getElementById("pet-name-input");
  const suggestions = document.getElementById("name-suggestions");
  const startBtn = document.getElementById("start-btn");

  function validateStart() {
    startBtn.disabled = !(chosenPet && nameInput.value.trim().length > 0);
  }

  // Namnförslag att trycka på, så Olle slipper skriva om han inte vill.
  function renderSuggestions() {
    suggestions.innerHTML = "";
    if (!chosenPet) return;
    PETS[chosenPet].names.forEach((name) => {
      const btn = document.createElement("button");
      btn.className = "name-chip";
      btn.type = "button";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        nameInput.value = name;
        suggestions.querySelectorAll(".name-chip").forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        validateStart();
      });
      suggestions.appendChild(btn);
    });
  }

  choices.forEach((btn) => {
    btn.querySelector(".pet-avatar-preview").innerHTML = petSVG(btn.dataset.pet, "happy", 1);
    btn.addEventListener("click", () => {
      chosenPet = btn.dataset.pet;
      choices.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      renderSuggestions();
      validateStart();
    });
  });

  nameInput.addEventListener("input", validateStart);

  startBtn.addEventListener("click", () => {
    if (!chosenPet || !nameInput.value.trim()) return;
    state.petType = chosenPet;
    state.petName = nameInput.value.trim().slice(0, 12);
    state.lastActiveDate = todayStr();
    saveState();
    showAppScreen();
  });
}

function showAppScreen() {
  document.getElementById("screen-start").classList.remove("active");
  document.getElementById("screen-app").classList.add("active");
  renderAll();
  checkBabyMilestone();
}

/* ---------------------------------------------------------
   Events
   --------------------------------------------------------- */
function initAppEvents() {
  document.getElementById("task-sections").addEventListener("click", (e) => {
    const speakBtn = e.target.closest(".speak-btn");
    if (speakBtn) {
      speak(speakBtn.dataset.speak);
      return;
    }
    const header = e.target.closest(".task-section-header");
    if (header) {
      const id = header.dataset.section;
      state.sectionsCollapsed[id] = !state.sectionsCollapsed[id];
      saveState();
      renderTaskSections();
      return;
    }
    const item = e.target.closest(".task-item");
    if (item) completeTask(item.dataset.task, item.dataset.section);
  });

  document.getElementById("feed-btn").addEventListener("click", feedPet);
  document.getElementById("love-btn").addEventListener("click", lovePet);

  document.getElementById("pet-bubble").addEventListener("click", (e) => speak(e.currentTarget.textContent));

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Vill du börja om från början? Allt sparat försvinner.")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
function init() {
  handleDailyReset();
  applyStatDecay();
  if (state.petType) recordToday();
  initAppEvents();
  registerServiceWorker();

  if (state.petType) {
    showAppScreen();
  } else {
    document.getElementById("screen-start").classList.add("active");
    initStartScreen();
  }
}

document.addEventListener("DOMContentLoaded", init);
