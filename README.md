# Pomodoro 8-Bit

Ein Pomodoro-Timer im Pixel-Art-Look: Während du dich konzentrierst, kämpft eine kleine Heldin im Wald gegen Gnome,
Orks und Oger. In der Pause rastet sie am Lagerfeuer.

![Smoke-Szene](docs/img/smoke.png)

```sh
npm install
npm run dev      # http://localhost:5173  (?speed=60 = eine Minute pro Sekunde)
npm test
npm run snap -- tools/scenes/smoke.mjs snaps/smoke.png 2
```

Plan und Arbeitspakete: [docs/PLAN.md](docs/PLAN.md). Regeln für Agenten: [AGENTS.md](AGENTS.md).

Grafik-Engine: [pixelfx](https://github.com/patch-gg/pixelfx) von Patch und Hugo Duprez, MIT, vendored unter
`vendor/pixelfx` (siehe dort `LICENSE` und `NOTICE.md`).
