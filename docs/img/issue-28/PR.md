Closes #28

## Was drin ist
- **`src/game/progress/progress.js`** nach CONTRACT: XP = Fokusminuten, `xpForLevel(L) = 15 + 5·(L−1)`, `sync(timerState)` misst den Fortschritt an `remainingMs` des Timers (nicht an der Wanduhr) — deshalb zählt `?speed=60` genauso wie Echtzeit, Pausen und Pausen-Taste geben nichts, ein Skip/Phasenwechsel nie die übersprungene Restzeit. Mehrere Level in einem Sprung werden in Reihenfolge als `levelup` gefeuert. Persistenz in `localStorage` (`pomodoro8bit.progress.v1`): sofort bei jedem Level-Up, sonst höchstens alle 5 s; kaputte/blockierte Stores werden geschluckt. `reset()` für Tests.
- **HUD (`src/ui/`)**: XP-Leiste unter der Uhr (`Lv 3` · goldene, geditherte Füllleiste mit 2-px-Rahmen · `12/25 min`), gleiche Breite wie die Uhr-Panels. Neue Signatur `render(timerState, stats, progress)`; ohne `progress` bleibt die Leiste versteckt (ältere Regie). `levelUp(level)` zeigt ein gut 2 s blinkendes **LEVEL UP!**-Banner (respektiert `prefers-reduced-motion`).
- **Kill-Zähler**: Golem-Icon (graues Steingesicht, orange Augen) — die Zeile erscheint erst, wenn `stats.kills.golem` existiert, die drei alten Zeilen sind unverändert.
- Reine Helfer für Tests: `xpLabel`, `killKinds`.

## Verträge
- Erweiterung wie im CONTRACT vorgesehen (`WAVE 4`): drittes Argument `progress` an `render`, neues `levelUp(level)`; die CONTRACT-Kommentare in `progress.js` und `ui.js` sind entsprechend nachgezogen.
- **Offen für die Regie (Issue 30):** `createProgress()` bauen, jedes Frame `sync(timer.state())` aufrufen, `state()` als drittes Argument an `ui.render` geben und `levelup` mit `ui.levelUp(level)` beantworten. Solange das fehlt, ist die Leiste in der laufenden App absichtlich versteckt — die Screenshots unten kommen aus einem Dev-Harness, das den echten HUD über der echten Waldszene mit Fake-Progress rendert.

## Tests
```
 Test Files  10 passed (10)
      Tests  117 passed (117)
```
Neu: `tests/progress.test.js` (16 Tests: 25 min = Level 2 + 10/20, Pause/Skip zählt nicht, mehrere Level in Reihenfolge, Persistenz-Roundtrip, 5-s-Drosselung, kaputter Store) und `tests/ui.test.js` +6 Tests für `xpLabel`/`killKinds`. `npm run build` grün, `npm run test:e2e` (Smoke) grün.

## Snapshots (docs/img/issue-28/)
| Bild | Inhalt |
|---|---|
| `hud-levelbar-desktop.png` | HUD 1280×720, `Lv 3`, `12/25 min` |
| `hud-levelup-desktop.png` | dasselbe mit LEVEL UP!-Banner |
| `hud-levelbar-phone.png` | Handy quer 844×390 |
| `hud-levelup-phone.png` | Handy quer mit Banner (unter der Leiste, Heldin bleibt sichtbar) |
| `hud-kills-ohne-golem.png` | Kill-Zähler ohne Golem-Stat: nur die drei alten Icons |

Reproduzierbar mit `node docs/img/issue-28/hud-shots.mjs` (startet Vite-Dev, rendert `hud-harness.html`).

Referenz ist `refs/3-golem.png` (grauer Fels, glühende orange Augen) — nur nachempfunden, nichts kopiert.
