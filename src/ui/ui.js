// CONTRACT (owned by issue "UI: Menü & HUD"). DOM overlay on top of the canvas (#ui), pixel styled.
//
// createUI(root, { presets, onStart(preset), onPause, onResume, onSkip, onReset, onMute(bool) }) returns:
//   showMenu()                   start menu: pick one of PRESETS (cards with name, durations, blurb)
//   showHud()                    big mm:ss, phase label (Kampf / Rast / Lange Rast), cycle pips,
//                                kill counter, buttons pause/resume, skip, reset, mute
//   render(timerState, stats)    update HUD; also sets document.title to "12:34 · Kampf"
// Keyboard: Space pause/resume, S skip, M mute, Esc back to menu (with confirm).

export function createUI(_root, _handlers) {
  throw new Error("createUI: not implemented yet (issue UI: Menü & HUD)");
}
