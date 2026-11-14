// CONTRACT (owned by issue "Regie"). Ties the timer to the scene: what happens on stage at every moment.
//
// createDirector({ stage, forest, heroine, timer, sfx }) returns { update(dt), draw(), stats() }
//   focus phase: the heroine walks, an enemy appears, they fight, it dies, she walks on. Encounters are paced to
//                the focus length (roughly one every 30-90 s, tougher foes later in the phase) and never end mid-swing
//                when the phase ends: the current foe flees or poofs during the transition.
//   short break: transition, she walks to the campfire, sits; the forest goes "camp".
//   long break:  same, "night" mode.
//   back to focus: she stands up, stretches, walks on.
//   stats(): { kills: { gnome, orc, ogre }, focusDone } for the HUD; persisted per day.

export function createDirector(_deps) {
  throw new Error("createDirector: not implemented yet (issue Regie)");
}
