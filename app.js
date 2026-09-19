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
const ALLA_DAGAR = [DAG_SON, DAG_MAN, DAG_TIS, DAG_ONS, DAG_TORS, DAG_FRE, DAG_LOR];

// Läsbarare än att räkna upp sex veckodagar för hand.
function utom(...dagar) {
  return ALLA_DAGAR.filter((d) => !dagar.includes(d));
}

const TASK_SECTIONS = [
  {
    id: "morgon",
    emoji: "🌅",
    title: "Morgon",
    tasks: [
      { id: "vakna", emoji: "☀️", text: "Vakna" },
      { id: "klader", emoji: "👕", text: "Ta på kläder" },
      { id: "frukost", emoji: "🥣", text: "Ät frukost" },
      { id: "plocka-frukost", emoji: "🧽", text: "Plocka undan frukosten" },
      { id: "tander-morgon", emoji: "🪥", text: "Borsta tänder" },
      { id: "frukt", emoji: "🍎", text: "Packa frukt", days: utom(DAG_LOR, DAG_SON) },
      { id: "gympa", emoji: "🩳", text: "Ta med gympakläder", days: [DAG_TIS, DAG_TORS] },
      { id: "vaska", emoji: "🎒", text: "Ta väskan", days: VARDAGAR },
      { id: "skolan", emoji: "🏫", text: "Gå till skolan", days: VARDAGAR }
    ]
  },
  {
    id: "eftermiddag",
    emoji: "🌤️",
    title: "Eftermiddag",
    tasks: [
      { id: "gaby", emoji: "🧸", text: "Gullisar och Gaby" },
      { id: "lego", emoji: "🧱", text: "Ta undan lego" },
      { id: "magneter", emoji: "🧲", text: "Ta undan magneter" },
      { id: "bilar", emoji: "🚗", text: "Ta undan bilarna" },
      { id: "tvatt", emoji: "🧺", text: "Tvätt i korgen" },
      { id: "besticken", emoji: "🍴", text: "Töm besticken" },
      { id: "duka", emoji: "🍽️", text: "Duka" },
      { id: "duka-undan", emoji: "🧽", text: "Duka undan" },
      { id: "laslaxa", emoji: "📖", text: "Gör läsläxan", days: utom(DAG_FRE, DAG_LOR) },
      { id: "skrivbord", emoji: "🧹", text: "Städa skrivbordet", days: [DAG_LOR] },
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
      { id: "packa-vaska", emoji: "🎒", text: "Packa skolväskan", days: utom(DAG_FRE, DAG_LOR) },
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
  return section.tasks.filter((t) => isTaskActiveOnDate(t, d)).concat(extrasForSection(section.id, d));
}
/* ---------------------------------------------------------
   Servern: dagens läge skickas upp, engångsuppgifter hämtas ner
   --------------------------------------------------------- */
const PUSH_WORKER_URL = "https://frallan-push.bella-sassibrass.workers.dev";
const EXTRA_STORAGE = "frallan_extra_v1";
let extraTasks = [];

function loadExtras() {
  try {
    const raw = localStorage.getItem(EXTRA_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    extraTasks = Array.isArray(list) ? list : [];
  } catch (e) {
    extraTasks = [];
  }
}

function extrasForSection(sectionId, date) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return extraTasks.filter((t) => (t.section || "eftermiddag") === sectionId && t.date === key);
}

async function fetchExtras() {
  try {
    const res = await fetch(PUSH_WORKER_URL + "/extra?date=" + todayStr());
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.tasks)) return;
    extraTasks = data.tasks;
    localStorage.setItem(EXTRA_STORAGE, JSON.stringify(extraTasks));
    if (state.petType) {
      renderTaskSections();
      updateStatsUI();
    }
  } catch (e) {
    // ingen uppkoppling, de sparade får duga
  }
}

// Skickar dagens läge så föräldrapanelen kan visa det. Misslyckas det gör
// det ingenting, appen fungerar precis lika bra utan.
function syncStateToWorker() {
  if (!state.petType) return;
  const tasks = [];
  TASK_SECTIONS.forEach((section) => {
    activeTasksForSection(section).forEach((t) => {
      tasks.push({ id: t.id, text: t.text, done: !!state.completedToday[t.id] });
    });
  });
  fetch(PUSH_WORKER_URL + "/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      allDoneToday: tasks.length > 0 && tasks.every((t) => t.done),
      tasks,
      hunger: state.hunger,
      happiness: state.happiness,
      level: state.level,
      streak: state.streak,
      petName: state.petName
    })
  }).catch(() => {});
}

function totalTasksForDate(date) {
  return TASK_SECTIONS.reduce((s, sec) => s + activeTasksForSection(sec, date).length, 0);
}
function totalTasksToday() {
  return totalTasksForDate(new Date());
}

const XP_PER_TASK = 10;
// Lagret rymmer ett dygns behov. Åtta matningar ger 96 hungerpoäng och ett
// vaket dygn kostar 90, så inget han tjänar in går till spillo bara för att
// han bockar av en hel sektion innan han matar.
const MAX_FOOD = 8;
const MAX_LOVE = 8;

// Varje uppgift ger antingen mat eller kärlek, inte båda. Gav den båda nådde
// lagret taket på nolltid och knapparna slutade betyda något. Fördelningen
// varvas jämnt över listan och är låst till uppgiftens id, så samma uppgift
// ger alltid samma sak.
// Morgonen lutar mot mat. Djuret har svultit hela natten, och på lördag och
// söndag finns bara fem morgonuppgifter att tjäna på, eftersom frukt, väska
// och skola faller bort. Mönstret ger fyra mat de dagarna, vilket är precis
// vad lagret rymmer, och fem på en vardag.
const REWARD_PATTERN = {
  morgon: ["food", "love", "food", "food", "food", "love", "food", "love", "food"]
};

const TASK_REWARD = {};
TASK_SECTIONS.forEach((section) => {
  const pattern = REWARD_PATTERN[section.id];
  section.tasks.forEach((task, i) => {
    const fromPattern = pattern && pattern[i];
    TASK_REWARD[task.id] = fromPattern || (i % 2 === 0 ? "food" : "love");
  });
});

function rewardForTask(taskId) {
  return TASK_REWARD[taskId] === "love" ? "love" : "food";
}

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
const SLEEP_BUBBLE = ["Zzz... 😴", "God natt! 🌙", "Jag sover nu 💤"];

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
    hasEgg: false,
    eggFoundAt: null,
    eggStageSeen: 0,
    hasBaby: false,
    babyName: "",
    eggLevel: 30,
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
  s.petType = "kiwi";
  s.petName = "Nappe";
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
  syncStateToWorker();
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

const HUNGER_DECAY_PER_HOUR = 6;
const HAPPINESS_DECAY_PER_HOUR = 3;

// Timmar mellan två tidpunkter då djuret var vaket. Nätter räknas bort dag
// för dag, så uträkningen stämmer även om appen varit stängd länge.
function awakeHoursBetween(from, to) {
  if (to <= from) return 0;
  let awake = 0;
  const dag = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 400 && dag <= to; i++) {
    const vaknar = new Date(dag);
    vaknar.setHours(NIGHT_TO_HOUR, 0, 0, 0);
    const somnar = new Date(dag);
    somnar.setHours(NIGHT_FROM_HOUR, 0, 0, 0);
    const start = Math.max(from.getTime(), vaknar.getTime());
    const slut = Math.min(to.getTime(), somnar.getTime());
    if (slut > start) awake += (slut - start) / (60 * 60 * 1000);
    dag.setDate(dag.getDate() + 1);
  }
  return awake;
}

// Hunger och humör sjunker med verklig förfluten tid, men bara medan djuret
// är vaket. Ett sovande djur blir inte hungrigt, och utan den regeln gick
// dygnet back på helgerna: uppgifterna räckte inte till nattens förbrukning.
function applyStatDecay() {
  const now = new Date();
  if (!state.lastStatDecayAt) {
    state.lastStatDecayAt = now.toISOString();
    saveState();
    return;
  }
  const hoursElapsed = awakeHoursBetween(new Date(state.lastStatDecayAt), now);
  if (hoursElapsed < 0.1) {
    state.lastStatDecayAt = now.toISOString();
    saveState();
    return;
  }

  state.hunger = Math.round(clamp(state.hunger - hoursElapsed * HUNGER_DECAY_PER_HOUR, 10, 100));
  state.happiness = Math.round(clamp(state.happiness - hoursElapsed * HAPPINESS_DECAY_PER_HOUR, 10, 100));
  state.lastStatDecayAt = now.toISOString();
  saveState();
}

/* ---------------------------------------------------------
   Båda djuren är riktiga illustrationer, inte ritade i kod.
   Varje min och varje nivå har sin egen pose ur bildarken.
   --------------------------------------------------------- */
const PET_ART = {
  kiwi: {
    file: (n) => `djur/kiwi-${String(n).padStart(2, "0")}.svg`,
    mood: { yum: 18, love: 11 },
    sleep: 2,
    wonder: 3,
    tear: 5,
    idle: [
      { level: 1, pose: 13, label: "Kiwi" },
      { level: 2, pose: 17, label: "Spanaren" },
      { level: 4, pose: 7, label: "Promenaden" },
      { level: 6, pose: 0, label: "Springaren" },
      { level: 8, pose: 9, label: "Vilostunden" },
      { level: 10, pose: 16, label: "Blomman" },
      { level: 12, pose: 19, label: "Hatten" },
      { level: 14, pose: 8, label: "Ballongen" },
      { level: 16, pose: 12, label: "Brevet" },
      { level: 18, pose: 15, label: "Viften" }
    ]
  },
  fox: {
    file: (n) => `djur/rav-${String(n).padStart(2, "0")}.svg`,
    mood: { yum: 2, love: 16 },
    sleep: 11,
    wonder: 15,
    tear: 4,
    idle: [
      { level: 1, pose: 0, label: "Räven" },
      { level: 2, pose: 13, label: "Spanaren" },
      { level: 4, pose: 7, label: "Vinkaren" },
      { level: 6, pose: 5, label: "Promenaden" },
      { level: 8, pose: 10, label: "Springaren" },
      { level: 10, pose: 18, label: "Vintermössan" },
      { level: 12, pose: 12, label: "Trollkarlen" },
      { level: 14, pose: 14, label: "Ballongen" },
      { level: 16, pose: 17, label: "Boken" },
      { level: 18, pose: 6, label: "Kurragömma" }
    ]
  }
};

const NIGHT_FROM_HOUR = 21;
const NIGHT_TO_HOUR = 6;

function isNight(date) {
  const h = (date === undefined ? new Date() : date).getHours();
  return h >= NIGHT_FROM_HOUR || h < NIGHT_TO_HOUR;
}

function artFor(type) {
  return PET_ART[type] || PET_ART.kiwi;
}

// Nya poser låses upp varannan nivå och blir djurets vardagsutseende.
function idlePose(type, level) {
  const unlocked = artFor(type).idle.filter((p) => level >= p.level);
  return unlocked[unlocked.length - 1] || artFor(type).idle[0];
}

// Ordningen är medveten: en min som just spelas upp går före allt, sedan
// riktigt dåligt mående, sedan natten, sedan lite dåligt mående, och sist
// nivåns vanliga pose. Tåren går före natten, annars sover djuret gott
// samtidigt som bubblan ber om mat.
function poseNumber(type, mood, level) {
  const art = artFor(type);
  if (mood in art.mood) return art.mood[mood];
  const lowest = Math.min(state.hunger, state.happiness);
  if (lowest <= 15) return art.tear;
  if (isNight()) return art.sleep;
  if (lowest <= 30) return art.wonder;
  return idlePose(type, level).pose;
}

// Sover djuret just nu? Bubblan ska säga något annat då.
function isSleeping() {
  return currentMood === "happy" && isNight() && Math.min(state.hunger, state.happiness) > 15;
}

function petSizeScale(level) {
  if (level >= 20) return 1.4;
  if (level >= 14) return 1.28;
  if (level >= 7) return 1.14;
  return 1;
}

function petSVG(type, mood, level) {
  const art = artFor(type);
  return `<img class="pet-art" src="${art.file(poseNumber(type, mood, level))}" alt="" draggable="false">`;
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
  updatePetAvatars();
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

  if (isSleeping()) setBubble(pick(SLEEP_BUBBLE));
  else if (state.hunger <= 25) setBubble(pick(cfg.hungryBubbles));
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
   Ägget: dyker upp på nivå 30. Det spricker lite mer för varje dygn och
   kläcks på tredje dagen. Inga val och ingen text att läsa, bara något
   gulligt att gå och vänta på.
   --------------------------------------------------------- */
const BABY_NAMES = { kiwi: "Lillkiwi", fox: "Lillräv" };

const EGG_HATCH_DAYS = 6;

// 0 = helt ägg, 1 till 5 = en ny spricka för varje dygn, 6 = dags att kläckas.
function eggStage() {
  if (!state.eggFoundAt) return 0;
  const days = (Date.now() - new Date(state.eggFoundAt).getTime()) / 86400000;
  return clamp(Math.floor(days), 0, EGG_HATCH_DAYS);
}

function eggSVG(stage) {
  const crack = (d) =>
    `<path d="${d}" stroke="#8a6a4a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const cracks = [
    crack("M40 60 l9 -8 -5 -9 8 -7"),
    crack("M62 88 l10 -7 -4 -10 11 -6"),
    crack("M28 92 l11 5 2 11 10 4"),
    crack("M52 34 l-8 8 7 8 -6 7"),
    crack("M70 110 l-10 3 -3 10 -9 4")
  ];
  return `
  <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="132" rx="26" ry="4" fill="#000" opacity="0.07"/>
    <path d="M50 12 C72 12 86 48 86 78 C86 108 70 126 50 126 C30 126 14 108 14 78 C14 48 28 12 50 12 Z"
          fill="#fdf3e3" stroke="#8a6a4a" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="38" cy="52" rx="6" ry="4" fill="#e8d3b4"/>
    <ellipse cx="62" cy="72" rx="7" ry="5" fill="#e8d3b4"/>
    <ellipse cx="44" cy="96" rx="5" ry="4" fill="#e8d3b4"/>
    ${cracks.slice(0, stage).join("")}
  </svg>`;
}

function renderBabyAvatar() {
  const wrap = document.getElementById("baby-avatar-wrap");
  if (!wrap) return;

  const tag = document.getElementById("baby-name-tag");

  if (state.hasEgg) {
    wrap.hidden = false;
    document.getElementById("baby-avatar").innerHTML = eggSVG(eggStage());
    tag.hidden = true;
    return;
  }
  if (!state.hasBaby) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  document.getElementById("baby-avatar").innerHTML = petSVG(state.petType, "happy", 1);
  tag.hidden = false;
  tag.textContent = state.babyName;
}

function hatchEgg() {
  state.hasEgg = false;
  state.hasBaby = true;
  state.babyName = BABY_NAMES[state.petType] || "Lillen";
  saveState();
  renderBabyAvatar();
  showToast("Ägget kläcktes! 🐣", true);
  burstConfetti(50);
}

// Körs vid varje start och vid varje ny nivå: lägger ägget, visar nya
// sprickor en gång var, och kläcker när tiden är inne.
function checkEggAndBaby() {
  if (!state.hasEgg && !state.hasBaby && state.level >= state.eggLevel) {
    state.hasEgg = true;
    state.eggFoundAt = new Date().toISOString();
    state.eggStageSeen = 0;
    saveState();
    renderBabyAvatar();
    showToast("Ett ägg! 🥚", true);
    burstConfetti(30);
    return;
  }

  if (!state.hasEgg) return;

  const stage = eggStage();
  if (stage >= EGG_HATCH_DAYS) {
    hatchEgg();
    return;
  }
  if (stage > state.eggStageSeen) {
    state.eggStageSeen = stage;
    saveState();
    renderBabyAvatar();
    showToast("Ägget spricker! 🥚", true);
    burstConfetti(20);
  }
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
    const reward = rewardForTask(taskId);
    if (reward === "food") state.food = clamp(state.food + 1, 0, MAX_FOOD);
    else state.love = clamp(state.love + 1, 0, MAX_LOVE);
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
    flashMood(reward === "food" ? "yum" : "love", 900);
    floatEmojiFromPet(reward === "food" ? petCfg().foodEmoji : "💚");

    if (leveledUp) {
      setTimeout(() => {
        showToast(pick(LEVEL_UP_MESSAGES), true);
        burstConfetti(30);
      }, 350);

      const newAccessory = artFor(state.petType).idle.find(
        (t) => t.level > levelBefore && t.level <= state.level
      );
      const newSizeTier = [7, 14, 20].find((l) => l > levelBefore && l <= state.level);
      let extraDelay = 900;
      if (newAccessory) {
        setTimeout(() => {
          showToast(`Nytt utseende: ${newAccessory.label}! ✨`, true);
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

      checkEggAndBaby();
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
  state.hunger = clamp(state.hunger + 12, 0, 100);
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
  checkEggAndBaby();
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
// Föräldrapåfyllning. Två vägar in, för en app som ligger på hemskärmen har
// egen lagring skild från webbläsarens: en länk som öppnas i webbläsaren når
// alltså inte den kopia Olle använder. Därför finns påfyllningen också inuti
// appen, bakom ett långt tryck på nivåbrickan som han inte råkar göra.
function topUp() {
  state.hunger = 100;
  state.happiness = 100;
  state.food = MAX_FOOD;
  state.love = MAX_LOVE;
  state.lastStatDecayAt = new Date().toISOString();
  saveState();
  updateStatsUI();
  showToast("Påfyllt! 🍀", true);
  burstConfetti(30);
}

// Öppna appen med ?fyll=1 för att fylla lagret, och ?niva=2 för att sätta
// nivån. Erfarenheten rörs inte, så mätaren står kvar där den var.
// Parametrarna plockas bort ur adressen direkt, så en omladdning inte gör om
// det och han inte blir kvar på en länk som ändrar läget varje gång.
function applyUrlActions() {
  const params = new URLSearchParams(location.search);
  const fyll = params.get("fyll") === "1";
  const niva = parseInt(params.get("niva"), 10);
  const bytNiva = Number.isFinite(niva) && niva >= 1 && niva <= 99;
  if (!fyll && !bytNiva) return;

  params.delete("fyll");
  params.delete("niva");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + (rest ? "?" + rest : ""));

  if (!state.petType) return;

  if (bytNiva) {
    state.level = niva;
    saveState();
    showToast("Nivå " + niva + "! 🌟", true);
  }
  if (fyll) topUp();
  else updateStatsUI();
}

// Fem snabba tryck på nivåbrickan. Ett långt tryck lät smidigare men fungerar
// dåligt med finger: pekskärmen skickar små rörelser hela tiden, och webbläsaren
// lägger sig i med markering och långtrycksmeny. Tryck är entydiga.
const TOP_UP_TAPS = 5;
const TOP_UP_WINDOW_MS = 3000;

function initTopUpTaps() {
  const badge = document.getElementById("pet-level");
  if (!badge) return;

  let taps = 0;
  let timer = null;

  badge.addEventListener("click", () => {
    taps += 1;
    clearTimeout(timer);

    // liten puff som kvitto, och tydligare ju närmare man kommer
    badge.classList.remove("tapped");
    void badge.offsetWidth;
    badge.classList.add("tapped");
    if (taps >= 3) badge.textContent = "Nivå " + state.level + " " + "•".repeat(taps - 2);

    if (taps >= TOP_UP_TAPS) {
      taps = 0;
      updateStatsUI();
      if (confirm("Fylla på mat och kramar?")) topUp();
      return;
    }

    timer = setTimeout(() => {
      taps = 0;
      updateStatsUI();
    }, TOP_UP_WINDOW_MS);
  });
}

function init() {
  loadExtras();
  handleDailyReset();
  applyStatDecay();
  applyUrlActions();
  if (state.petType) recordToday();
  initAppEvents();
  initTopUpTaps();
  registerServiceWorker();
  fetchExtras();
  syncStateToWorker();

  // hämta om när appen kommer fram igen, så nya extrauppgifter dyker upp
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      fetchExtras();
      syncStateToWorker();
    }
  });

  if (state.petType) {
    showAppScreen();
  } else {
    document.getElementById("screen-start").classList.add("active");
    initStartScreen();
  }
}

document.addEventListener("DOMContentLoaded", init);
