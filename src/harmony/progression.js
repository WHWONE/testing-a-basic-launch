// src/harmony/progression.js

const chordPresets = {
  tonic: [
    [0, 4, 5, 3],
    [0, 3, 4, 0],
    [0, 5, 3, 4],
    [5, 3, 0, 4],
    [5, 4, 3, 4],
  ],
  subdominant: [
    [3, 4, 0, 3],
    [3, 0, 4, 5],
    [1, 4, 0, 5],
    [1, 4, 0, 3],
  ],
  dominant: [
    [4, 5, 3, 0],
    [4, 0, 3, 4],
  ],
  mediant: [
    [2, 5, 1, 4],
    [2, 3, 0, 4],
  ],
};

// Degree-to-degree weighted moves (0..6)
const chordRules = {
  0: [{ d: 3, w: 30 }, { d: 4, w: 30 }, { d: 5, w: 20 }, { d: 1, w: 10 }, { d: 2, w: 10 }],
  1: [{ d: 4, w: 80 }, { d: 5, w: 20 }],
  2: [{ d: 5, w: 70 }, { d: 3, w: 30 }],
  3: [{ d: 4, w: 45 }, { d: 0, w: 35 }, { d: 1, w: 20 }],
  4: [{ d: 0, w: 75 }, { d: 5, w: 20 }, { d: 3, w: 5 }], // V->IV is weak
  5: [{ d: 3, w: 50 }, { d: 4, w: 30 }, { d: 1, w: 20 }],
  6: [{ d: 0, w: 90 }, { d: 5, w: 10 }],
};

function weightedPick(options) {
  const total = options.reduce((s, o) => s + o.w, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    if (r < opt.w) return opt.d;
    r -= opt.w;
  }
  return options[options.length - 1].d;
}

/**
 * strategy examples: "tonic_*", "dominant_*", "mediant_*", "subdominant_*", or anything else => rule-based
 * numBars: composition bars (or “effective” bars)
 * rate: chords per bar (approx)
 */
export function generateProgression(strategy, numBars, rate) {
  const totalChords = Math.max(1, Math.floor(numBars * rate));
  const progression = [];

  const strategyBase = String(strategy || "").split("_")[0];

  // Preset pool mode
  if (chordPresets[strategyBase]) {
    const pool = chordPresets[strategyBase];
    const selected = pool[Math.floor(Math.random() * pool.length)];
    for (let i = 0; i < totalChords; i++) {
      progression.push(selected[i % selected.length]);
    }
    return progression;
  }

  // Rule-based hybrid mode
  let current = 0; // start on tonic
  for (let i = 0; i < totalChords; i++) {
    progression.push(current);
    const rules = chordRules[current] || chordRules[0];
    current = weightedPick(rules);
  }

  return progression;
}
