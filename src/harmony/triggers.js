// src/harmony/triggers.js

export function getHarmonicTriggers(preset, totalBeats, beatsPerBar) {
  const triggers = [];
  const totalBars = Math.ceil(totalBeats / beatsPerBar);

  if (!preset || !preset.type) {
    return [0];
  }

  if (preset.type === "bar_local") {
    // Simple bar-local offsets repeat every bar
    for (let bar = 0; bar < totalBars; bar++) {
      for (const offset of preset.offsets || [0]) {
        const triggerBeat = bar * beatsPerBar + offset;
        if (triggerBeat < totalBeats) triggers.push(triggerBeat);
      }
    }
  }

  else if (preset.type === "bar_spanning") {
    // Supports:
    // - { pattern, barOffsets: {0:[...],1:[...]} }  (cycle by bar index)
    // - { spanBars, offsets:[...] }                 (cycle by beat offsets across span)
    if (preset.barOffsets) {
      const cycleLen = preset.spanBars || 4; // default (slow_cycle/pyramid are 4)
      for (let bar = 0; bar < totalBars; bar++) {
        const barInCycle = bar % cycleLen;
        const offsets = preset.barOffsets[barInCycle] || [0];
        for (const offset of offsets) {
          const triggerBeat = bar * beatsPerBar + offset;
          if (triggerBeat < totalBeats) triggers.push(triggerBeat);
        }
      }
    } else {
      // offsets that are already expressed in beats across the multi-bar span
      const spanBars = preset.spanBars || 2;
      for (let bar = 0; bar < totalBars; bar += spanBars) {
        for (const offset of preset.offsets || [0]) {
          const triggerBeat = bar * beatsPerBar + offset;
          if (triggerBeat < totalBeats) triggers.push(triggerBeat);
        }
      }
    }
  }

  else if (preset.type === "algorithmic") {
    if (preset.pattern === "random_walk") {
      // Random chance at each grid step
      const gridSize = preset.gridSize || 0.25;
      for (let beat = 0; beat < totalBeats; beat += gridSize) {
        if (Math.random() < 0.3) triggers.push(beat); // 30% chance
      }
      // Ensure at least one trigger per bar
      for (let bar = 0; bar < totalBars; bar++) {
        const barStart = bar * beatsPerBar;
        const barEnd = barStart + beatsPerBar;
        const hasOne = triggers.some(t => t >= barStart && t < barEnd);
        if (!hasOne) triggers.push(barStart);
      }
    }

    else if (preset.pattern === "five_over_four") {
      const interval = preset.interval || 0.8;
      for (let beat = 0; beat < totalBeats; beat += interval) triggers.push(beat);
    }

    else if (preset.pattern === "pedal") {
      triggers.push(0);
    }

    else if (preset.pattern === "decrescendo" || preset.pattern === "accelerando") {
      const density = (preset.pattern === "decrescendo")
        ? [1, 0.75, 0.5, 0.25, 0.1]   // dense -> sparse
        : [0.1, 0.25, 0.5, 0.75, 1];  // sparse -> dense

      const section = totalBeats / 5;
      for (let i = 0; i < 5; i++) {
        const sectionStart = i * section;
        const sectionEnd = Math.min((i + 1) * section, totalBeats);
        const span = sectionEnd - sectionStart;

        const count = Math.max(1, Math.floor(span * density[i]));
        for (let j = 0; j < count; j++) {
          const triggerBeat = sectionStart + (j * span) / count;
          if (triggerBeat < totalBeats) triggers.push(triggerBeat);
        }
      }
    }

    else {
      // Unknown algorithmic pattern: safe fallback
      triggers.push(0);
    }
  }

  // Always ensure a trigger at 0 (important for chord start)
  if (!triggers.some(t => Math.abs(t - 0) < 1e-9)) triggers.push(0);

  // Sort + dedupe (round to 1ms-ish in beats)
  const uniqueTriggers = [...new Set(triggers.map(t => Math.round(t * 1000) / 1000))]
    .filter(t => t >= 0 && t < totalBeats)
    .sort((a, b) => a - b);

  return uniqueTriggers;
}
