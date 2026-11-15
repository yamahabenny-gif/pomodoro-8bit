// CONTRACT (owned by issue "Regie"). Ties the timer to the scene: what happens on stage at every moment.
//
// WAVE 5 (issue "Regie 2"): twice as many encounters; breaks use src/game/scene/rest.js (storm or lake, the
// heroine lights the fire); createDirector also takes { progress } and shows level-ups on stage.
//
// createDirector({ stage, forest, heroine, timer, sfx, progress, ui }) returns
//   { update(dt), draw(), background(), stats() }
//   focus phase: the heroine walks, an enemy appears, they fight, it dies, she walks on. Encounters are paced to
//                the focus length (roughly one every 30-90 s, tougher foes later in the phase) and never end mid-swing
//                when the phase ends: the current foe flees or poofs during the transition.
//   breaks alternate storm and lake scenes; she lights the fire and rests at the scene's seatX.
//   back to focus: she stands up, stretches, walks on.
//   stats(): { kills: { gnome, orc, ogre, golem }, focusDone } for the HUD; persisted per day.

import { createEnemy, ENEMY_KINDS } from "../enemies/enemies.js";
import { createRest, REST_KINDS } from "../scene/rest.js";
import { painterFor, hex } from "pixelfx/core/index.js";

// Keep the stage contract local so the headless snapshot runner does not need Vite's pixelfx alias.
const GROUND_Y = 150;
const STATS_KEY = "pomodoro8bit.director.v1";
const HERO_X = 112;
const CAMP_OFFSET = 30;
const ATTACKS = ["attack1", "attack2", "attack3"];
const ENEMY_SWING = { gnome: 0.62, orc: 0.92, ogre: 1.3 };

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const validCounts = (value = {}) => {
  const counts = Object.fromEntries(ENEMY_KINDS.filter((kind) => kind !== "golem")
    .map((kind) => [kind, Math.max(0, Number(value[kind]) || 0)]));
  if (Object.hasOwn(value, "golem")) counts.golem = Math.max(0, Number(value.golem) || 0);
  return counts;
};

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readDailyStats() {
  const blank = { date: today(), kills: validCounts(), focusDone: 0 };
  try {
    const raw = globalThis.localStorage?.getItem(STATS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || data.date !== blank.date) return blank;
    return {
      date: blank.date,
      kills: validCounts(data.kills),
      focusDone: Math.max(0, Number(data.focusDone) || 0),
    };
  } catch {
    return blank;
  }
}

function writeDailyStats(value) {
  try {
    globalThis.localStorage?.setItem(STATS_KEY, JSON.stringify(value));
  } catch {
    // A blocked or full store should not affect the session.
  }
}

function modeFor(phase) {
  return phase === "focus" ? "fight" : phase === "long" ? "night" : "camp";
}

function logicalFocusInterval(totalMs) {
  // About 48 encounters in a 25-minute focus phase.
  return clamp(totalMs / 48, 15_000, 45_000);
}

function kindForEncounter(index, totalMs) {
  const count = Math.max(1, Math.ceil(totalMs / logicalFocusInterval(totalMs)));
  const golems = new Set([Math.floor((count - 1) * 0.74), Math.floor((count - 1) * 0.92)]);
  if (golems.has(index)) return "golem";
  const slot = index % 8;
  if (slot === 3 || slot === 7) return "orc";
  if (slot === 5) return "ogre";
  return "gnome";
}

export function createDirector({ stage, forest, heroine, timer, sfx, progress, ui }) {
  if (!stage || !forest || !heroine || !timer) {
    throw new TypeError("createDirector requires stage, forest, heroine and timer");
  }

  let phaseState = timer.state();
  let phase = phaseState.phase;
  let focusElapsed = phase === "focus" ? Math.max(0, phaseState.totalMs - phaseState.remainingMs) : 0;
  let nextEncounter = logicalFocusInterval(phaseState.totalMs);
  let encounterIndex = 0;
  let enemy = null;
  let encounterState = "walk";
  let stateTime = 0;
  let attackIndex = 0;
  let attackReady = false;
  let enemyAttackReady = false;
  let enemySwingRemaining = 0;
  let hitCounted = false;
  let pendingPhase = null;
  let transitionFoe = false;
  let rest = null;
  let lastRestKind = null;
  let thunderIn = 0;
  let levelUpQueued = false;
  let levelUpEffect = 0;
  let transitionTime = 0;
  let daily = readDailyStats();
  let completedSeen = phaseState.completedFocus;

  forest.setMode(modeFor(phase), { instant: true });
  if (phase !== "focus") {
    lastRestKind = REST_KINDS[REST_KINDS.length - 1];
    enterRest(phase, true);
  }
  heroine.x = phase === "focus" ? HERO_X : rest.seatX;
  heroine.y = GROUND_Y;
  heroine.play(phase === "focus" ? "idle" : "sit");
  if (phase === "focus") sfx?.ambience?.("forest");
  progress?.on?.("levelup", ({ level }) => {
    ui?.levelUp?.(level);
    sfx?.play?.("levelUp");
    levelUpEffect = 1.2;
    if (phase === "focus" && encounterState === "fight" && heroine.anim.startsWith("attack")) levelUpQueued = true;
    else { heroine.play("levelUp"); levelUpQueued = false; }
  });

  function enterRest(nextPhase, restored = false) {
    const kind = REST_KINDS.find((candidate) => candidate !== lastRestKind) ?? REST_KINDS[0];
    lastRestKind = kind;
    rest = createRest(kind, { night: nextPhase === "long" });
    if (restored) {
      rest.ignite();
      for (let i = 0; i < 30; i++) rest.update(0.05);
    }
    if (restored) heroine.x = rest.seatX;
    thunderIn = 7 + Math.random() * 8;
    sfx?.ambience?.(kind === "storm" ? "rain" : "lake");
  }

  function persistStats() {
    writeDailyStats(daily);
  }

  function playIfNeeded(name, callbacks) {
    if (heroine.anim !== name) heroine.play(name, callbacks);
  }

  function resetEncounter() {
    enemy = null;
    encounterState = "walk";
    stateTime = 0;
    attackReady = false;
    enemyAttackReady = false;
    enemySwingRemaining = 0;
    hitCounted = false;
  }

  function startPhase(next, { announce = false } = {}) {
    const returningFromBreak = phase !== "focus" && next.phase === "focus";
    phase = next.phase;
    transitionTime = 0.7;
    phaseState = next;
    pendingPhase = null;
    focusElapsed = 0;
    nextEncounter = logicalFocusInterval(next.totalMs);
    encounterIndex = 0;
    transitionFoe = false;
    resetEncounter();
    forest.setMode(modeFor(phase));
    if (phase === "focus") {
      const formerRest = rest;
      rest = null;
      heroine.x = returningFromBreak ? (formerRest?.seatX ?? forest.campfireX - CAMP_OFFSET) : HERO_X;
      if (returningFromBreak) {
        heroine.play("standUp", { onDone: () => heroine.play("walk") });
        encounterState = "stretch";
      } else {
        heroine.play("walk");
        encounterState = "walk";
      }
      stateTime = 0;
      sfx?.ambience?.("forest");
      if (announce) {
        sfx?.play?.("phaseFocus");
        if (returningFromBreak) {
          const minutes = Math.max(1, Math.round(next.totalMs / 60_000));
          sfx?.notify?.("Pause vorbei", `Kampf: ${minutes} Minuten.`);
        }
      }
    } else {
      enterRest(phase);
      playIfNeeded("walk");
      encounterState = "toCamp";
      stateTime = 0;
      if (announce) {
        sfx?.play?.("phaseBreak");
        const minutes = Math.max(1, Math.round(next.totalMs / 60_000));
        const name = next.phase === "long" ? "Lange Rast" : "Kurze Rast";
        sfx?.notify?.("Kampf vorbei", `${name}: ${minutes} Minuten.`);
      }
    }
  }

  function onPhase(next) {
    if (phase === "focus" && enemy && !enemy.isDead()) {
      pendingPhase = next;
      transitionFoe = true;
      if (encounterState === "approach") {
        enemy.hit(enemy.hp);
        encounterState = "transitionPoof";
      }
    } else startPhase(next, { announce: true });
  }

  timer.on?.("phase", onPhase);
  timer.on?.("end", ({ phase: ended }) => {
    if (ended === "focus") {
      daily.focusDone += 1;
      completedSeen += 1;
      persistStats();
    }
  });

  function spawnEncounter() {
    const kind = kindForEncounter(encounterIndex, phaseState.totalMs);
    encounterIndex += 1;
    enemy = createEnemy(kind, { x: 270, y: GROUND_Y });
    enemy.approach(heroine.x + 10);
    heroine.play("walk");
    encounterState = "approach";
    stateTime = 0;
    attackIndex = 0;
    hitCounted = false;
  }

  function beginAttack() {
    const name = ATTACKS[attackIndex++ % ATTACKS.length];
    attackReady = false;
    heroine.play(name, {
      onHit() {
        if (!enemy || enemy.isDead() || transitionFoe) return;
        const hpBefore = enemy.hp;
        const remaining = enemy.hit(1);
        if (remaining === hpBefore) sfx?.play?.("block");
        else sfx?.play?.(enemy.kind === "golem" ? "rockHit" : "hit");
        if (remaining <= 0 && !hitCounted) {
          hitCounted = true;
          daily.kills[enemy.kind] = (daily.kills[enemy.kind] ?? 0) + 1;
          persistStats();
          sfx?.play?.("enemyDie");
        }
      },
      onDone() {
        attackReady = true;
      },
    });
    sfx?.play?.("swing");
  }

  function beginEnemyAttack() {
    if (!enemy || transitionFoe) return;
    enemyAttackReady = false;
    const started = enemy.attack({
      onHit() {
        if (!enemy || transitionFoe) return;
        heroine.play("hurt", {
          onDone: () => {
            if (enemy && enemy.state === "fight") {
              heroine.play("idle");
              attackReady = true;
            }
          },
        });
        sfx?.play?.("hurt");
      },
    });
    if (started) enemySwingRemaining = ENEMY_SWING[enemy.kind];
    else enemyAttackReady = true;
  }

  function updateFocus(dt) {
    if (heroine.anim === "levelUp" && encounterState !== "fight") return;
    if (encounterState === "stretch") {
      if (heroine.anim === "idle" || heroine.anim === "walk") {
        encounterState = "depart";
        playIfNeeded("walk");
      } else return;
    }
    if (encounterState === "depart") {
      const distance = HERO_X - heroine.x;
      heroine.x += Math.sign(distance) * Math.min(Math.abs(distance), 36 * dt);
      forest.scroll(28 * dt);
      if (Math.abs(distance) < 0.5) {
        heroine.x = HERO_X;
        encounterState = "walk";
      }
      return;
    }
    if (encounterState === "walk") {
      playIfNeeded("walk");
      forest.scroll(28 * dt);
      stateTime += dt;
      if (enemy === null && focusElapsed >= nextEncounter) {
        nextEncounter += logicalFocusInterval(phaseState.totalMs);
        spawnEncounter();
      }
      return;
    }
    if (!enemy) return;
    if (encounterState === "approach") {
      enemy.approach(heroine.x + 10);
      playIfNeeded("walk");
      if (enemy.state === "fight") {
        encounterState = "fight";
        stateTime = 0;
        attackReady = true;
        enemyAttackReady = false;
      }
      return;
    }
    if (encounterState === "fight") {
      stateTime += dt;
      if (enemy.state === "dying" || enemy.state === "dead") {
        encounterState = "victory";
        heroine.play("victory", {
          onDone: () => {
            if (!pendingPhase) encounterState = "walkOn";
          },
        });
        stateTime = 0;
        return;
      }
      if (transitionFoe) {
        if (!heroine.anim.startsWith("attack") && enemySwingRemaining <= 0) {
          enemy.hit(enemy.hp);
          encounterState = "transitionPoof";
          stateTime = 0;
        }
        return;
      }
      if (levelUpQueued && !heroine.anim.startsWith("attack") && heroine.anim !== "hurt") {
        levelUpQueued = false;
        heroine.play("levelUp", { onDone: () => { if (enemy?.state === "fight") attackReady = true; } });
        return;
      }
      if (heroine.anim === "levelUp") return;
      if (attackReady) beginAttack();
      else if (enemyAttackReady && heroine.anim !== "hurt") beginEnemyAttack();
      else if (stateTime > 1.25 && !heroine.anim.startsWith("attack") && enemy.state === "fight") {
        enemyAttackReady = true;
      }
      return;
    }
    if (encounterState === "transitionPoof") {
      if (enemy.isDead()) {
        enemy = null;
        if (pendingPhase) startPhase(pendingPhase, { announce: true });
      }
      return;
    }
    if (encounterState === "victory") {
      if (heroine.anim === "idle") {
        encounterState = "walkOn";
        stateTime = 0;
      }
      return;
    }
    if (encounterState === "walkOn") {
      playIfNeeded("walk");
      forest.scroll(42 * dt);
      stateTime += dt;
      if (stateTime >= 1.1) {
        resetEncounter();
        if (pendingPhase) startPhase(pendingPhase, { announce: true });
      }
    }
  }

  function updateBreak(dt) {
    if (encounterState === "toCamp") {
      const target = rest.seatX;
      const distance = target - heroine.x;
      heroine.x += Math.sign(distance) * Math.min(Math.abs(distance), 36 * dt);
      playIfNeeded("walk");
      if (Math.abs(distance) < 0.5) {
        heroine.x = target;
        heroine.play("lightFire", {
          onHit() { rest.ignite(); sfx?.play?.("ignite"); },
          onDone: () => heroine.play("sit"),
        });
        encounterState = "lightFire";
      }
      return;
    }
    if (encounterState === "lightFire" && heroine.anim === "sit") {
      heroine.x = rest.seatX;
      encounterState = "sit";
    }
  }

  return {
    update(dt) {
      dt = Math.max(0, Number(dt) || 0);
      const state = timer.state();
      // The timer reports logical milliseconds, so this also follows ?speed=60 and pause/resume exactly.
      if (phase === "focus" && state.phase === "focus") {
        const elapsed = Math.max(0, phaseState.totalMs - state.remainingMs);
        focusElapsed = Math.max(focusElapsed, elapsed);
      }
      phaseState = state;
      forest.update(dt);
      rest?.update(dt);
      heroine.update(dt);
      if (rest?.kind === "storm") {
        thunderIn -= dt;
        if (thunderIn <= 0) { sfx?.play?.("thunder"); thunderIn = 7 + Math.random() * 8; }
      }
      levelUpEffect = Math.max(0, levelUpEffect - dt);
      transitionTime = Math.max(0, transitionTime - dt);
      progress?.sync?.(state);
      enemySwingRemaining = Math.max(0, enemySwingRemaining - dt);
      enemy?.update(dt);
      if (state.completedFocus > completedSeen) {
        daily.focusDone += state.completedFocus - completedSeen;
        completedSeen = state.completedFocus;
        persistStats();
      }
      if (phase === "focus") updateFocus(dt);
      else updateBreak(dt);
    },
    draw() {
      if (rest) rest.drawBack(stage.frame); else forest.drawBack(stage.frame);
      heroine.draw(stage.frame);
      enemy?.draw(stage.frame);
      if (levelUpEffect > 0) {
        const p = painterFor(stage.frame), fade = Math.min(1, levelUpEffect * 2);
        p.place(heroine.x, heroine.y - 45);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + (1.2 - levelUpEffect) * 2;
          const x = Math.cos(a) * 12, y = Math.sin(a) * 8;
          p.glow(x, y, 4, hex("#ffd45e"), fade * 0.4); p.dot(x, y, hex("#fff0ad"), fade);
        }
      }
      if (rest) rest.drawFront(stage.frame); else forest.drawFront(stage.frame);
      if (transitionTime > 0) {
        const p = painterFor(stage.frame);
        p.place(0, 0);
        p.rect(0, 0, 320, 180, hex("#100d1a"), Math.min(0.62, transitionTime / 0.7 * 0.62));
      }
    },
    background() { return rest ? rest.background() : forest.background(); },
    stats() {
      return { kills: { ...daily.kills }, focusDone: daily.focusDone };
    },
  };
}
