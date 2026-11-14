// CONTRACT (owned by issue "Heldin"). Our heroine: small (about 24 px tall, like pixelfx HERO2), sword and
// a pink scarf, long hair in a ponytail so she reads as "she" at a glance. Faces right; enemies come from the right.
//
// createHeroine({ x, y }) returns:
//   x, y                         feet position in stage pixels (y = GROUND_Y)
//   play(anim, { onHit, onDone }) anims: "idle" | "walk" | "attack1" | "attack2" | "attack3" | "hurt"
//                                 | "victory" | "sitDown" | "sit" | "standUp"
//                                 onHit fires on the contact frame of an attack, onDone when a one-shot ends
//   anim                         current anim name
//   update(dt)
//   draw(frame)                  draws with pixelfx painterFor(frame)
//   reach                        px in front of her feet where a sword hit lands

export function createHeroine(_opts = {}) {
  throw new Error("createHeroine: not implemented yet (issue Heldin)");
}
