// CONTRACT (owned by issue "UI: Menü & HUD"). DOM overlay on top of the canvas (#ui), pixel styled.
//
// createUI(root, { presets, onStart(preset), onPause, onResume, onSkip, onReset, onMute(bool) }) returns:
//   showMenu()                   start menu: pick one of PRESETS (cards with name, durations, blurb)
//   showHud(preset?)             big mm:ss, phase label (Kampf / Rast / Lange Rast), cycle pips,
//                                kill counter, buttons pause/resume, skip, reset, mute
//                                (optional: the chosen preset, so the pips match this variant)
//   render(timerState, stats)    update HUD; also sets document.title to "12:34 · Kampf"
//   destroy()                    remove listeners (convenience, the director may never need it)
// Keyboard: Space pause/resume, S skip, M mute, Esc back to menu (with confirm).
//
// Pure helpers exported for tests: formatTime, phaseLabel, presetLine, cycleMarks.

import { PRESETS } from "../config/presets.js";

const PHASE_LABELS = { focus: "Kampf", short: "Rast", long: "Lange Rast" };
const KINDS = ["gnome", "orc", "ogre"];
const ENEMY_LABELS = { gnome: "Gnom", orc: "Ork", ogre: "Oger" };
const APP_TITLE = "Pomodoro 8-Bit";
const HINT = "Leertaste Pause · S überspringen · M Ton · Esc Menü";

/** mm:ss, seconds rounded up so a running timer never shows 00:00 early. */
export function formatTime(ms) {
  const value = Number(ms);
  const total = Number.isFinite(value) ? Math.max(0, Math.ceil(value / 1000)) : 0;
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** German phase label for the HUD and window title. Unknown phases give an empty string. */
export function phaseLabel(phase) {
  return PHASE_LABELS[phase] ?? "";
}

/** "25 · 5 · 20/4" (long break + its cycle) or "52 · 17" when the variant has none. */
export function presetLine(preset) {
  if (!preset) return "";
  if (preset.longBreak && preset.longBreakEvery) {
    return `${preset.focus} · ${preset.shortBreak} · ${preset.longBreak}/${preset.longBreakEvery}`;
  }
  return `${preset.focus} · ${preset.shortBreak}`;
}

/** One boolean per cycle pip: how many focus phases of the current set are done. */
export function cycleMarks(completedFocus, longBreakEvery, phase = "focus") {
  const total = Math.max(0, Math.floor(Number(longBreakEvery) || 0));
  if (!total) return [];
  const done =
    phase === "long"
      ? total
      : Math.min(total, Math.max(0, Math.floor(Number(completedFocus) || 0)) % total);
  return Array.from({ length: total }, (_, i) => i < done);
}

// Tiny 10 x 10 sprites for the kill counter, one char per pixel, "." is transparent.
const ENEMY_ART = {
  gnome: {
    palette: { r: "#e8474d", s: "#f2c9a0", w: "#efe7d8", k: "#17121f", b: "#4fb6d9" },
    rows: [
      "...rrrr...",
      "..rrrrrr..",
      ".rrrrrrrr.",
      "rrrrrrrrrr",
      ".ssssssss.",
      ".ssksskss.",
      ".swwwwwws.",
      "..wwwwww..",
      "..bbbbbb..",
      "...bbbb...",
    ],
  },
  orc: {
    palette: { g: "#7fd45a", k: "#17121f", t: "#f4ead2", l: "#8a5a35" },
    rows: [
      "...gggg...",
      "..gggggg..",
      ".gggggggg.",
      "gggggggggg",
      ".gkggggkg.",
      ".ggttttgg.",
      "..gggggg..",
      "..llllll..",
      ".llllllll.",
      "..l.ll.l..",
    ],
  },
  ogre: {
    palette: { o: "#c9a06a", k: "#17121f", w: "#f4ead2" },
    rows: [
      "...oooo...",
      "..oooooo..",
      ".oooooooo.",
      ".okooooko.",
      ".oooooooo.",
      ".owwwwwwo.",
      "..oooooo..",
      ".oooooooo.",
      "o.oooooo.o",
      "...oooo...",
    ],
  },
};

// 10 x 10 button glyphs, drawn in currentColor so CSS decides the tint.
const UI_ART = {
  pause: [
    "..........",
    "..........",
    "..##..##..",
    "..##..##..",
    "..##..##..",
    "..##..##..",
    "..##..##..",
    "..##..##..",
    "..........",
    "..........",
  ],
  play: [
    "..........",
    "..#.......",
    "..##......",
    "..###.....",
    "..####....",
    "..###.....",
    "..##......",
    "..#.......",
    "..........",
    "..........",
  ],
  skip: [
    "..........",
    "..#....#..",
    "..##...#..",
    "..###..#..",
    "..####.#..",
    "..###..#..",
    "..##...#..",
    "..#....#..",
    "..........",
    "..........",
  ],
  reset: [
    "..........",
    "...####...",
    "..#....#..",
    ".#......#.",
    ".#......#.",
    ".#......#.",
    "..#....#..",
    "...####...",
    "..........",
    "..........",
  ],
  sound: [
    "..........",
    "..........",
    "..#...#...",
    ".##....#..",
    "####...#..",
    ".##.......",
    "..#.......",
    "..........",
    "..........",
    "..........",
  ],
  muted: [
    "..........",
    "..........",
    "..#...#.#.",
    ".##....#..",
    "####..#.#.",
    ".##.......",
    "..#.......",
    "..........",
    "..........",
    "..........",
  ],
};

function artSvg(kind, art, palette) {
  const rects = [];
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push(
        `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[ch] ?? "currentColor"}"/>`,
      );
      x = end;
    }
  });
  return `<svg class="px-icon px-icon--${kind}" viewBox="0 0 10 10" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

function enemyIcon(kind) {
  const art = ENEMY_ART[kind];
  return art ? artSvg(kind, art.rows, art.palette) : "";
}

function uiIcon(name) {
  const art = UI_ART[name];
  return art ? artSvg(name, art, {}) : "";
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

let instanceCount = 0;

/**
 * Mounts the menu + HUD into a DOM node. The node (#ui) is the overlay above the canvas and is
 * expected to be inside the stage wrapper, see src/ui/style.css.
 */
export function createUI(root, handlers = {}) {
  if (!root || typeof root.replaceChildren !== "function") {
    throw new TypeError("createUI: root must be a DOM element");
  }
  const presets = Array.isArray(handlers.presets) && handlers.presets.length ? handlers.presets : PRESETS;
  const uid = `pom-ui-${++instanceCount}`;

  root.classList.add("pom-ui");
  root.innerHTML = `
    <div class="ui-layer" data-part="menu">
      <div class="menu" role="group" aria-labelledby="${uid}-title">
        <header class="menu-head">
          <p class="kicker">Fokus im Wald</p>
          <h1 class="menu-title" id="${uid}-title">Pomodoro</h1>
          <p class="menu-sub">8 Bit · Wähle deine Teilung</p>
        </header>
        <div class="cards" role="listbox" aria-label="Varianten" data-el="cards"></div>
        <p class="menu-hint">↑ ↓ wählen · Enter startet · 1–3 direkt</p>
      </div>
    </div>
    <div class="ui-layer" data-part="hud">
      <div class="hud-top">
        <div class="hud-panel hud-clock-panel">
          <span class="clock" role="timer" data-el="clock">00:00</span>
          <span class="phase-tag" data-el="phase" data-phase="focus" aria-live="polite">Kampf</span>
        </div>
        <div class="pips" data-el="pips" role="img" aria-label="Zyklus"></div>
        <p class="hud-hint">${HINT}</p>
      </div>
      <div class="hud-panel hud-kills" data-el="kills" role="group" aria-label="Besiegte Gegner"></div>
      <div class="hud-actions">
        <button type="button" class="btn" data-act="pause" data-el="pause" aria-label="Pause (Leertaste)">
          <span class="btn-icon" data-el="pause-icon">${uiIcon("pause")}</span><span class="btn-label">Pause</span>
        </button>
        <button type="button" class="btn" data-act="skip" aria-label="Überspringen (S)" title="Überspringen (S)">
          <span class="btn-icon">${uiIcon("skip")}</span><span class="btn-label">Überspringen</span>
        </button>
        <button type="button" class="btn" data-act="reset" aria-label="Zurücksetzen" title="Zurücksetzen">
          <span class="btn-icon">${uiIcon("reset")}</span><span class="btn-label">Zurücksetzen</span>
        </button>
        <button type="button" class="btn" data-act="mute" data-el="mute" aria-pressed="false" aria-label="Ton ausschalten (M)" title="Ton ausschalten (M)">
          <span class="btn-icon" data-el="mute-icon">${uiIcon("sound")}</span><span class="btn-label">Ton aus</span>
        </button>
      </div>
    </div>
    <div class="ui-layer" data-part="confirm" role="dialog" aria-modal="true" aria-labelledby="${uid}-confirm-title" aria-describedby="${uid}-confirm-body">
      <div class="dialog">
        <p class="dialog-title" id="${uid}-confirm-title">Zurück zum Menü?</p>
        <p class="dialog-body" id="${uid}-confirm-body">Der laufende Timer wird zurückgesetzt.</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-primary" data-act="confirm-yes">Ja, Menü</button>
          <button type="button" class="btn" data-act="confirm-no">Weiter</button>
        </div>
      </div>
    </div>
  `;

  const confirmLayer = root.querySelector('[data-part="confirm"]');
  const cardsEl = root.querySelector('[data-el="cards"]');
  const clockEl = root.querySelector('[data-el="clock"]');
  const phaseEl = root.querySelector('[data-el="phase"]');
  const pipsEl = root.querySelector('[data-el="pips"]');
  const killsEl = root.querySelector('[data-el="kills"]');
  const pauseBtn = root.querySelector('[data-el="pause"]');
  const pauseIcon = root.querySelector('[data-el="pause-icon"]');
  const muteBtn = root.querySelector('[data-el="mute"]');
  const muteIcon = root.querySelector('[data-el="mute-icon"]');
  const confirmYes = root.querySelector('[data-act="confirm-yes"]');
  const confirmNo = root.querySelector('[data-act="confirm-no"]');
  const pauseLabel = pauseBtn.querySelector(".btn-label");
  const muteLabel = muteBtn.querySelector(".btn-label");

  /** @type {HTMLButtonElement[]} */
  const cards = [];
  const killCounts = {};
  cardsEl.replaceChildren();

  presets.forEach((preset, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.index = String(index);
    card.setAttribute("role", "option");
    card.setAttribute(
      "aria-label",
      `${preset.name}: ${preset.focus} Minuten Fokus, ${preset.shortBreak} Minuten Pause`,
    );
    card.innerHTML = `
      <span class="card-key" aria-hidden="true">${index + 1}</span>
      <span class="card-name">${escapeHtml(preset.name)}</span>
      <span class="card-line">${escapeHtml(presetLine(preset))}</span>
      <span class="card-blurb">${escapeHtml(preset.blurb)}</span>
    `;
    card.addEventListener("click", () => start(index));
    cardsEl.append(card);
    cards.push(card);
  });

  killsEl.replaceChildren();
  for (const kind of KINDS) {
    const row = document.createElement("div");
    row.className = "kill";
    row.dataset.kind = kind;
    row.innerHTML = `<span class="kill-icon">${enemyIcon(kind)}</span><span class="kill-name">${ENEMY_LABELS[kind]}</span><span class="kill-count" data-el="kill-${kind}">0</span>`;
    killsEl.append(row);
    killCounts[kind] = row.querySelector(".kill-count");
  }

  let view = "menu";
  let selectedIndex = 0;
  let currentPreset = presets[0];
  let muted = false;
  let confirmOpen = false;
  let running = true;
  let last = { time: "", phase: "", title: "", pips: null, running: null };

  function setView(next) {
    view = next;
    root.dataset.view = next;
  }

  function select(index, focus = false) {
    const count = cards.length;
    if (!count) return;
    selectedIndex = ((index % count) + count) % count;
    cards.forEach((card, i) => {
      const active = i === selectedIndex;
      card.setAttribute("aria-selected", String(active));
      card.tabIndex = active ? 0 : -1;
    });
    if (focus) cards[selectedIndex].focus({ preventScroll: true });
  }

  function paintRunning(isRunning) {
    running = isRunning;
    pauseIcon.innerHTML = uiIcon(isRunning ? "pause" : "play");
    pauseLabel.textContent = isRunning ? "Pause" : "Weiter";
    pauseBtn.setAttribute("aria-label", isRunning ? "Pause (Leertaste)" : "Weiter (Leertaste)");
    pauseBtn.title = pauseBtn.getAttribute("aria-label");
  }

  function paintMuted() {
    muteIcon.innerHTML = uiIcon(muted ? "muted" : "sound");
    muteLabel.textContent = muted ? "Ton an" : "Ton aus";
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "Ton einschalten (M)" : "Ton ausschalten (M)");
    muteBtn.title = muteBtn.getAttribute("aria-label");
  }

  function paintPips(marks) {
    pipsEl.replaceChildren(
      ...marks.map((done, i) => {
        const pip = document.createElement("i");
        pip.className = done ? "pip is-done" : "pip";
        pip.setAttribute("aria-hidden", "true");
        pip.dataset.index = String(i);
        return pip;
      }),
    );
    pipsEl.hidden = marks.length === 0;
    pipsEl.setAttribute(
      "aria-label",
      marks.length ? `Zyklus ${marks.filter(Boolean).length} von ${marks.length}` : "",
    );
  }

  function start(index) {
    const preset = presets[index];
    if (!preset) return;
    select(index);
    showHud(preset);
    handlers.onStart?.(preset);
  }

  function showMenu() {
    closeConfirm(false);
    setView("menu");
    document.title = APP_TITLE;
    last.title = APP_TITLE;
  }

  function showHud(preset) {
    if (preset) currentPreset = preset;
    closeConfirm(false);
    setView("hud");
    last.pips = null; // next render() repaints the pips for this preset
  }

  function render(timerState, stats) {
    const state = timerState || {};
    const phase = state.phase ?? "focus";
    const label = phaseLabel(phase);
    const time = formatTime(state.remainingMs);

    if (time !== last.time) {
      clockEl.textContent = time;
      last.time = time;
    }
    if (label !== last.phase) {
      phaseEl.textContent = label;
      phaseEl.dataset.phase = phase;
      last.phase = label;
    }

    const title = label ? `${time} · ${label}` : `${time} · ${APP_TITLE}`;
    if (view === "hud" && title !== last.title) {
      document.title = title;
      last.title = title;
    }

    const preset = state.preset ?? currentPreset;
    const marks = cycleMarks(state.completedFocus, preset?.longBreakEvery, phase);
    const pipKey = marks.map((mark) => (mark ? "1" : "0")).join("");
    if (pipKey !== last.pips) {
      paintPips(marks);
      last.pips = pipKey;
    }

    const kills = stats?.kills ?? {};
    for (const kind of KINDS) {
      const count = String(Math.max(0, Math.floor(Number(kills[kind]) || 0)));
      if (killCounts[kind] && killCounts[kind].textContent !== count) {
        killCounts[kind].textContent = count;
      }
    }

    if (Boolean(state.running) !== last.running) {
      paintRunning(Boolean(state.running));
      last.running = Boolean(state.running);
    }
  }

  function togglePause() {
    const next = !running;
    paintRunning(next);
    last.running = next;
    if (next) handlers.onResume?.();
    else handlers.onPause?.();
  }

  function toggleMute() {
    muted = !muted;
    paintMuted();
    handlers.onMute?.(muted);
  }

  function openConfirm() {
    if (confirmOpen) return;
    confirmOpen = true;
    confirmLayer.classList.add("is-open");
    confirmYes.focus({ preventScroll: true });
  }

  function closeConfirm(restoreFocus = true) {
    if (!confirmOpen) return;
    confirmOpen = false;
    confirmLayer.classList.remove("is-open");
    if (restoreFocus && view === "hud") pauseBtn.focus({ preventScroll: true });
  }

  function confirmToMenu() {
    closeConfirm(false);
    handlers.onReset?.();
    showMenu();
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof Element && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
      return;
    }

    if (confirmOpen) {
      if (event.key === "Tab") {
        event.preventDefault();
        const order = [confirmYes, confirmNo];
        const current = order.indexOf(document.activeElement);
        const step = event.shiftKey ? -1 : 1;
        const next = current === -1 ? 0 : (current + step + order.length) % order.length;
        order[next].focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirm();
      } else if (event.key === "Enter") {
        event.preventDefault();
        confirmToMenu();
      }
      return;
    }

    if (view === "menu") {
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "Home") select(0, true);
        else if (event.key === "End") select(cards.length - 1, true);
        else select(selectedIndex + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1), true);
        return;
      }
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        start(selectedIndex);
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (index < cards.length) {
          event.preventDefault();
          start(index);
        }
      }
      return;
    }

    switch (event.key) {
      case " ":
      case "Spacebar":
        event.preventDefault();
        togglePause();
        break;
      case "s":
      case "S":
        event.preventDefault();
        handlers.onSkip?.();
        break;
      case "m":
      case "M":
        event.preventDefault();
        toggleMute();
        break;
      case "Escape":
        event.preventDefault();
        openConfirm();
        break;
      default:
        break;
    }
  }

  pauseBtn.addEventListener("click", togglePause);
  muteBtn.addEventListener("click", toggleMute);
  root.querySelector('[data-act="skip"]').addEventListener("click", () => handlers.onSkip?.());
  root.querySelector('[data-act="reset"]').addEventListener("click", () => handlers.onReset?.());
  confirmNo.addEventListener("click", () => closeConfirm());
  confirmYes.addEventListener("click", confirmToMenu);
  confirmLayer.addEventListener("click", (event) => {
    if (event.target === confirmLayer) closeConfirm();
  });

  const onCardKey = (event) => {
    // Cards are real buttons: Enter/Space already click. This only adds roving arrows.
    if (view !== "menu") return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      select(selectedIndex + 1, true);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      select(selectedIndex - 1, true);
    }
  };
  cardsEl.addEventListener("keydown", onCardKey);

  document.addEventListener("keydown", onKeyDown);

  select(0);
  paintRunning(true);
  paintMuted();
  showMenu();

  return {
    showMenu,
    showHud,
    render,
    get preset() {
      return currentPreset;
    },
    get view() {
      return view;
    },
    get muted() {
      return muted;
    },
    destroy() {
      document.removeEventListener("keydown", onKeyDown);
      cardsEl.removeEventListener("keydown", onCardKey);
      root.classList.remove("pom-ui");
      root.replaceChildren();
    },
  };
}
