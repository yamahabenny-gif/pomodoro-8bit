// CONTRACT (owned by issue "Wald & Lagerfeuer"). The forest at 320 x 180, parallax layers, floor at GROUND_Y.
//
// createForest() returns:
//   setMode(mode, { instant })   "fight" (day/afternoon, falling leaves) | "camp" (dusk, campfire lit,
//                                fireflies) | "night" (long break: stars, bigger fire). Crossfades ~1.5 s.
//   scroll(px)                   advance parallax (the heroine walks between fights)
//   update(dt)
//   background()                 Uint32Array(W*H) sky + far layers, the composite() background
//   drawBack(frame)              mid layers + campfire back layer: behind characters
//   drawFront(frame)             foreground grass/leaves + fire front layer: in front of characters
//   campfireX                    where the heroine sits in "camp"/"night"

export function createForest() {
  throw new Error("createForest: not implemented yet (issue Wald & Lagerfeuer)");
}
