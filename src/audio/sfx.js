// CONTRACT (owned by issue "Sound & Benachrichtigung"). Synthesized 8-bit sounds with WebAudio, no files.
//
// createSfx() returns:
//   unlock()                     call on the first user gesture (browsers block audio before)
//   play(name)                   "swing" | "hit" | "enemyDie" | "hurt" | "phaseFocus" | "phaseBreak" | "click"
//   setMuted(bool), muted
//   ambience(mode)               "forest" | "fire" | null: soft looping noise beds, optional
// notify(title, body)            Notification API when the tab is hidden; asks permission once, from a click

export function createSfx() {
  const noop = () => {};
  return { unlock: noop, play: noop, setMuted: noop, muted: false, ambience: noop };
}
export function notify(_title, _body) {}
