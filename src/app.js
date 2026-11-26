// Draws the screens and handles taps. The rules live in week.js.

import {
  DEFAULT_GOAL,
  dateString,
  dayName,
  parseList,
  newWeek,
  replaceItems,
  findDay,
  startDay,
  missedDates,
  dropEmptyDays,
  toggleItem,
  finishedDayCount,
} from "./week.js";
import { awardFinish, unopenedGifts, openGift } from "./rewards.js";
import { shortDate, summarize, dayLog, weekStreak, totals, recentWeeks } from "./history.js";
import { goldenCount, prizeProgress } from "./prize.js";
import { makeBackup, readBackup } from "./backup.js";
import { MAX_ON_SCENE, MIN_SIZE, MAX_SIZE, addToScene, moveInScene, resizeInScene, removeFromScene } from "./scene.js";
import { SETS, ALL_STICKERS } from "../data/stickers.js";
import { load, save } from "./storage.js";

const app = document.getElementById("app");
let state = load();
let screen = "home";
let justOpened = null; // what was inside the gift that was just opened
let justChecked = null; // the item that was just checked, so its box can pop
let sceneHop = null; // the key of a placed sticker that was just tapped, so it can hop once
let sceneSelected = null; // the key of the sticker picked on the scene, if any
let practiceOn = null; // an earlier day being recorded or changed; null means today
const calmMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const today = () => dateString(new Date());
// How many practice days a week to aim for. Set in the grown-ups area.
const goal = () => state.goal || DEFAULT_GOAL;

function update(changes) {
  state = { ...state, ...changes };
  save(state);
}

function go(name) {
  if (name === "home") {
    // Leaving for home tidies up anything half-shown on another screen.
    justOpened = null;
    prizeDraft = null;
    backupNote = "";
    restoreDraft = null;
    practiceOn = null;
    sceneSelected = null;
    // A day that was started but left with nothing checked is put away.
    if (state.week && dropEmptyDays(state.week) !== state.week) update({ week: dropEmptyDays(state.week) });
  }
  screen = name;
  render();
  window.scrollTo(0, 0);
}

// Small helper for building page elements without writing HTML strings.
// Text always goes in as text, so nothing typed into the list can run as code.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "onClick") node.addEventListener("click", value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

function icon(name) {
  const paths = {
    check: "M5 13l5 5L20 7",
    star: "M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z",
    plus: "M12 5v14M5 12h14",
    flame: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z",
    moon: "M16 4a9 9 0 1 0 5 13A7.500 7.500 0 0 1 16 4z",
    home: "M4 11l8-7 8 7M6 9.500V20h4v-6h4v6h4V9.500",
    history: "M5 6h14v14H5zM5 10.500h14M9 3.500V7M15 3.500V7M9 14.500l2 2 4-4",
    album: "M5 5h14v9l-5 5H5zM14 19v-5h5",
    scene: "M4 6h16v12H4zM4 16l5-5 4 4 3-3 4 4",
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", `icon icon-${name}`);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths[name]);
  svg.append(path);
  return svg;
}

function button(label, onClick, kind = "plain") {
  return el("button", { class: `btn btn-${kind}`, type: "button", onClick }, label);
}

// ---------- Home ----------

function homeScreen() {
  const week = state.week;
  if (!week) {
    return [
      topBar("Piano Stars"),
      el("section", { class: "card" },
        el("h2", {}, state.lastItems.length ? "Start your new week" : "Start your first week"),
        el("p", {}, "Add the list from your teacher's note, then check things off each day you practice."),
        button("Add this week's list", () => go("list"), "main")
      ),
      tiles(),
      state.history.length > 0 && weeksCard(),
      prizeCard(),
      holdButton(),
    ];
  }

  const done = finishedDayCount(week);
  const todayDay = findDay(week, today());
  let action;
  if (!todayDay) {
    action = button("Start today's practice", startToday, "gold");
  } else if (!todayDay.finished) {
    action = button("Keep practicing", () => go("practice"), "gold");
  } else {
    action = el("div", { class: "sky-done" },
      el("p", {}, icon("check"), " Today's practice is done."),
      button("Change today's checks", () => go("practice"), "ghost")
    );
  }

  // The sky holds the one main thing to do next. A waiting gift comes first.
  const waiting = unopenedGifts(week).length;
  if (waiting > 0) {
    action = el("div", { class: "sky-done" },
      el("p", {}, waiting === 1 ? "You have a gift to open." : `You have ${waiting} gifts to open.`),
      button(waiting === 1 ? "Open your gift" : "Open your gifts", () => go("gift"), "gold"),
      !todayDay && button("Start today's practice", startToday, "ghost"),
      todayDay && !todayDay.finished && button("Keep practicing", () => go("practice"), "ghost")
    );
  }
  return [
    topBar("This week's practice"),
    skyHero(done, action),
    tiles(),
    weeksCard(),
    el("section", { class: "card" },
      el("h2", {}, "Your list"),
      weekGrid(week, null),
      el("div", { class: "quiet-row" },
        button("Change the list", () => go("list"), "quiet"),
        button("Start a new week", () => go("new-week"), "quiet")
      )
    ),
    prizeCard(),
    holdButton(),
  ];
}

// Shown at the top of every screen except home: one tap back to home.
function homeBar() {
  return el("nav", { class: "home-bar" },
    el("button", { class: "btn home-btn", type: "button", onClick: () => go("home") }, icon("home"), " Home"));
}

// The page title with the star total.
function topBar(title) {
  return el("div", { class: "top" },
    el("h1", {}, title),
    el("span", { class: "star-count", "aria-label": `${state.stars} stars` }, icon("star"), ` ${state.stars}`)
  );
}

// The ways into the other pages: a row of big tiles, each with a picture.
function tiles() {
  const have = ALL_STICKERS.filter((sticker) => state.owned[sticker.id]).length;
  const tile = (name, label, note, screenName) =>
    el("button", { class: `tile tile-${name}`, type: "button", onClick: () => go(screenName) },
      el("span", { class: "tile-icon" }, icon(name)),
      el("span", { class: "tile-text" }, el("strong", {}, label), el("span", {}, note)));
  return el("nav", { class: "tiles", "aria-label": "Pages" },
    tile("album", "Stickers", `${have} of ${ALL_STICKERS.length}`, "album"),
    tile("scene", "My scene", "Place your stickers", "scene"),
    tile("history", "History", "Every practice", "history"));
}

function goalMessage(done) {
  const left = goal() - done;
  if (done === 0) return `Your goal is ${goal()} practice days this week.`;
  if (left > 1) return `${done} of ${goal()} done. ${left} more to reach your goal.`;
  if (left === 1) return `${done} of ${goal()} done. One more to reach your goal.`;
  if (left === 0) return "You reached your goal this week.";
  return `You reached your goal, plus ${-left} extra.`;
}

// ---------- The home screen pictures ----------

// A five-pointed star as SVG path data, centered on (cx, cy).
function starPath(cx, cy, outer) {
  const inner = outer * 0.46;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }
  return d + "Z";
}

// Shared paint for the sky pictures: gold for stars, glows, and the moon.
const SKY_DEFS = `<defs>
  <radialGradient id="gold" cx="0.380" cy="0.300" r="0.800"><stop offset="0" stop-color="#fff4b8"/><stop offset="0.450" stop-color="#ffd24d"/><stop offset="1" stop-color="#f5a31c"/></radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffd257" stop-opacity="0.550"/><stop offset="1" stop-color="#ffd257" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonlight"><stop offset="0" stop-color="#cfc8ff" stop-opacity="0.350"/><stop offset="1" stop-color="#cfc8ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="staffline" gradientUnits="userSpaceOnUse" x1="16" x2="584" y1="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.150" stop-color="#ffffff" stop-opacity="0.300"/><stop offset="0.850" stop-color="#ffffff" stop-opacity="0.300"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
</defs>`;

// A friendly star: rounded points, a glow, shading, and a small face.
// `awake` stars are gold and smiling; the others are outlines, asleep.
function starArt(x, y, r, awake) {
  const shape = starPath(x, y, r);
  const eye = r * 0.270;
  if (!awake) {
    return `<path d="${shape}" class="star-todo"/>`
      + `<path d="M${x - eye - 3} ${y + 1}q3 3 6 0M${x + eye - 3} ${y + 1}q3 3 6 0" class="star-sleep"/>`;
  }
  return `<circle cx="${x}" cy="${y}" r="${r * 2.100}" fill="url(#glow)"/>`
    + `<path d="${shape}" class="star-edge" stroke-width="${r * 0.420}"/>`
    + `<path d="${shape}" class="star-body" stroke-width="${r * 0.250}"/>`
    + `<ellipse cx="${x - r * 0.300}" cy="${y - r * 0.420}" rx="${r * 0.200}" ry="${r * 0.100}" class="star-glint" transform="rotate(-30 ${x - r * 0.300} ${y - r * 0.420})"/>`
    + `<circle cx="${x - eye}" cy="${y}" r="${r * 0.095}" class="star-eye"/><circle cx="${x + eye}" cy="${y}" r="${r * 0.095}" class="star-eye"/>`
    + `<path d="M${x - r * 0.190} ${y + r * 0.230}q${r * 0.190} ${r * 0.200} ${r * 0.380} 0" class="star-smile" stroke-width="${r * 0.085}"/>`
    + `<circle cx="${x - r * 0.500}" cy="${y + r * 0.200}" r="${r * 0.110}" class="star-cheek"/><circle cx="${x + r * 0.500}" cy="${y + r * 0.200}" r="${r * 0.110}" class="star-cheek"/>`;
}

// This week as a night sky. Each practice day is a star sitting on a music
// staff like a note: gold and smiling once it's done, an outline asleep
// while it's still to come.
function skyHero(done, action) {
  const slots = Math.max(goal(), done);
  const heights = [126, 104, 82, 104, 126, 82, 60]; // which staff line each star sits on
  const width = 600;
  const gap = slots > 1 ? Math.min(110, 420 / (slots - 1)) : 0;
  const first = width / 2 - (gap * (slots - 1)) / 2;
  let art = SKY_DEFS;
  // Far-off stars, a few sparkles, and a crescent moon with a soft glow.
  for (const [x, y, r, o] of [[40, 30, 1.6, 0.7], [96, 64, 1, 0.45], [150, 18, 1.3, 0.6], [214, 44, 0.9, 0.4], [268, 22, 1.7, 0.7], [330, 50, 1, 0.45], [372, 14, 1.3, 0.6], [430, 40, 0.9, 0.4], [86, 176, 1.3, 0.5], [190, 186, 0.9, 0.4], [330, 180, 1.6, 0.6], [452, 188, 1, 0.45], [560, 172, 1.3, 0.55], [20, 120, 1, 0.4], [582, 110, 1, 0.4]]) {
    art += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o}"/>`;
  }
  art += `<g class="sky-sparkle">${sparkle(120, 34, 6)}${sparkle(470, 18, 4.500)}${sparkle(40, 160, 4)}</g>`;
  art += `<circle cx="536" cy="42" r="46" fill="url(#moonlight)"/>`
    + `<path d="M546 18a26 26 0 1 0 16 38a21 21 0 0 1-16-38z" class="moon"/>`;
  for (const y of [60, 82, 104, 126, 148]) {
    art += `<line x1="16" x2="${width - 16}" y1="${y}" y2="${y}" class="staff"/>`;
  }
  for (let i = 0; i < slots; i++) {
    const x = first + gap * i;
    const y = heights[i % heights.length];
    if (i < done) {
      art += `<line x1="${x + 24}" x2="${x + 24}" y1="${y - 6}" y2="${y - 66}" class="stem"/>` + starArt(x, y, 27, true);
    } else {
      art += starArt(x, y, 23, false);
    }
  }
  const sky = el("div", { class: "sky-art", role: "img",
    "aria-label": `${done} of ${goal()} practice days done this week` });
  sky.innerHTML = `<svg viewBox="0 0 ${width} 200" aria-hidden="true">${art}</svg>`;

  return el("section", { class: "sky" },
    sky,
    el("p", { class: "sky-message" }, goalMessage(done)),
    action
  );
}

// The last few weeks as a row of star stacks: one star per practice day.
// A week that reached its goal gets a check, and the weeks in the current
// streak are joined by a gold line.
function weeksCard() {
  const weeks = recentWeeks(state.history, state.week, goal(), 8);
  const streak = weekStreak(state.history, state.week, goal());
  const sum = totals(state.history, state.week, goal());
  // The gold line runs from the first week of the streak to the last,
  // passing through any holiday weeks in between.
  const inStreak = weeks.map((week, index) => (week.inStreak ? index : -1)).filter((index) => index >= 0);
  const lineStart = inStreak.length ? inStreak[0] : -1;
  const lineEnd = inStreak.length ? inStreak[inStreak.length - 1] : -1;

  const columns = weeks.map((week, index) => {
    const before = index > lineStart && index <= lineEnd;
    const after = index >= lineStart && index < lineEnd;
    const stars = [];
    for (let i = 0; i < Math.min(week.days, 7); i++) stars.push(el("span", { class: "mini-star" }, icon("star")));
    let mark;
    if (week.holiday) mark = el("span", { class: "mark mark-holiday" }, icon("moon"));
    else if (week.met) mark = el("span", { class: "mark mark-met" }, icon("check"));
    else mark = el("span", { class: "mark" });
    return el("div", { class: `week-col ${week.met ? "week-met" : ""} ${week.current ? "week-now" : ""}` },
      el("div", { class: "week-stars" }, stars),
      el("div", { class: `week-mark ${before ? "link-left" : ""} ${after ? "link-right" : ""}` }, mark),
      el("span", { class: "week-label" }, week.current ? "Now" : shortDate(week.startedOn))
    );
  });

  const described = weeks.map((week) =>
    `${week.current ? "This week" : `Week of ${shortDate(week.startedOn)}`}: ${week.days} practice ${week.days === 1 ? "day" : "days"}${week.met ? ", goal reached" : ""}${week.holiday ? ", holiday" : ""}`
  ).join(". ");

  let streakLine;
  if (streak > 1) streakLine = `${streak} weeks in a row reaching your goal.`;
  else if (streak === 1) streakLine = "1 week reaching your goal. Keep the line going next week.";
  else streakLine = "Reach your goal this week to start a streak.";

  return el("section", { class: "card" },
    el("h2", {}, "Your weeks"),
    el("div", { class: "weeks", role: "img", "aria-label": described }, columns),
    el("p", { class: `streak-line ${streak > 0 ? "streak-on" : ""}` }, streak > 0 && icon("flame"), ` ${streakLine}`),
    el("div", { class: "tally" },
      el("div", {}, el("strong", {}, String(sum.practiceDays)), sum.practiceDays === 1 ? " practice day" : " practice days"),
      el("div", {}, el("strong", {}, String(sum.goalsReached)), sum.goalsReached === 1 ? " goal reached" : " goals reached"))
  );
}

function startToday() {
  update({ week: startDay(state.week, today()) });
  go("practice");
}

// ---------- The checklist grid ----------

// One row per item, one column per practice day. `activeDate` is the day
// whose boxes can be tapped; pass null for a look-only grid.
function weekGrid(week, activeDate) {
  const table = el("table", { class: "grid" });
  const head = el("tr", {}, el("th", {}, ""));
  for (const day of week.days) {
    const isActive = day.date === activeDate;
    head.append(
      el("th", { class: isActive ? "col-active" : "" },
        day.date === today() ? "Today" : dayName(day.date))
    );
  }
  table.append(head);

  for (const item of week.items) {
    const row = el("tr", {}, el("td", { class: "item-text" }, item.text));
    for (const day of week.days) {
      const checked = day.done.includes(item.id);
      if (day.date === activeDate) {
        row.append(el("td", {},
          el("button", {
            class: `box box-tap ${checked ? "box-on" : ""} ${checked && justChecked === item.id ? "box-pop" : ""}`,
            type: "button",
            "aria-pressed": String(checked),
            "aria-label": `${item.text}: ${checked ? "done" : "not done yet"}`,
            onClick: () => {
              justChecked = checked ? null : item.id;
              update({ week: toggleItem(state.week, day.date, item.id) });
              render();
              if (justChecked) burst(app.querySelector(".box-pop"));
              justChecked = null;
            },
          }, checked ? icon("check") : null)
        ));
      } else {
        row.append(el("td", {},
          el("span", {
            class: `box ${checked ? "box-on" : ""}`,
            role: "img",
            "aria-label": checked ? "done" : "not done",
          }, checked ? icon("check") : null)
        ));
      }
    }
    table.append(row);
  }
  return el("div", { class: "grid-wrap" }, table);
}

// ---------- Practice ----------

function practiceScreen() {
  const week = state.week;
  const day = findDay(week, practiceOn || today());
  if (!day) return homeScreen();
  const total = week.items.length;
  return [
    el("h1", {}, day.date === today() ? "Today's practice" : `Practice on ${longDate(day.date)}`),
    el("section", { class: "card" },
      el("p", { class: "label" }, `${day.done.length} of ${total} checked`),
      weekGrid(week, day.date),
      el("div", { class: "row" },
        button("Finish practice", () => {
          update(awardFinish(state.week, day.date, state.stars, goal()));
          go("finished");
        }, "main")
      )
    ),
  ];
}

// A big smiling star with rays behind it, for the moments worth cheering.
function bigStar() {
  let rays = "";
  for (let i = 0; i < 12; i++) {
    rays += `<path d="M100 100L${i % 2 ? 94 : 91} ${i % 2 ? 30 : 12}h${i % 2 ? 12 : 18}z" transform="rotate(${i * 30} 100 100)"/>`;
  }
  const star = el("div", { class: "big-star", "aria-hidden": "true" });
  star.innerHTML = `<svg viewBox="0 0 200 200">${SKY_DEFS}<g class="rays">${rays}</g>${starArt(100, 104, 54, true)}</svg>`;
  return star;
}

// The moment after "Finish practice": the sky, a big star, and confetti.
function finishedScreen() {
  const week = state.week;
  const day = findDay(week, practiceOn || today());
  const total = week.items.length;
  const count = day ? day.done.length : 0;
  const when = day && day.date !== today() ? `on ${longDate(day.date)}` : "today";
  const headline = count === total ? "You did everything on your list!" : "Practice done!";
  const stars = day ? day.stars : 0;
  const waiting = unopenedGifts(week).length;
  return [
    el("section", { class: "sky finish" },
      confetti(),
      bigStar(),
      el("h1", {}, headline),
      el("p", { class: "finish-stars" }, icon("star"), ` +${stars} ${stars === 1 ? "star" : "stars"}`),
      el("p", {}, `${count} of ${total} checked ${when}. ${goalMessage(finishedDayCount(week))}`),
      waiting > 0
        ? button(waiting === 1 ? "Open your gift" : "Open your gifts", () => go("gift"), "gold")
        : button("Done", () => go("home"), "gold")
    ),
  ];
}

// ---------- Gifts ----------

const GIFT_NAMES = { small: "A gift", big: "A big gift", golden: "A golden gift" };

// A gift box drawn with soft shading: light from the top left, a shadow on
// the ground, and a ribbon with a bow. The lid is its own group so it can
// lift off when the gift is opened.
function giftBox(kind) {
  const [light, dark, edge, ribbonLight, ribbonDark] = {
    small: ["#9a8cf5", "#5a4cc4", "#372d8c", "#ffdb70", "#f0a52a"],
    big: ["#6fdaec", "#2a94b8", "#1c6a86", "#ff9b8a", "#e2504c"],
    golden: ["#ffe58a", "#f2a51e", "#a8700c", "#ffffff", "#e4dcff"],
  }[kind];
  const box = el("div", { class: `gift-art gift-${kind}` });
  box.innerHTML = `<svg viewBox="0 -16 48 66" aria-hidden="true">
    <defs>
      <linearGradient id="gift-side-${kind}" x1="0" y1="0" x2="0.300" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="gift-ribbon-${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ribbonLight}"/><stop offset="1" stop-color="${ribbonDark}"/></linearGradient>
    </defs>
    <ellipse cx="24" cy="45.500" rx="19" ry="3" fill="rgba(29,26,58,0.18)"/>
    <rect x="7" y="19" width="34" height="25" rx="4" fill="url(#gift-side-${kind})" stroke="${edge}" stroke-width="1.500"/>
    <rect x="7.750" y="20" width="32.500" height="5.500" fill="rgba(20,16,60,0.16)"/>
    <rect x="20.500" y="19.750" width="7" height="23.500" fill="url(#gift-ribbon-${kind})"/>
    <rect x="10.500" y="27" width="3" height="13" rx="1.500" fill="rgba(255,255,255,0.38)"/>
    <g class="lid">
      <path d="M24 11.500c-3-9.500-13.500-8.500-11.500-2.500 1.500 4 7 3.200 11.500 2.500z" fill="url(#gift-ribbon-${kind})" stroke="${edge}" stroke-width="1.300" stroke-linejoin="round"/>
      <path d="M24 11.500c3-9.500 13.500-8.500 11.500-2.500-1.500 4-7 3.200-11.500 2.500z" fill="url(#gift-ribbon-${kind})" stroke="${edge}" stroke-width="1.300" stroke-linejoin="round"/>
      <rect x="4" y="11" width="40" height="10" rx="3.500" fill="url(#gift-side-${kind})" stroke="${edge}" stroke-width="1.500"/>
      <rect x="20.500" y="11.750" width="7" height="8.500" fill="url(#gift-ribbon-${kind})"/>
      <rect x="7" y="13" width="11" height="2.200" rx="1.100" fill="rgba(255,255,255,0.5)"/>
      <circle cx="24" cy="11" r="3" fill="url(#gift-ribbon-${kind})" stroke="${edge}" stroke-width="1.300"/>
    </g>
    ${kind === "golden" ? sparkle(5, 2, 4) + sparkle(44, -6, 3) + sparkle(46, 30, 2.500) : ""}
  </svg>`;
  return box;
}

// A burst of paper bits for the moment a sticker appears. It is only for
// show, so screen readers skip it, and it is left out for people who ask
// their device for less motion.
function confetti() {
  if (calmMotion()) return null;
  const colors = ["#ffc93c", "#ff7a6b", "#5b4fc4", "#3fc1c9", "#7ed492"];
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const bit = el("span", { class: "bit" });
    bit.style.left = `${4 + ((i * 37) % 92)}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${(i % 7) * 0.07}s`;
    bit.style.setProperty("--turn", `${(i % 2 ? 1 : -1) * (200 + i * 23)}deg`);
    bits.push(bit);
  }
  return el("div", { class: "confetti", "aria-hidden": "true" }, bits);
}

// A small puff of paper bits flying out of a box that was just checked.
// It sits on top of the page for under a second and then removes itself.
function burst(box) {
  if (!box || calmMotion()) return;
  const colors = ["#ffc93c", "#ff7a6b", "#5b4fc4", "#3fc1c9", "#7ed492"];
  const place = box.getBoundingClientRect();
  const puff = el("div", { class: "burst", "aria-hidden": "true" });
  puff.style.left = `${place.left + place.width / 2}px`;
  puff.style.top = `${place.top + place.height / 2}px`;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.25 : 0);
    const far = 46 + (i % 3) * 16;
    const bit = el("span", { class: "spark" });
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty("--dx", `${(Math.cos(angle) * far).toFixed(0)}px`);
    bit.style.setProperty("--dy", `${(Math.sin(angle) * far - 14).toFixed(0)}px`);
    bit.style.setProperty("--turn", `${(i % 2 ? 1 : -1) * (160 + i * 20)}deg`);
    puff.append(bit);
  }
  document.body.append(puff);
  setTimeout(() => puff.remove(), 800);
}

// One shared look for every sticker, so they all match however they were
// drawn: an even dark outline, a white cut-out border like a real sticker,
// a soft shadow underneath, and a glossy highlight from the top left.
// It is an SVG filter, added to the page once and used by every sticker.
const STICKER_LOOK = `<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="sticker-look" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="inkShape"/>
    <feFlood flood-color="#2a2452"/><feComposite in2="inkShape" operator="in" result="ink"/>
    <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="wide"/>
    <feGaussianBlur in="wide" stdDeviation="0.9"/>
    <feComponentTransfer result="cutShape"><feFuncA type="linear" slope="8" intercept="-3.500"/></feComponentTransfer>
    <feFlood flood-color="#ffffff"/><feComposite in2="cutShape" operator="in" result="cut"/>
    <feGaussianBlur in="cutShape" stdDeviation="1.1"/><feOffset dy="1.600" result="low"/>
    <feFlood flood-color="#1d1a3a" flood-opacity="0.32"/><feComposite in2="low" operator="in" result="shadow"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.500" result="soft"/>
    <feSpecularLighting in="soft" surfaceScale="3.500" specularConstant="0.650" specularExponent="16" lighting-color="#ffffff" result="light">
      <feDistantLight azimuth="235" elevation="52"/>
    </feSpecularLighting>
    <feComposite in="light" in2="SourceAlpha" operator="in" result="gloss"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="cut"/><feMergeNode in="ink"/><feMergeNode in="SourceGraphic"/><feMergeNode in="gloss"/></feMerge>
  </filter>
  <radialGradient id="shine-glow"><stop offset="0.350" stop-color="#ffd257" stop-opacity="0.750"/><stop offset="1" stop-color="#ffd257" stop-opacity="0"/></radialGradient>
</svg>`;
document.body.insertAdjacentHTML("beforeend", STICKER_LOOK);

// A four-point sparkle, used on shiny stickers.
const sparkle = (x, y, r) =>
  `<path class="sparkle" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z"/>`;

function stickerArt(sticker, shiny) {
  const art = el("div", { class: `sticker ${shiny ? "sticker-shiny" : ""}` });
  art.innerHTML = `<svg viewBox="-6 -6 60 60" aria-hidden="true">`
    + (shiny ? `<circle class="shine" cx="24" cy="24" r="27"/>` : "")
    + `<g filter="url(#sticker-look)">${sticker.art}</g>`
    + (shiny ? sparkle(45, 3, 6) + sparkle(3, 40, 4.5) + sparkle(49, 36, 3) : "")
    + `</svg>`;
  return art;
}

function giftScreen() {
  const waiting = unopenedGifts(state.week);

  if (justOpened) {
    const inside = justOpened;
    const next = waiting.length > 0
      ? button("Open the next gift", () => { justOpened = null; render(); }, "main")
      : button("Done", () => { justOpened = null; go("home"); }, "main");
    if (!inside.sticker) {
      return [el("section", { class: "card center" },
        bigStar(),
        el("h1", {}, "Your album is full"),
        el("p", {}, `You have every sticker, so this gift holds ${inside.bonusStars} extra stars.`),
        next)];
    }
    const set = SETS.find((s) => s.stickers.includes(inside.sticker));
    return [el("section", { class: "card center reveal-card" },
      confetti(),
      el("p", { class: "label" }, inside.shiny ? "New shiny sticker" : "New sticker"),
      el("div", { class: "reveal" }, stickerArt(inside.sticker, inside.shiny)),
      el("h1", {}, inside.sticker.name),
      el("p", {}, `It's in the ${set.name} page of your album.`),
      next)];
  }

  if (waiting.length === 0) return homeScreen();
  const gift = waiting[0];
  return [el("section", { class: "card center" },
    el("h1", {}, GIFT_NAMES[gift.kind]),
    el("button", {
      class: "gift-button", type: "button", "aria-label": "Open the gift",
      onClick: (event) => {
        const giftButton = event.currentTarget;
        if (giftButton.classList.contains("opening")) return;
        giftButton.classList.add("opening"); // the lid lifts off
        setTimeout(() => {
          const result = openGift(state.week, state.owned, state.stars,
            gift.date, gift.index, ALL_STICKERS, Math.random);
          justOpened = result.inside;
          update({ week: result.week, owned: result.owned, stars: result.stars });
          render();
        }, calmMotion() ? 0 : 700);
      },
    }, giftBox(gift.kind)),
    el("p", {}, "Tap the gift to open it."))];
}

// ---------- Sticker album ----------

function albumScreen() {
  const total = ALL_STICKERS.length;
  const have = ALL_STICKERS.filter((s) => state.owned[s.id]).length;
  return [
    el("div", { class: "top" },
      el("h1", {}, "Sticker album"),
      el("div", { class: "top-right" },
        el("span", { class: "star-count", "aria-label": `${state.stars} stars` }, icon("star"), ` ${state.stars}`))
    ),
    el("p", { class: "label" }, `${have} of ${total} stickers`),
    SETS.map((set) => {
      const count = set.stickers.filter((s) => state.owned[s.id]).length;
      return el("section", { class: "card" },
        el("h2", {}, `${set.name} `, el("span", { class: "label" }, `${count} of ${set.stickers.length}`)),
        el("div", { class: "album" }, set.stickers.map((sticker) => {
          const mine = state.owned[sticker.id];
          return mine
            ? el("div", { class: "slot" }, stickerArt(sticker, mine.shiny),
                el("span", { class: "slot-name" }, sticker.name))
            : el("div", { class: "slot slot-empty", role: "img", "aria-label": "Sticker not found yet" },
                el("div", { class: "sticker sticker-missing" }, el("span", {}, "?")),
                el("span", { class: "slot-name" }, " "));
        }))
      );
    }),
  ];
}

// ---------- This week's list ----------

function listScreen() {
  const editing = Boolean(state.week);
  const box = el("textarea", {
    id: "list-box",
    rows: "7",
    placeholder: "C major scale, hands together\nMinuet, bars 1 to 8, slowly\nTheory book page 14",
    "aria-label": "This week's list, one thing per line",
    "aria-describedby": "list-help",
  });
  if (editing) box.value = state.week.items.map((item) => item.text).join("\n");

  const preview = el("ol", { class: "preview" });
  const error = el("p", { class: "error", role: "alert" });
  const showPreview = () => {
    error.textContent = "";
    preview.replaceChildren(...parseList(box.value).map((text) => el("li", {}, text)));
  };
  box.addEventListener("input", showPreview);
  showPreview();

  const repeats = editing ? [] : state.lastItems;
  const repeatRow = repeats.length
    ? el("div", {},
        el("p", { class: "label" }, "From last week (tap to add)"),
        el("div", { class: "chips" }, repeats.map((text) =>
          el("button", {
            class: "chip", type: "button",
            onClick: (event) => {
              box.value = (box.value.trim() ? box.value.trimEnd() + "\n" : "") + text;
              event.currentTarget.remove();
              showPreview();
            },
          }, icon("plus"), text)
        ))
      )
    : null;

  const saveList = () => {
    const texts = parseList(box.value);
    if (texts.length === 0) {
      error.textContent = "Add at least one thing to practice.";
      return;
    }
    update({
      week: editing ? replaceItems(state.week, texts) : newWeek(texts, today()),
    });
    go("home");
  };

  return [
    el("h1", {}, editing ? "Change the list" : "This week's list"),
    el("section", { class: "card" },
      el("p", { id: "list-help" },
        "Put one thing on each line. You can type, paste a list, or tap the microphone on the keyboard and read your teacher's note out loud. Say \"new line\" between things."),
      box,
      repeatRow,
      el("p", { class: "label" }, "Your checklist will be"),
      preview,
      error,
      el("div", { class: "row" },
        button("Cancel", () => go("home")),
        button(editing ? "Save the list" : "Make my checklist", saveList, "main")
      )
    ),
  ];
}

// ---------- Start a new week ----------

function newWeekScreen() {
  if (unopenedGifts(state.week).length > 0) {
    return [
      el("h1", {}, "Start a new week"),
      el("section", { class: "card" },
        el("p", {}, "You still have a gift from this week. Open it first so it isn't lost."),
        el("div", { class: "row" },
          button("Back", () => go("home")),
          button("Open your gift", () => go("gift"), "main"))
      ),
    ];
  }
  return [
    el("h1", {}, "Start a new week"),
    el("section", { class: "card" },
      el("p", {}, "This puts away this week's checklist so you can add the list from your new teacher's note."),
      el("div", { class: "row" },
        button("Keep this week", () => go("home")),
        button("Start a new week", () => {
          update({
            lastItems: state.week.items.map((item) => item.text),
            history: [...state.history, summarize(state.week, goal())],
            week: null,
          });
          go("list");
        }, "main")
      )
    ),
  ];
}

// ---------- Prize and the grown-ups area ----------

function prizeCard() {
  if (!state.prize) return null;
  const progress = prizeProgress(state.prize, goldenCount(state.history, state.week));
  const dots = [];
  for (let i = 0; i < progress.need; i++) {
    dots.push(el("span", { class: `gold-dot ${i < progress.have ? "gold-dot-on" : ""}` },
      i < progress.have ? icon("star") : null));
  }
  return el("section", { class: `card ${progress.earned ? "gift-card" : ""}` },
    el("h2", {}, progress.earned ? "You earned your prize" : "Your prize"),
    el("p", { class: "prize-text" }, state.prize.text),
    el("div", { class: "dots", role: "img",
      "aria-label": `${progress.have} of ${progress.need} golden gifts` }, dots),
    el("p", { class: "label" }, progress.earned
      ? "Show this to a grown-up."
      : `${progress.have} of ${progress.need} golden gifts. You get one each week you reach your goal.`)
  );
}

// The way into the grown-ups area: press and hold for three seconds.
function holdButton() {
  const HOLD_MS = 3000;
  let timer = null;
  const btn = el("button", { class: "hold", type: "button" },
    el("span", { class: "hold-fill" }), el("span", { class: "hold-text" }, "Grown-ups: press and hold"));
  const start = () => {
    if (timer) return;
    btn.classList.add("holding");
    timer = setTimeout(() => { timer = null; go("parent"); }, HOLD_MS);
  };
  const stop = () => {
    clearTimeout(timer);
    timer = null;
    btn.classList.remove("holding");
  };
  btn.addEventListener("pointerdown", start);
  for (const name of ["pointerup", "pointerleave", "pointercancel", "blur"]) btn.addEventListener(name, stop);
  btn.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") start(); });
  btn.addEventListener("keyup", stop);
  btn.addEventListener("contextmenu", (event) => event.preventDefault());
  return el("div", { class: "hold-wrap" }, btn);
}

function stepper(label, value, min, max, onChange) {
  return el("div", { class: "stepper" },
    el("button", { class: "btn step-btn", type: "button", "aria-label": `${label}: one fewer`,
      onClick: () => { if (value > min) onChange(value - 1); } }, "−"),
    el("span", { class: "step-value", "aria-live": "polite" }, String(value)),
    el("button", { class: "btn step-btn", type: "button", "aria-label": `${label}: one more`,
      onClick: () => { if (value < max) onChange(value + 1); } }, "+")
  );
}

function toggle(label, on, onChange) {
  return el("button", { class: `btn toggle ${on ? "toggle-on" : ""}`, type: "button",
    "aria-pressed": String(on), onClick: () => onChange(!on) },
    on ? icon("check") : null, on ? ` ${label}: on` : `${label}: off`);
}

let prizeDraft = null; // the prize being typed in the grown-ups area

function parentScreen() {
  const week = state.week;
  const count = goldenCount(state.history, week);
  if (!prizeDraft) prizeDraft = { text: state.prize ? state.prize.text : "", need: state.prize ? state.prize.need : 5 };

  const prizeInput = el("input", { type: "text", class: "text-input", maxlength: "60",
    placeholder: "Movie night", "aria-label": "Prize" });
  prizeInput.value = prizeDraft.text;
  prizeInput.addEventListener("input", () => { prizeDraft.text = prizeInput.value; prizeError.textContent = ""; });
  const prizeError = el("p", { class: "error", role: "alert" });

  const recent = state.history.map((past, index) => ({ past, index })).reverse().slice(0, 6);

  return [
    el("div", { class: "top" },
      el("h1", {}, "Grown-ups"),
      button("Done", () => go("home"), "main")),

    el("section", { class: "card" },
      el("h2", {}, "Weekly goal"),
      el("p", {}, "Practice days to aim for each week."),
      stepper("Weekly goal", goal(), 1, 7, (value) => { update({ goal: value }); render(); })
    ),

    el("section", { class: "card" },
      el("h2", {}, "Holiday weeks"),
      el("p", {}, "A holiday week is skipped by the week streak: it doesn't add to it or end it."),
      week && el("div", { class: "holiday-row" },
        el("span", {}, `This week (from ${shortDate(week.startedOn)})`),
        toggle("Holiday", Boolean(week.holiday), (on) => { update({ week: { ...state.week, holiday: on } }); render(); })),
      recent.map(({ past, index }) => el("div", { class: "holiday-row" },
        el("span", {}, `Week of ${shortDate(past.startedOn)}: ${past.days} practice ${past.days === 1 ? "day" : "days"}`),
        toggle("Holiday", past.holiday, (on) => {
          update({ history: state.history.map((entry, i) => (i === index ? { ...entry, holiday: on } : entry)) });
          render();
        }))),
      !week && recent.length === 0 && el("p", { class: "label" }, "No weeks yet.")
    ),

    el("section", { class: "card" },
      el("h2", {}, "Prize"),
      el("p", {}, "A real-world treat earned with golden gifts. One golden gift is given each week the goal is reached."),
      prizeInput,
      el("p", { class: "label" }, "Golden gifts needed"),
      stepper("Golden gifts needed", prizeDraft.need, 1, 20, (value) => { prizeDraft.need = value; render(); }),
      prizeError,
      el("div", { class: "row" },
        state.prize && button(
          prizeProgress(state.prize, count).earned ? "Prize given: clear it" : "Remove the prize",
          () => { update({ prize: null }); prizeDraft = null; render(); }),
        button(state.prize ? "Save the prize" : "Set the prize", () => {
          const text = prizeDraft.text.trim();
          if (!text) { prizeError.textContent = "Type what the prize is."; return; }
          // Keep progress when only editing; start from now for a new prize.
          const base = state.prize ? state.prize.base : count;
          update({ prize: { text, need: prizeDraft.need, base } });
          render();
        }, "main"))
    ),

    backupCard(),
  ];
}

// ---------- Backup ----------

let backupNote = ""; // a short message shown in the backup card
let restoreDraft = null; // a backup file that was picked, waiting for a yes

async function saveBackup() {
  const name = `piano-stars-backup-${today()}.json`;
  const file = new File([makeBackup(state, today())], name, { type: "application/json" });
  // On an iPad this opens the share sheet ("Save to Files", AirDrop, ...).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "Backup made.";
    } catch (error) {
      if (error.name === "AbortError") return "";
    }
  }
  // Anywhere else, download the file.
  const link = el("a", { href: URL.createObjectURL(file), download: name });
  document.body.append(link);
  link.click();
  link.remove();
  return "Backup saved to your downloads.";
}

function restoreBackup(backup) {
  save(backup.state);
  state = load();
}

function backupCard() {
  if (restoreDraft) {
    return el("section", { class: "card gift-card" },
      el("h2", {}, "Replace everything on this device?"),
      el("p", {}, `This backup${restoreDraft.savedOn ? ` from ${shortDate(restoreDraft.savedOn)}` : ""} will replace the checklist, stars, stickers, and past weeks on this device.`),
      el("div", { class: "row" },
        button("Keep what's here", () => { restoreDraft = null; render(); }),
        button("Replace with the backup", async () => {
          const backup = restoreDraft;
          restoreDraft = null;
          try {
            restoreBackup(backup);
            backupNote = "Backup restored.";
          } catch {
            backupNote = "The backup couldn't be restored.";
          }
          prizeDraft = null;
          render();
        }, "main"))
    );
  }
  const input = el("input", { type: "file", accept: "application/json,.json", class: "file-input" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      restoreDraft = readBackup(await file.text());
      backupNote = "";
    } catch (error) {
      backupNote = error.message;
    }
    render();
  });
  return el("section", { class: "card" },
    el("h2", {}, "Backup"),
    el("p", {}, "Everything is stored only on this device. A backup is one file with the checklist, stars, stickers, and past weeks. Keep it somewhere safe, such as the Files app."),
    el("p", { class: "done-note", role: "status" }, backupNote),
    el("div", { class: "row" },
      button("Save a backup", async () => {
        try {
          backupNote = await saveBackup();
        } catch {
          backupNote = "The backup couldn't be made.";
        }
        render();
      }),
      el("label", { class: "btn file-label" }, input, "Restore from a backup"))
  );
}

// ---------- Practice history ----------

// "2026-11-14" -> "Sat, Nov 14"
const longDate = (date) => `${dayName(date)}, ${shortDate(date)}`;

// One line for one finished practice: the day, what was checked, the stars.
// `onChange`, when given, adds a button for changing that day's checks.
function logRow(entry, onChange) {
  return el("li", { class: "log-row" },
    el("span", { class: "log-date" }, entry.date === today() ? "Today" : longDate(entry.date)),
    el("span", { class: "log-checked" }, `${entry.checked} of ${entry.of} checked`),
    el("span", { class: "log-stars", "aria-label": `${entry.stars} ${entry.stars === 1 ? "star" : "stars"}` },
      icon("star"), ` ${entry.stars}`),
    onChange && el("button", { class: "btn log-change", type: "button",
      "aria-label": `Change the checks for ${longDate(entry.date)}`, onClick: onChange }, "Change"));
}

// Opens the checklist for one day of this week, today or earlier.
function practiceDay(date) {
  update({ week: startDay(state.week, date) });
  practiceOn = date === today() ? null : date;
  go("practice");
}

function weekSummaryLine(days, met, holiday) {
  return el("p", { class: met ? "done-note" : "" },
    met && icon("star"),
    ` ${days} practice ${days === 1 ? "day" : "days"}`,
    met ? ". Goal reached." : ".",
    holiday ? " Holiday week." : "");
}

function historyScreen() {
  const week = state.week;
  const weeks = [...state.history].reverse();
  const nowLog = week ? dayLog(week) : [];
  return [
    el("h1", {}, "Practice history"),
    week && el("section", { class: "card" },
      el("h2", {}, `This week (from ${shortDate(week.startedOn)})`),
      weekSummaryLine(nowLog.length, nowLog.length >= goal(), Boolean(week.holiday)),
      nowLog.length > 0
        ? el("ul", { class: "log" }, nowLog.map((entry) => logRow(entry, () => practiceDay(entry.date))))
        : el("p", { class: "label" }, "Each practice you finish shows up here."),
      missedDates(week, today()).length > 0
        && button("Add a day you missed", () => go("add-day"))),
    !week && weeks.length === 0 && el("section", { class: "card" },
      el("p", {}, "No practices yet. Each practice you finish shows up here.")),
    weeks.map((past) =>
      el("section", { class: "card" },
        el("h2", {}, `Week of ${shortDate(past.startedOn)}`),
        weekSummaryLine(past.days, past.met, past.holiday),
        past.log && past.log.length > 0 && el("ul", { class: "log" }, past.log.map((entry) => logRow(entry))),
        el("p", { class: "label" }, "The list that week"),
        el("ul", { class: "past-items" }, past.items.map((text) => el("li", {}, text)))
      )),
  ];
}

// ---------- Add a day you missed ----------

// For a practice that happened but wasn't checked off on the day. Only days
// since this week's list was added can be picked, and it is all taps.
function addDayScreen() {
  const dates = missedDates(state.week, today());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const label = (date) => (date === dateString(yesterday) ? `Yesterday (${longDate(date)})` : longDate(date));
  return [
    el("h1", {}, "Add a day you missed"),
    el("section", { class: "card" },
      dates.length > 0
        ? el("p", {}, "Tap the day you practiced. Then check off what you did.")
        : el("p", {}, "Every day this week is already here."),
      el("div", { class: "day-picks" }, dates.map((date) => button(label(date), () => practiceDay(date)))),
      el("div", { class: "row" }, button("Cancel", () => go("history")))
    ),
  ];
}

// ---------- Sticker scene ----------

// How wide a sticker is on the scene, as a percent of the picture, by size.
const SCENE_WIDTHS = { 1: 13, 2: 19, 3: 27 };

// A top-to-bottom color fade for a backdrop: fade("sea", "#fff", "#000").
const fade = (id, ...colors) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
  + colors.map((color, n) => `<stop offset="${n / (colors.length - 1)}" stop-color="${color}"/>`).join("") + `</linearGradient>`;
const dots = (list) => `<g fill="#ffffff">` + list.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join("") + `</g>`;

// The pictures the player can choose to put stickers on. Each is drawn on a
// 400 by 300 grid. The first one is used until another is picked. Ids are
// saved on the device, so don't change them.
const BACKDROPS = [
  { id: "hills", name: "Hills", art: `
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1650"/><stop offset="0.550" stop-color="#4b3aa8"/><stop offset="0.850" stop-color="#e58aa6"/><stop offset="1" stop-color="#ffc98a"/></linearGradient>
    <linearGradient id="hill-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a48b8"/><stop offset="1" stop-color="#3c2f8c"/></linearGradient>
    <linearGradient id="hill-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a8f7a"/><stop offset="1" stop-color="#1f6a5c"/></linearGradient>
    <linearGradient id="hill-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58b98f"/><stop offset="1" stop-color="#2f8a6a"/></linearGradient>
    <radialGradient id="scene-moon"><stop offset="0" stop-color="#fff6d6" stop-opacity="0.600"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="400" height="300" fill="url(#dusk)"/>
  <g fill="#ffffff"><circle cx="40" cy="30" r="1.400" opacity="0.800"/><circle cx="96" cy="62" r="1" opacity="0.600"/><circle cx="150" cy="24" r="1.300" opacity="0.700"/><circle cx="212" cy="50" r="1" opacity="0.500"/><circle cx="262" cy="20" r="1.400" opacity="0.800"/><circle cx="300" cy="84" r="1" opacity="0.500"/><circle cx="372" cy="110" r="1.200" opacity="0.600"/><circle cx="20" cy="100" r="1" opacity="0.500"/><circle cx="180" cy="96" r="1.100" opacity="0.500"/></g>
  <circle cx="330" cy="52" r="46" fill="url(#scene-moon)"/><circle cx="330" cy="52" r="20" fill="#fff6d6"/>
  <path d="M0 196C60 150 120 150 180 186S300 160 400 190V300H0z" fill="url(#hill-far)"/>
  <path d="M0 232C80 190 150 214 220 226S340 196 400 222V300H0z" fill="url(#hill-near)"/>
  <path d="M0 268C90 240 170 262 250 258S350 244 400 256V300H0z" fill="url(#hill-front)"/>` },
  { id: "space", name: "Space", art: `
  <defs>${fade("deep", "#0d0a2e", "#2a1f6e", "#4a2f8a")}${fade("ground", "#8d86b8", "#5d5690")}
    <radialGradient id="planet" cx="0.350" cy="0.300" r="0.800"><stop offset="0" stop-color="#ffb37a"/><stop offset="1" stop-color="#d9603f"/></radialGradient>
    <radialGradient id="planet2" cx="0.350" cy="0.300" r="0.800"><stop offset="0" stop-color="#8fe3e8"/><stop offset="1" stop-color="#2f8fb0"/></radialGradient></defs>
  <rect width="400" height="300" fill="url(#deep)"/>
  ${dots([[30, 40, 1.4, 0.8], [70, 110, 1, 0.5], [120, 28, 1.2, 0.7], [165, 80, 1, 0.5], [210, 36, 1.5, 0.8], [250, 120, 1, 0.5], [300, 30, 1.2, 0.7], [352, 150, 1, 0.5], [380, 60, 1.3, 0.7], [20, 170, 1, 0.5], [140, 150, 1.1, 0.5], [230, 180, 1, 0.4]])}
  <circle cx="318" cy="76" r="38" fill="url(#planet)"/><ellipse cx="318" cy="78" rx="62" ry="12" fill="none" stroke="#ffe0b0" stroke-width="5" transform="rotate(-16 318 78)"/>
  <circle cx="70" cy="64" r="18" fill="url(#planet2)"/>
  <path d="M0 240C70 214 150 232 220 226S340 214 400 232V300H0z" fill="url(#ground)"/>
  <g fill="#4d4680" opacity="0.550"><ellipse cx="80" cy="262" rx="26" ry="7"/><ellipse cx="210" cy="276" rx="34" ry="8"/><ellipse cx="330" cy="258" rx="22" ry="6"/></g>` },
  { id: "beach", name: "Beach", art: `
  <defs>${fade("day", "#6ec3f5", "#bfe8fb", "#ffe9c2")}${fade("sea", "#3fb6d8", "#1f86b8")}${fade("sand", "#ffe2a6", "#f2c377")}
    <radialGradient id="sunlight"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.800"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient></defs>
  <rect width="400" height="300" fill="url(#day)"/>
  <circle cx="86" cy="62" r="54" fill="url(#sunlight)"/><circle cx="86" cy="62" r="24" fill="#ffd95a"/>
  <g fill="#ffffff" opacity="0.900"><ellipse cx="250" cy="52" rx="34" ry="12"/><ellipse cx="276" cy="44" rx="22" ry="12"/><ellipse cx="340" cy="92" rx="26" ry="9"/></g>
  <rect y="170" width="400" height="70" fill="url(#sea)"/>
  <path d="M0 184q25-8 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.500"/>
  <path d="M0 232C80 214 160 236 240 226S340 216 400 228V300H0z" fill="url(#sand)"/>` },
  { id: "stage", name: "Stage", art: `
  <defs>${fade("hall", "#2a1140", "#4a1d5e")}${fade("curtain", "#d8455a", "#8f1f3c")}${fade("boards", "#c98a4e", "#8f5a2c")}
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.550"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#hall)"/>
  <path d="M120 0L60 236h130z" fill="url(#beam)"/><path d="M280 0L210 236h130z" fill="url(#beam)"/>
  <path d="M0 0h70c-6 80-22 160-30 232H0z" fill="url(#curtain)"/><path d="M400 0h-70c6 80 22 160 30 232h40z" fill="url(#curtain)"/>
  <path d="M0 0h400v26c-34 16-66 16-100 0-34 16-66 16-100 0-34 16-66 16-100 0-34 16-66 16-100 0z" fill="#b8324c"/>
  <path d="M0 232h400v68H0z" fill="url(#boards)"/>
  <g stroke="#7a4a22" stroke-width="1.500" opacity="0.600"><path d="M0 254h400M0 278h400"/></g>` },
];
const backdrop = () => BACKDROPS.find((entry) => entry.id === state.backdrop) || BACKDROPS[0];

// One sticker on the scene. It can be dragged with a finger or mouse, or
// moved with the arrow keys. A tap picks it, so the buttons below act on it.
function placedSticker(item) {
  const sticker = ALL_STICKERS.find((entry) => entry.id === item.id);
  if (!sticker) return null;
  const picked = item.key === sceneSelected;
  const node = el("button", {
    class: `placed ${picked ? "placed-on" : ""}`, type: "button",
    "aria-label": `${sticker.name}${picked ? ", picked" : ""}`, "aria-pressed": String(picked),
  }, stickerArt(sticker, Boolean(state.owned[item.id] && state.owned[item.id].shiny)));
  node.style.left = `${item.x}%`;
  node.style.top = `${item.y}%`;
  node.style.width = `${SCENE_WIDTHS[item.size]}%`;
  if (picked) node.dataset.picked = "yes";
  if (item.key === sceneHop) { node.firstChild.classList.add("hop"); sceneHop = null; }

  let drag = null;
  node.addEventListener("pointerdown", (event) => {
    drag = { board: node.parentElement.getBoundingClientRect(), fromX: event.clientX, fromY: event.clientY, moved: false, x: item.x, y: item.y };
    node.setPointerCapture(event.pointerId);
  });
  node.addEventListener("pointermove", (event) => {
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.fromX, event.clientY - drag.fromY) > 6) drag.moved = true;
    if (!drag.moved) return;
    drag.x = ((event.clientX - drag.board.left) / drag.board.width) * 100;
    drag.y = ((event.clientY - drag.board.top) / drag.board.height) * 100;
    node.style.left = `${drag.x}%`;
    node.style.top = `${drag.y}%`;
  });
  const drop = () => {
    if (!drag) return;
    const { x, y, moved } = drag;
    drag = null;
    sceneSelected = item.key;
    if (!moved) sceneHop = item.key; // a tap, not a drag
    update({ scene: moveInScene(state.scene, item.key, x, y) });
    render();
  };
  node.addEventListener("pointerup", drop);
  node.addEventListener("pointercancel", drop);
  node.addEventListener("keydown", (event) => {
    const steps = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[event.key];
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); sceneSelected = item.key; sceneHop = item.key; render(); return; }
    if (!steps) return;
    event.preventDefault();
    sceneSelected = item.key;
    update({ scene: moveInScene(state.scene, item.key, item.x + steps[0], item.y + steps[1]) });
    render();
  });
  return node;
}

function sceneScreen() {
  const scene = state.scene || [];
  const mine = ALL_STICKERS.filter((sticker) => state.owned[sticker.id]);
  const picked = scene.find((item) => item.key === sceneSelected);
  const full = scene.length >= MAX_ON_SCENE;
  const change = (next) => { update({ scene: next }); render(); };

  const board = el("div", { class: "scene" });
  board.innerHTML = `<svg class="scene-back" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${backdrop().art}</svg>`;
  board.append(...scene.map(placedSticker).filter(Boolean));
  // Tapping the picture itself lets go of the picked sticker.
  board.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".placed") || sceneSelected === null) return;
    sceneSelected = null;
    render();
  });

  return [
    el("h1", {}, "My sticker scene"),
    board,
    picked
      ? el("div", { class: "row scene-tools" },
          button("Bigger", () => change(resizeInScene(scene, picked.key, 1)), picked.size >= MAX_SIZE ? "off" : "plain"),
          button("Smaller", () => change(resizeInScene(scene, picked.key, -1)), picked.size <= MIN_SIZE ? "off" : "plain"),
          button("Take off", () => { sceneSelected = null; change(removeFromScene(scene, picked.key)); }))
      : el("p", { class: "label scene-hint" }, scene.length > 0
          ? "Drag a sticker to move it. Tap one to make it bigger, smaller, or take it off."
          : "Tap a sticker below to put it on the picture."),
    el("div", { class: "chips", role: "group", "aria-label": "Picture" }, BACKDROPS.map((entry) =>
      el("button", {
        class: `chip ${entry.id === backdrop().id ? "chip-on" : ""}`, type: "button",
        "aria-pressed": String(entry.id === backdrop().id),
        onClick: () => { update({ backdrop: entry.id }); render(); },
      }, entry.name))),
    el("section", { class: "card" },
      el("h2", {}, "Your stickers"),
      mine.length === 0 && el("p", {}, "Open a gift to get your first sticker."),
      full && el("p", { class: "label" }, `The picture is full (${MAX_ON_SCENE} stickers). Take one off to add another.`),
      el("div", { class: "tray" }, mine.map((sticker) =>
        el("button", {
          class: "tray-pick", type: "button", "aria-label": `Add ${sticker.name} to the picture`,
          onClick: () => {
            if (full) return;
            const next = addToScene(scene, sticker.id);
            sceneSelected = next[next.length - 1].key;
            change(next);
            window.scrollTo(0, 0);
          },
        }, stickerArt(sticker, state.owned[sticker.id].shiny))))
    ),
  ];
}

// ---------- Drawing ----------

const SCREENS = {
  home: homeScreen,
  practice: practiceScreen,
  finished: finishedScreen,
  list: listScreen,
  "new-week": newWeekScreen,
  gift: giftScreen,
  album: albumScreen,
  history: historyScreen,
  "add-day": addDayScreen,
  scene: sceneScreen,
  parent: parentScreen,
};

function render() {
  const needsWeek = ["practice", "finished", "new-week", "gift", "add-day"];
  if (!state.week && needsWeek.includes(screen)) screen = "home";
  // A screen is a list of parts. Lists inside it are flattened, and parts
  // that are switched off (false or null) are skipped.
  const wasOnScene = Boolean(document.activeElement && document.activeElement.closest(".placed"));
  const parts = SCREENS[screen]().flat(Infinity).filter(Boolean);
  // Every screen except home starts with the Home button.
  if (screen !== "home") parts.unshift(homeBar());
  app.replaceChildren(...parts);
  // On the scene, keep the keyboard on the picked sticker after a redraw.
  const pickedNode = app.querySelector('.placed[data-picked="yes"]');
  if (pickedNode && wasOnScene) pickedNode.focus({ preventScroll: true });
}

render();

// Offline: sw.js saves the app's files so it opens without internet.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((error) => console.warn("Offline mode is off:", error));
}
// Ask the device to keep this app's saved data even when storage runs low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
