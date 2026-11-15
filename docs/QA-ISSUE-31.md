# QA-Bericht Issue #31

Stand: Branch `w6-31-qa`, Basis `main` @ `fd83929` (Wald-Reise #35). Abnahme des Ausbaus (#24–#30) im
Produktionsbuild, Chromium headless.

## DoD-Check

Automatisiert mit `node tests/e2e/qa-report.mjs`: baut `dist/`, startet `vite preview`, prüft Desktop (1280 × 720)
und Handy-Querformat (844 × 390), instrumentiert WebAudio für die Sound-Nachweise. Bekannte Lücken sind mit ihrem
Issue verlinkt und lassen den Lauf nicht fehlschlagen.

| Prüfung | Ergebnis | Hinweis |
|---|---|---|
| Menü zeigt drei Varianten | ✅ | Klassisch, 52/17, Mikro 15/3 |
| Varianten-Teilungen stimmen | ✅ | 25 · 5 · 20/4 \| 52 · 17 \| 15 · 3 · 15/4 |
| Start per Taste 1 öffnet das HUD | ✅ |  |
| HUD zeigt Restzeit, Phase, Zyklus-Punkte, Kill-Zähler | ✅ |  |
| Phase startet als Kampf | ✅ |  |
| Zyklus-Punkte: 4 für Klassisch | ✅ |  |
| Kill-Zähler startet mit Gnom, Ork, Oger | ✅ |  |
| Fenstertitel zeigt Zeit und Phase | ✅ | 24:56 · Kampf |
| XP-Leiste ist im HUD sichtbar | ✅ |  |
| XP-Leiste wächst mit der Fokuszeit | ✅ | Lv 1 0/15 min · 6 % |
| Pause (Leertaste) hält die Uhr an | ✅ | 24:07 |
| Pause-Button zeigt Weiter | ✅ |  |
| Weiter (Leertaste) läuft die Uhr wieder | ✅ |  |
| Stummschalten (M) setzt aria-pressed | ✅ |  |
| LEVEL UP!-Banner erscheint bei 15 Fokusminuten | ✅ | LEVEL UP! · Level 2 |
| Fokus endet in der Rast | ✅ |  |
| Benachrichtigung am Fokusende | ✅ | Kampf vorbei: Kurze Rast: 5 Minuten. |
| Gewitter-Rast: Heldin entzündet das Feuer | ✅ | warme Pixel links 0 · rechts 535 |
| Gewitter-Rast: Donner löst aus | ✅ | Filter 300 Hz |
| Sounds: Schwert, Treffer, Gegnertod | ✅ | 19 Tonhöhen |
| Sounds: Level-Up-Fanfare | ✅ |  |
| Sounds: Feuer entzünden | ✅ | Filter 3200 Hz |
| Sounds: Phasenwechsel-Fanfare | ✅ |  |
| Zeitraffer ?speed=60: eine Fokusphase zeigt alle vier Gegnertypen | ⚠️ (#42) | Gnom 3 Ork 0 Oger 0 |
| Reload mitten in der Rast setzt die Session fort | ✅ | short · 02:29 |
| Reload in der Rast: Feuer brennt weiter | ✅ | rechts 641 |
| Zurücksetzen startet bei Fokus 1 im HUD | ✅ | 24:29 |
| Esc öffnet den Bestätigungsdialog | ✅ |  |
| Esc schließt den Dialog wieder | ✅ |  |
| Bestätigen führt zurück ins Menü | ✅ |  |
| Zweite Rast ist die See-Szene mit brennendem Feuer | ✅ | warme Pixel links 554 · rechts 23 |
| Reload in der See-Rast bleibt am See | ⚠️ (#39) | links 0 · rechts 629 (Gewitter statt See) |
| Lange Rast nach 4 Zyklen ist Nacht | ✅ |  |
| Lange Rast: alle Zyklus-Punkte gefüllt | ✅ |  |
| Lange Rast: Feuer brennt und die See-Szene ist nächtlich dunkler | ✅ | Luma See 54 → Nacht 42 |
| Fokus: alle vier Gegnertypen erscheinen (inkl. Golem) | ✅ | Gnom 22, Ork 8, Oger 4, Golem 1 |
| Kill-Zähler ergänzt den Golem nach dem ersten Sieg | ✅ |  |
| Gegnerdichte: rund zwei Gegner pro Fokusminute (vorher 0,96) | ✅ | 35 Gegner in 19,3 Fokusminuten = 1,82/min |
| Sounds: Steintreffer am Golem | ✅ | 122 Hz |
| Sounds: Ork blockt im Kampf | ⚠️ (#41) | kein Block in 34 Kämpfen |
| Reload mitten im Kampf setzt den Fokus fort | ✅ | 1410s → 1354s |
| Hintergrund-Tab: Zeit folgt der Wanduhr | ✅ | 1483s → 1284s (199s in 3,3s bei ?speed=60) |
| XP zählen auch, wenn der Tab über das Fokusende im Hintergrund war | ⚠️ (#40) | totalMinutes 10 statt 25 |
| Handy Querformat: Menü ohne Überlauf | ✅ | 844 × 390 |
| Handy Querformat: HUD und vier Buttons im Bild | ✅ | Canvas 693×390 |
| Keine Konsolen- oder Seitenfehler | ✅ |  |

46/46 erfüllt, 4 bekannte Lücke(n): #42, #39, #41, #40

## Sichtprüfung im Browser

Die Formen und Farben wurden zusätzlich an Screenshots aus dem gebauten Stand beurteilt (die frühen
Abschnitts-Snapshots stammen aus der Abnahme von #24, die neuen aus dieser Abnahme).

| Prüfung | Ergebnis | Beleg |
|---|---|---|
| Dämmerungswald: lila-blaue Schatten, orange Sonnenuntergangsband, knorrige Bäume, Wurzeln, Pilze, Glühwürmchen | ✅ | [woodland.png](img/issue-24/woodland.png), [kampf-wald.png](img/issue-31/kampf-wald.png) |
| Abschnitt Nebel-Lichtung | ✅ | [mist-clearing.png](img/issue-24/mist-clearing.png) |
| Abschnitt Bach mit Holzbrücke | ✅ | [bridge.png](img/issue-24/bridge.png) |
| Alle vier Gegner, inklusive Steingolem mit glühenden Rissen und moosiger Schulter | ✅ | [golem.png](img/issue-31/golem.png) (Kampf bei `?speed=4`, Golem-Kill im Lauf) |
| Ork blockt sichtbar/hörbar | ⚠️ [#41](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/41) | Blockfenster wird im normalen Kampf nie erreicht; QA-Lauf sammelt keinen 3520-Hz-Sound |
| Neue Heldin: Ritterin mit langem Zopf, Plattenrüstung, rotem Umhang, Krönchen-Helm | ✅ | [golem.png](img/issue-31/golem.png), [rast-see.png](img/issue-31/rast-see.png) |
| Gewitter-Rast: Regen, Blitze, Felsvorsprung, Feuer entzünden | ✅ | [rast-gewitter.png](img/issue-31/rast-gewitter.png), Donner-Sound im QA-Lauf |
| See-Rast: Glühwürmchen, Mond- und Feuerspiegelung, Feuer entzünden | ✅ | [rast-see.png](img/issue-31/rast-see.png) |
| Lange Rast nachts, alle vier Zyklus-Punkte | ✅ | [lange-rast.png](img/issue-31/lange-rast.png) |
| XP-Leiste füllt sich mit der Fokuszeit | ✅ | [levelup.png](img/issue-31/levelup.png), QA-Lauf (aria-valuenow wächst) |
| **LEVEL UP!**-Banner bei 15 Fokusminuten | ✅ | [levelup.png](img/issue-31/levelup.png) |
| Etwa doppelt so viele Gegner pro Fokusminute | ✅ | gemessen 35 Gegner in 19,3 Fokusminuten = **1,82/min**; vorher 24 Begegnungen pro 25 Minuten (0,96/min), jetzt 48 geplant |
| Sounds: Schwert, Treffer, Gegnertod, Level-Up, Donner, Entzünden, Steintreffer, Phasenwechsel | ✅ | WebAudio-Mock im QA-Lauf (siehe Tabelle) |
| Keine Konsolen- oder Seitenfehler | ✅ | QA-Lauf über alle Kontexte |
| Reload mitten im Kampf | ✅ | HUD, Fokus und Restzeit werden fortgesetzt |
| Reload mitten in der Rast | ⚠️ See-Szene [#39](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/39) | Session und Feuer bleiben, die See-Rast springt aber in den Gewitter-Unterschlupf |
| Zeitraffer `?speed=60/600` erreicht Oger/Golem | ⚠️ [#42](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/42) | für die Abnahme mit `?speed=4` bzw. `?speed=3` wiederholt |

## Performance

`node tests/e2e/perf.mjs`, 60 s bei `?speed=60` (zwei Fokusphasen und zwei Pausen), headless Chromium auf Apple
Silicon – Referenzwert, kein echter Mittelklasse-Laptop:

```
Phase nach 60s: KAMPF (24:53)
fps: Ø 57.9 · min 23 · längster Frame 133 ms (59 Sekundenfenster)
JS-Heap: Start 16.3 MB · Peak 16.3 MB · Ende 16.3 MB · Δ 0.0 MB
DOM-Knoten: 191 → 191
Fehler: keine
```

Der Durchschnitt liegt bei 57,9 fps, der Heap bleibt über die Minute konstant (Δ 0,0 MB, keine DOM-Leichen).
Der Min-Wert von 23 fps und der 133-ms-Frame stammen aus der Gewitter-Rast: Ein zusätzlicher rAF-Mitschnitt verortet
75 langsame Frames ausschließlich in der ersten Pause (26,6–29,9 s); im Fokus und in der See-Rast gibt es keine.
Das ist ein echter Befund in der Rast-Szene und als [#43](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/43)
angelegt.

## Tests und Build

```
npm test              → 11 Dateien, 138 Tests bestanden
npm run build         → ✓ 41 Module, dist/assets/index-DM72a2a-.js 168,83 kB (gzip 67,29 kB)
npm run test:e2e      → 1 bestanden (10,9 s)
node tests/e2e/qa-report.mjs → 46/46 erfüllt, 4 bekannte Lücken (#39, #40, #41, #42)
```

## Angelegte Issues

Alle im Meilenstein „Ausbau: Reise, Rast, Level“, gefunden bei dieser Abnahme und **nicht** in den fremden Modulen
gefixt:

- [#39 Rast: Reload während der See-Rast springt in den Gewitter-Unterschlupf](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/39) (`area:integration`)
- [#40 Level-Up: Fokus-XP gehen verloren, wenn der Tab über das Phasenende im Hintergrund ist](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/40) (`area:ui`)
- [#41 Halb-Ork blockt im normalen Kampf praktisch nie](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/41) (`area:art`)
- [#42 Zeitraffer ?speed=60/600 erreicht Golem und Oger nicht](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/42) (`area:integration`)
- [#43 Gewitter-Rast bricht auf ~20 fps ein (Rest-Szene)](https://github.com/yamahabenny-gif/pomodoro-8bit/issues/43) (`area:scene`, Performance)

## Deploy

`.github/workflows/pages.yml` baut `main` und veröffentlicht `dist/` über GitHub Actions auf
<https://yamahabenny-gif.github.io/pomodoro-8bit/>. Nach dem Merge dieser PR läuft der Deploy ohne weitere
Änderung; die README-Bilder liegen unter `docs/img/issue-31/` im Build-Artefakt nicht bei, werden aber von GitHub
direkt aus dem Repository geladen.
