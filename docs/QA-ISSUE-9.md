# QA-Bericht Issue #9

Stand: PR [#21](https://github.com/yamahabenny-gif/pomodoro-8bit/pull/21) · Branch `issue-9-qa`

## DoD-Check

Automatisiert mit `node tests/e2e/qa-report.mjs` gegen den Produktionsbuild (Chromium headless, 1280 × 720 sowie
844 × 390). Alle Prüfungen außer den beiden bekannten Lücken bestehen.

| Prüfung | Ergebnis | Hinweis |
|---|---|---|
| Menü zeigt drei Varianten | ✅ | Klassisch, 52/17, Mikro 15/3 |
| Varianten-Teilungen stimmen | ✅ | 25 · 5 · 20/4 / 52 · 17 / 15 · 3 · 15/4 |
| Start per Taste 1 öffnet das HUD | ✅ | |
| HUD zeigt Restzeit, Phase, Zyklus-Punkte, Kill-Zähler | ✅ | |
| Phase startet als Kampf | ✅ | |
| Zyklus-Punkte: 4 für Klassisch | ✅ | |
| Kill-Zähler hat drei Gegnertypen | ✅ | |
| Fenstertitel zeigt Zeit und Phase | ✅ | 24:59 · Kampf |
| Fokus: alle drei Gegnertypen erscheinen | ✅ | Gnom 1 Ork 1 Oger 1 |
| Ton: WebAudio-Sounds werden erzeugt | ✅ | 48 Oszillatoren |
| Überspringen wechselt in die Rast | ✅ | |
| Benachrichtigung am Fokusende | ✅ | „Kampf vorbei: Kurze Rast: 5 Minuten.“ |
| Benachrichtigung am Pausenende | ⚠️ [#20](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/20) | nur die Fokus-Notification vorhanden |
| Pause (Leertaste) hält die Uhr an | ✅ | 24:24 |
| Pause-Button zeigt Weiter | ✅ | |
| Weiter (Leertaste) läuft die Uhr wieder | ✅ | |
| Stummschalten (M) setzt aria-pressed | ✅ | |
| Zurücksetzen startet bei Fokus 1 im HUD | ✅ | 24:47 |
| Esc öffnet den Bestätigungsdialog | ✅ | |
| Esc schließt den Dialog wieder | ✅ | |
| Bestätigen führt zurück ins Menü | ✅ | |
| Hintergrund-Tab: Zeit folgt der Wanduhr | ✅ | 1482 s → 1284 s (198 s in 3,3 s bei `?speed=60`) |
| Reload setzt die Session automatisch fort | ⚠️ [#19](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/19) | Menü statt HUD |
| Reload: Zeit nach erneuter Variantenwahl korrekt | ✅ | 1410 s → 1351 s |
| Lange Pause nach 4 Zyklen (`?speed=600`) | ✅ | |
| Lange Pause: alle Zyklus-Punkte gefüllt | ✅ | |
| Handy Querformat: Menü ohne Überlauf | ✅ | 844 × 390 |
| Handy Querformat: HUD und vier Buttons im Bild | ✅ | Canvas 693 × 390 |
| Keine Konsolen- oder Seitenfehler | ✅ | |

Damit sind 29/29 Prüfungen erfüllt; zwei Punkte sind bekannte, verlinkte Lücken in fremden Modulen.

## Performance

`node tests/e2e/perf.mjs`, 60 s bei `?speed=60` (zwei Fokusphasen und zwei Pausen), headless Chromium auf Apple
Silicon – Referenzwert, kein echter Mittelklasse-Laptop:

```
Phase nach 60s: KAMPF (24:54)
fps: Ø 60.0 · min 60 · längster Frame 17 ms (59 Sekundenfenster)
JS-Heap: Start 12.8 MB · Peak 12.8 MB · Ende 12.8 MB · Δ 0.0 MB
DOM-Knoten: 183 → 183
Fehler: keine
```

## Tests und Build

```
npm test        → 9 Dateien, 95 Tests bestanden
npm run build   → ✓ 40 Module, dist/assets/index-*.js 138,11 kB (gzip 55,82 kB)
npm run test:e2e → 1 bestanden (5,1 s)
```

CI (`ci.yml`) ist auf PR #21 grün.

## Angelegte Issues

- [#19 Reload landet im Menü statt die laufende Session fortzusetzen](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/19)
- [#20 Keine Benachrichtigung am Ende der Pause](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/20)

## Deploy

`.github/workflows/pages.yml` baut und veröffentlicht `main` über GitHub Actions nach
<https://yamahabenny-gif.github.io/pomodoro-8bit/>. Der erste Lauf passiert nach dem Merge; Pages ist im Repo
bereits auf „GitHub Actions“ gestellt.
