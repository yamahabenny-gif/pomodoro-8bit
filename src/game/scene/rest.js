// CONTRACT (owned by issue "Rast-Szenen"). Where the heroine rests on a break: a scene of its own, drawn instead of
// the forest while a break lasts. Same layering as the forest: background() behind, drawBack/drawFront around her.
//
// REST_KINDS: ["storm", "lake"]
//   "storm"  rain, distant thunderstorm (lightning flashes light the sky and treeline), she sits dry under a shelter
//            (rock overhang or a lean-to of branches) and lights a small fire there; drips at the shelter's edge
//   "lake"   a campfire on the shore of a still forest lake, fireflies over the water, fire and moon reflected,
//            reeds, a few stars
// createRest(kind, { night = false }) returns:
//   kind, night
//   seatX                        feet x where the heroine sits ("sit" faces right toward the fire)
//   fireX                        x of the fire (on GROUND_Y)
//   lit                          false until ignite(); an unlit fire shows the laid logs only
//   ignite()                     sparks, smoke puff, then the fire catches over ~1.5 s (the heroine's "lightFire")
//   update(dt)
//   background()                 Uint32Array(W*H), the composite() background (cache what doesn't move)
//   drawBack(frame), drawFront(frame)
// night: darker sky, more stars (the long break). Lightning in "storm" every 6-15 s, never pure white full screen.

export const REST_KINDS = ["storm", "lake"];

export function createRest(_kind, _opts = {}) {
  throw new Error("createRest: not implemented yet (issue Rast-Szenen)");
}
