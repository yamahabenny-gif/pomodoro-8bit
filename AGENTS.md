# Arbeitsregeln für alle Agenten (Claude, Codex, OpenCode)

Projekt: Pomodoro-Timer im 8-Bit-Look. Vollständiger Plan: `docs/PLAN.md`. Lies ihn zuerst.

## Stack
- Vanilla JavaScript (ES-Module), Vite, Vitest. Kein Framework, keine weiteren Abhängigkeiten ohne Rückfrage.
- Grafik: `pixelfx` liegt vendored unter `vendor/pixelfx/src` (MIT), Import über den Alias `pixelfx/...`
  im Browser-Code, über relative Pfade in Node-Tools. **Nichts in `vendor/` ändern.** Brauchst du eine
  Variante eines Effekts, kopiere ihn nach `src/` und behalte den Lizenz-Kopfkommentar.
- Bühne: ein 320 x 180 pixelfx-Frame (`src/engine/stage.js`), Boden bei `GROUND_Y = 150`, Pixel-Skalierung per CSS.

## Verträge
Jedes Modul hat in seiner Datei einen `CONTRACT`-Kommentar. Implementiere genau diese Schnittstelle. Wenn du sie
ändern musst, schreib das in die PR-Beschreibung und passe den Kommentar an; andere Module verlassen sich darauf.

## Zuständigkeit (nur eigene Dateien ändern)
| Issue | darf ändern |
|---|---|
| Timer-Kern | `src/timer/**`, `tests/timer*.test.js` |
| Heldin | `src/game/heroine/**`, `tools/scenes/heroine*.mjs`, `tests/heroine*.test.js` |
| Gegner | `src/game/enemies/**`, `tools/scenes/enemies*.mjs`, `tests/enemies*.test.js` |
| Wald & Lagerfeuer | `src/game/scene/**`, `tools/scenes/forest*.mjs`, `tests/forest*.test.js` |
| UI: Menü & HUD | `src/ui/**`, `tests/ui*.test.js` |
| Sound & Benachrichtigung | `src/audio/**`, `tests/audio*.test.js` |
| Regie | `src/game/director/**`, `src/main.js`, `index.html`, `tests/director*.test.js` |
| QA & Deploy | `.github/**`, `README.md`, `tests/**`, `docs/**` |

Alles andere (package.json, vite.config.js, engine, config) nur nach Rückfrage beim Koordinator.

## Pixel-Art-Methode (von pixelfx übernommen)
Code ist Ton, trau deinen Augen: zeichnen, rendern, ansehen, verbessern.
`node tools/snap.mjs tools/scenes/<deine-szene>.mjs snaps/<name>.png <sekunden>` rendert ohne Browser ein PNG
(3x vergrößert). Lege für dein Modul eine Szene in `tools/scenes/` an, rendere mehrere Zeitpunkte und sieh dir die
Bilder an, bevor du fertig meldest. Palette: dunkle Tinte `#17121f` als Umriss, wenige flache Töne pro Material.

## Qualität
- `npm test` und `npm run build` müssen grün sein.
- Zeitlogik nie aus Frame-Deltas aufsummieren; der Timer rechnet mit Zeitstempeln.
- Kommentare auf Englisch, knapp, im Stil von pixelfx. UI-Texte auf Deutsch.

## Git
- Ein Branch pro Issue, eine PR gegen `main` mit `Closes #<nr>` und Screenshots aus `tools/snap.mjs` (oder Begründung).
- Keine Force-Pushes auf `main`, keine Änderungen an fremden Branches.
