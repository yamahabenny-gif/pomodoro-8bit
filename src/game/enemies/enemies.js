// CONTRACT (owned by issue "Gegner"). Forest foes, all facing left toward the heroine:
//   "gnome"  small, quick, 1-2 hits    (pointy red hat, beard)
//   "orc"    medium, green, axe, 3 hits
//   "ogre"   big, slow, club, 5 hits, ground shake on landing blows
//
// ENEMY_KINDS: ["gnome", "orc", "ogre"]
// createEnemy(kind, { x, y }) returns:
//   kind, x, y, hp, maxHp
//   state: "approach" | "fight" | "dying" | "dead"
//   approach(targetX)            walk left until in range of targetX, then state = "fight"
//   attack({ onHit })            plays its swing; onHit on contact (the heroine plays "hurt", never dies)
//   hit(dmg)                     flash + knockback; at hp <= 0 plays death (pixelfx spawn/poof or similar)
//   update(dt), draw(frame)
//   isDead()                     true once the death effect has finished

export const ENEMY_KINDS = ["gnome", "orc", "ogre"];

export function createEnemy(_kind, _opts = {}) {
  throw new Error("createEnemy: not implemented yet (issue Gegner)");
}
