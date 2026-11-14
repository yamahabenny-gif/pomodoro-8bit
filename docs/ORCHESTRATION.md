# Worker-Orchestrierung mit Orca

Koordinator: Claude (dieser Workspace). Worker: OpenCode (DeepSeek V4.1 Flash) und Codex (OpenAI-Abo, GPT-6).
Jeder Worker bekommt einen eigenen Orca-Worktree mit eigenem Branch, verlinkt mit seinem GitHub-Issue, und
liefert eine PR gegen `main`. Der Koordinator prüft, merged oder schickt Korrekturen per `orca orchestration send`.

## Zuordnung
| Issue | Worktree / Branch | Agent | Modell | Welle |
|---|---|---|---|---|
| #2 Timer-Kern | `issue-2-timer` | opencode | `opencode/deepseek-v4.1-flash` | 1 |
| #3 Heldin | `issue-3-heroine` | codex | `gpt-6-luna` | 1 |
| #4 Gegner | `issue-4-enemies` | codex | `gpt-6-luna` | 1 |
| #5 Wald & Lagerfeuer | `issue-5-forest` | opencode | `opencode/deepseek-v4.1-flash` | 1 |
| #6 UI: Menü & HUD | `issue-6-ui` | opencode | `opencode/deepseek-v4.1-flash` | 1 |
| #7 Sound & Benachrichtigung | `issue-7-audio` | opencode | `opencode/deepseek-v4.1-flash` | 1 |
| #8 Regie | `issue-8-director` | codex | `gpt-6-luna` | 2 (nach Merge von #2–#7) |
| #9 QA, Deploy, README | `issue-9-qa` | opencode | `opencode/deepseek-v4.1-flash` | 3 (nach #8) |

Weitere verfügbare Modelle, falls ein Paket hängt: OpenCode `opencode/deepseek-v4-pro`, `opencode/kimi-k3`,
`opencode/glm-5.3`; Codex `gpt-6-sol`, `gpt-6.1-sol`, `gpt-6.1-terra`.

## Start (pro Issue)
OpenCode braucht für die Modellwahl einen bestehenden Worktree, deshalb zwei Schritte:

```sh
# 1. Worktree vom aktuellen main, verlinkt mit dem Issue
orca worktree create --name issue-2-timer --branch issue-2-timer --base-branch origin/main \
  --issue 2 --parent-worktree active --setup skip --json

# 2. Worker hineinsetzen (Spec = Vorlage unten mit Nummer ersetzt)
orca orchestration worker-start --worktree <worktree-selector-aus-1> \
  --agent opencode --model opencode/deepseek-v4.1-flash \
  --task-title "#2 Timer-Kern" --spec-file <spec-2.md>
```
Für Codex genauso, mit `--agent codex --model gpt-6-luna`.

## Spec-Vorlage
```text
Du arbeitest an GitHub-Issue #<N> im Repo yamahabenny-gif/pomodoro-8bit (dieser Worktree, Branch issue-<N>-<name>).
1. Lies AGENTS.md, docs/PLAN.md und das Issue: gh issue view <N> --repo yamahabenny-gif/pomodoro-8bit
2. npm install
3. Setze das Issue um. Ändere nur die Dateien aus der Zuständigkeitstabelle in AGENTS.md. Halte den CONTRACT-Kommentar
   deiner Moduldatei ein.
4. Grafik-Pakete: rendere mit `node tools/snap.mjs` mehrere Snapshots, sieh sie dir an und verbessere, bevor du fertig
   meldest. Lege die PNGs unter docs/img/issue-<N>/ ab und verlinke sie in der PR.
5. npm test und npm run build müssen grün sein. Nicht-null-Exit = Aufgabe nicht erledigt.
6. Commit, push, PR gegen main mit "Closes #<N>", Testausgabe und Snapshots in der Beschreibung.
7. Melde worker_done mit PR-URL, Testergebnis und offenen Punkten. Bei Unklarheiten zum Vertrag: ask an den Koordinator.
```

## Prüfung durch den Koordinator
- CI grün, Diff nur in den eigenen Dateien, Vertrag eingehalten.
- Snapshots ansehen (Pixel-Art-Qualität, Stil passt zu pixelfx und den anderen Figuren).
- Merge-Reihenfolge Welle 1: #2, #7, #6, #5, #4, #3 (Logik zuerst, Grafik zuletzt). Danach Welle 2 starten.
