import { describe, expect, it, vi } from "vitest";
import { createFrame } from "../vendor/pixelfx/src/core/index.js";
import { createEnemy, ENEMY_KINDS } from "../src/game/enemies/enemies.js";

describe("forest enemies", () => {
  it("exposes the three kinds with their expected hit points", () => {
    expect(ENEMY_KINDS).toEqual(["gnome", "orc", "ogre"]);
    expect(ENEMY_KINDS.map((kind) => createEnemy(kind).maxHp)).toEqual([2, 3, 5]);
  });

  it("approaches from the right and stops at its attack range", () => {
    const enemy = createEnemy("gnome", { x: 100, y: 150 });
    enemy.approach(40);
    enemy.update(1);
    expect(enemy.x).toBe(62);
    expect(enemy.state).toBe("approach");
    enemy.update(1);
    expect(enemy.x).toBe(59);
    expect(enemy.state).toBe("fight");
  });

  it("lands one attack callback on the contact frame", () => {
    const enemy = createEnemy("orc", { x: 60, y: 150 });
    enemy.approach(35);
    enemy.update(0.1);
    const onHit = vi.fn();
    expect(enemy.attack({ onHit })).toBe(true);
    enemy.update(0.44);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledWith({ kind: "orc", damage: 1 });
    enemy.update(0.5);
    expect(onHit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["gnome", 2],
    ["orc", 3],
    ["ogre", 5],
  ])("tracks %s HP and dies after %i hits", (kind, hits) => {
    const enemy = createEnemy(kind);
    for (let i = 1; i < hits; i++) {
      expect(enemy.hit(1)).toBe(hits - i);
      expect(enemy.state).toBe("approach");
    }
    enemy.hit(1);
    expect(enemy.hp).toBe(0);
    expect(enemy.state).toBe("dying");
    expect(enemy.isDead()).toBe(false);
    enemy.update(0.25);
    expect(enemy.isDead()).toBe(false);
    enemy.update(2);
    expect(enemy.state).toBe("dead");
    expect(enemy.isDead()).toBe(true);
  });

  it("draws each sprite and its hit effect into a stage frame", () => {
    for (const kind of ENEMY_KINDS) {
      const enemy = createEnemy(kind, { x: 100, y: 150 });
      const frame = createFrame(320, 180);
      enemy.draw(frame);
      expect(frame.color.some(Boolean)).toBe(true);
      enemy.hit(1);
      enemy.update(1 / 30);
      enemy.draw(frame);
      expect(frame.color.some(Boolean)).toBe(true);
    }
  });
});
