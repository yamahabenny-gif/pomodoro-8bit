import { createStage, startLoop, GROUND_Y } from "./engine/stage.js";
import { PRESETS } from "./config/presets.js";
import { createTimer } from "./timer/timer.js";
import { clear, load, save } from "./timer/persist.js";
import { createHeroine } from "./game/heroine/heroine.js";
import { createForest } from "./game/scene/forest.js";
import { createDirector } from "./game/director/director.js";
import { loadSavedSession } from "./game/director/session.js";
import { createSfx } from "./audio/sfx.js";
import { createProgress } from "./game/progress/progress.js";
import { createUI } from "./ui/ui.js";

const stage = createStage(document.getElementById("stage"));
const sfx = createSfx();
const progress = createProgress();
const menuForest = createForest();
const menuHeroine = createHeroine({ x: 146, y: GROUND_Y });
menuHeroine.play("idle");

let timer = null;
let director = null;
let activeForest = null;
let ui;

function timerSpeed() {
  const raw = new URLSearchParams(window.location.search).get("speed");
  const speed = Number(raw);
  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}

function unlockOnFirstGesture() {
  const handleGesture = () => {
    document.removeEventListener("pointerdown", handleGesture);
    document.removeEventListener("keydown", handleGesture);
    sfx.unlock();
    sfx.requestPermission?.();
  };
  document.addEventListener("pointerdown", handleGesture, { once: true, passive: true });
  document.addEventListener("keydown", handleGesture, { once: true });
}

function startSession(preset, restored = load(preset), { userGesture = true } = {}) {
  if (userGesture) {
    sfx.unlock();
    sfx.requestPermission?.();
    sfx.play("click");
  }

  const session = createTimer.restore(preset, restored, { speed: timerSpeed() });
  const forest = createForest();
  const heroine = createHeroine({ x: 112, y: GROUND_Y });
  timer = session;
  activeForest = forest;
  director = createDirector({ stage, forest, heroine, timer: session, sfx, progress, ui });
  ui.showHud(preset);
  session.on("change", () => save(session));
  save(session);
}

function resetSession() {
  if (!timer) return;
  const current = timer;
  current.reset();
  save(current);

  // The UI uses onReset for both the HUD button and its confirmed return-to-menu action.
  queueMicrotask(() => {
    if (ui.view !== "menu") return;
    current.pause();
    clear();
    timer = null;
    director = null;
    activeForest = null;
    sfx.ambience(null);
  });
}

ui = createUI(document.getElementById("ui"), {
  presets: PRESETS,
  onStart: startSession,
  onPause: () => timer?.pause(),
  onResume: () => timer?.resume(),
  onSkip: () => timer?.skip(),
  onReset: resetSession,
  onMute: (muted) => sfx.setMuted(muted),
});
const savedSession = loadSavedSession(PRESETS, load);
if (savedSession) {
  startSession(savedSession.preset, savedSession.data, { userGesture: false });
  unlockOnFirstGesture();
} else {
  ui.showMenu();
  sfx.ambience(null);
}

startLoop((dt) => {
  timer?.tick();
  if (!director) {
    menuForest.update(dt);
    menuHeroine.update(dt);
  }
  director?.update(dt);

  stage.clear();
  if (director && activeForest) {
    director.draw();
    stage.present(director.background());
    ui.render(timer.state(), director.stats(), progress.state());
  } else {
    menuForest.drawBack(stage.frame);
    menuHeroine.draw(stage.frame);
    menuForest.drawFront(stage.frame);
    stage.present(menuForest.background());
  }
});
