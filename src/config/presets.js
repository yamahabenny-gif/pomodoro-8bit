// The three timer variants offered in the start menu. Durations in minutes; the timer converts to ms.
// longBreakEvery: after how many focus phases a long break comes instead of a short one (null: never).

export const PRESETS = [
  {
    id: "classic",
    name: "Klassisch",
    focus: 25,
    shortBreak: 5,
    longBreak: 20,
    longBreakEvery: 4,
    blurb: "Einsteiger, Routineaufgaben, gegen Prokrastination",
  },
  {
    id: "deep",
    name: "52/17",
    focus: 52,
    shortBreak: 17,
    longBreak: null,
    longBreakEvery: null,
    blurb: "Deep Work, komplexe Projekte",
  },
  {
    id: "micro",
    name: "Mikro 15/3",
    focus: 15,
    shortBreak: 3,
    longBreak: 15,
    longBreakEvery: 4,
    blurb: "Geringe Motivation, ADHS, unliebsame Aufgaben",
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
