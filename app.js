const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const piano = document.getElementById('piano');

// ────────────────────────────────────────────────
//  SoundFont integration (Preserved)
// ────────────────────────────────────────────────

let instrument = null;
let isLoading = false;
const soundFontUrl = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js";

// ────────────────────────────────────────────────
//  HARMONIC RHYTHM PRESET REGISTRY (Phase 1)
// ────────────────────────────────────────────────
const harmonicRhythmPresets = {
    pillar: { type: 'bar_local', offsets: [0] },
    pulse: { type: 'bar_local', offsets: [0, 2] },
    march: { type: 'bar_local', offsets: [0, 1, 2, 3] },
    waltz_feel: { type: 'bar_local', offsets: [0, 1, 2] },
    push: { type: 'bar_local', offsets: [3.5] },
    charleston: { type: 'bar_local', offsets: [0, 1.5] },
    backbeat: { type: 'bar_local', offsets: [1, 3] },
    anticipator: { type: 'bar_local', offsets: [1.5, 3.5] },
    heartbeat: { type: 'bar_local', offsets: [0, 0.5] },
    off_grid: { type: 'bar_local', offsets: [0.5, 1.5, 2.5, 3.5] },
    gallop: { type: 'bar_local', offsets: [0, 0.75, 1] },
    hemiola: { type: 'bar_local', offsets: [0, 1.5, 3] },
    slow_cycle: { type: 'bar_spanning', pattern: 'slow_cycle', barOffsets: {0: [0], 1: [3], 2: [2], 3: [1]} },
    tremolo_block: { type: 'bar_local', offsets: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75] },
    ghost_notes: { type: 'bar_local', offsets: [0, 2.5, 3.5] },
    bossa_nova: { type: 'bar_spanning', pattern: 'bossa_nova', spanBars: 2, offsets: [0, 1.5, 3, 4.5] },
    cinematic_swell: { type: 'bar_local', offsets: [1] },
    trap_triplets: { type: 'bar_local', offsets: [2, 2.33, 2.66] },
    pyramid: { type: 'bar_spanning', pattern: 'pyramid', barOffsets: {0: [0], 1: [0, 2], 2: [0, 1, 2, 3], 3: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]} },
    random_walk: { type: 'algorithmic', pattern: 'random_walk', gridSize: 0.25 },
    triplet_eighths: { type: 'bar_local', offsets: [0, 0.33, 0.66, 1, 1.33, 1.66, 2, 2.33, 2.66, 3, 3.33, 3.66] },
    triplet_quarters: { type: 'bar_local', offsets: [0, 0.66, 1.33, 2, 2.66, 3.33] },
    e_and_a: { type: 'bar_local', offsets: [0.25, 1.25, 2.25, 3.25] },
    double_pushed: { type: 'bar_local', offsets: [1.5, 3.5] },
    five_over_four: { type: 'algorithmic', pattern: 'five_over_four', interval: 0.8 },
    pedal: { type: 'algorithmic', pattern: 'pedal' },
    decrescendo: { type: 'algorithmic', pattern: 'decrescendo' },
    accelerando: { type: 'algorithmic', pattern: 'accelerando' }
};

// ────────────────────────────────────────────────
//  PHASE 2: BEAT-MATCHING HELPER FUNCTIONS
// ────────────────────────────────────────────────

function getHarmonicTriggers(preset, totalBeats, beatsPerBar) {
    const triggers = [];
    const totalBars = Math.ceil(totalBeats / beatsPerBar);
    
    if (preset.type === 'bar_local') {
        // Simple bar-local offsets repeat every bar
        for (let bar = 0; bar < totalBars; bar++) {
            preset.offsets.forEach(offset => {
                const triggerBeat = bar * beatsPerBar + offset;
                if (triggerBeat < totalBeats) {
                    triggers.push(triggerBeat);
                }
            });
        }
    } else if (preset.type === 'bar_spanning') {
        // Bar-spanning patterns
        if (preset.pattern === 'slow_cycle') {
            // 4-bar cycle: Bar1:0, Bar2:3, Bar3:2, Bar4:1
            for (let bar = 0; bar < totalBars; bar++) {
                const barInCycle = bar % 4;
                const offsets = preset.barOffsets[barInCycle] || [0];
                offsets.forEach(offset => {
                    const triggerBeat = bar * beatsPerBar + offset;
                    if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                });
            }
        } else if (preset.pattern === 'bossa_nova') {
            // 2-bar pattern: [0, 1.5, 3, 4.5]
            const spanBars = preset.spanBars || 2;
            const cycleBeats = spanBars * beatsPerBar;
            for (let bar = 0; bar < totalBars; bar += spanBars) {
                preset.offsets.forEach(offset => {
                    const triggerBeat = bar * beatsPerBar + offset;
                    if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                });
            }
        } else if (preset.pattern === 'pyramid') {
            // 4-bar pattern: Bar1 [0], Bar2 [0,2], Bar3 [0,1,2,3], Bar4 = 16ths
            for (let bar = 0; bar < totalBars; bar++) {
                const barInCycle = bar % 4;
                const offsets = preset.barOffsets[barInCycle] || [0];
                offsets.forEach(offset => {
                    const triggerBeat = bar * beatsPerBar + offset;
                    if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                });
            }
        }
    } else if (preset.type === 'algorithmic') {
        // Algorithmic patterns
        if (preset.pattern === 'random_walk') {
            // Random check every quarter-beat (gridSize: 0.25)
            const gridSize = preset.gridSize || 0.25;
            for (let beat = 0; beat < totalBeats; beat += gridSize) {
                if (Math.random() < 0.3) { // 30% chance per grid point
                    triggers.push(beat);
                }
            }
            // Ensure at least one trigger per bar
            for (let bar = 0; bar < totalBars; bar++) {
                const barStart = bar * beatsPerBar;
                const barEnd = barStart + beatsPerBar;
                const hasBarTrigger = triggers.some(t => t >= barStart && t < barEnd);
                if (!hasBarTrigger) {
                    triggers.push(barStart);
                }
            }
        } else if (preset.pattern === 'five_over_four') {
            // Trigger every 0.8 beats
            const interval = preset.interval || 0.8;
            for (let beat = 0; beat < totalBeats; beat += interval) {
                triggers.push(beat);
            }
        } else if (preset.pattern === 'pedal') {
            // Only trigger at phrase start (beat 0)
            triggers.push(0);
        } else if (preset.pattern === 'decrescendo') {
            // Dense early, sparse later
            const density = [1, 0.75, 0.5, 0.25, 0.1]; // Decreasing density per section
            const section = totalBeats / 5;
            for (let i = 0; i < 5; i++) {
                const sectionStart = i * section;
                const sectionEnd = Math.min((i + 1) * section, totalBeats);
                const triggers_in_section = Math.max(1, Math.floor((sectionEnd - sectionStart) * density[i]));
                for (let j = 0; j < triggers_in_section; j++) {
                    const triggerBeat = sectionStart + (j * (sectionEnd - sectionStart) / triggers_in_section);
                    if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                }
            }
        } else if (preset.pattern === 'accelerando') {
            // Sparse early, dense later
            const density = [0.1, 0.25, 0.5, 0.75, 1]; // Increasing density per section
            const section = totalBeats / 5;
            for (let i = 0; i < 5; i++) {
                const sectionStart = i * section;
                const sectionEnd = Math.min((i + 1) * section, totalBeats);
                const triggers_in_section = Math.max(1, Math.floor((sectionEnd - sectionStart) * density[i]));
                for (let j = 0; j < triggers_in_section; j++) {
                    const triggerBeat = sectionStart + (j * (sectionEnd - sectionStart) / triggers_in_section);
                    if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                }
            }
        }
    }
    
    // Sort and deduplicate triggers
    const uniqueTriggers = [...new Set(triggers.map(t => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
    return uniqueTriggers;
}

// ────────────────────────────────────────────────
//  PHASE 3: MELODY GRAVITY HELPER FUNCTIONS
// ────────────────────────────────────────────────

function getCurrentChord(beatPosition, chords) {
    // Find which chord is active at the given beat position
    for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        const nextChord = chords[i + 1];
        const chordEnd = nextChord ? nextChord.triggerBeat : Infinity;
        if (beatPosition >= chord.triggerBeat && beatPosition < chordEnd) {
            return chord;
        }
    }
    return chords[chords.length - 1]; // Return last chord if past all triggers
}

function getNextHarmonicBoundary(beatPosition, chords) {
    // Find the next chord change beat
    for (let i = 0; i < chords.length; i++) {
        if (chords[i].triggerBeat > beatPosition) {
            return chords[i].triggerBeat;
        }
    }
    return Infinity; // No more boundaries
}

function getChordTones(chord, availableNotes) {
    // Extract chord tones (scale degrees 1-3-5) from available notes
    if (!chord || !chord.notes) return [];
    const chordDegrees = chord.notes.map(n => n.scaleDegree);
    return availableNotes.filter(n => chordDegrees.includes(n.scaleDegree));
}


async function loadPiano() {
    if (instrument || isLoading) return;
    isLoading = true;
    const display = document.getElementById('melody-display');
    const originalText = display.innerHTML;
    try {
        display.innerHTML = "Loading realistic piano soundfont... (5–15 seconds depending on connection)";
        instrument = await Soundfont.instrument(audioCtx, soundFontUrl, {
            release: 0.6, gain: 1.35
        });
        display.innerHTML = originalText.includes("No composition") 
            ? "Piano loaded ✓<br>No composition generated yet." 
            : originalText + "<br><br><strong>Realistic piano sound loaded!</strong>";
    } catch (err) {
        console.error("Soundfont loading failed:", err);
        display.innerHTML = originalText + "<br><br><em>Could not load piano soundfont — using basic synth fallback.</em>";
        instrument = null;
    } finally { isLoading = false; }
}

window.addEventListener('load', loadPiano);

const internalChromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const enharmonicMap = {
    'C':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'C#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Db':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    'D':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'D#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Eb':  ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    'E':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'F':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'F#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Gb':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    'G':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'G#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Ab':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    'A':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'A#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Bb':  ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    'B':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
};

let keyMap = {};

function getFrequency(note, octave) {
    const lookupNote = note.replace('b', '#')
                          .replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#')
                          .replace('Ab', 'G#').replace('Bb', 'A#');
    const noteIndex = internalChromatic.indexOf(lookupNote);
    if (noteIndex === -1) return 440;
    const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function playNote(freq, velocity = 80, durationSec = 0.5) {
    const now = audioCtx.currentTime;
    const velGain = velocity / 127;
    
    // PHASE 4: Support both single frequency and array of frequencies (chords)
    const frequencies = Array.isArray(freq) ? freq : [freq];
    const numVoices = frequencies.length;
    
    // Prevent clipping: scale gain by sqrt(n) for polyphonic playback
    const polyGainScale = 1 / Math.sqrt(numVoices);
    
    if (instrument) {
        // Soundfont implementation: create multiple players
        const players = [];
        frequencies.forEach(f => {
            const midiNote = Math.round(12 * Math.log2(f / 440) + 69);
            const player = instrument.play(midiNote, now, { gain: velGain * 1.4 * polyGainScale });
            player.stop(now + durationSec);
            players.push(player);
        });
    } else {
        // Fallback oscillator implementation: multiple oscillators through one envelope
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(velGain * polyGainScale, now + 0.006);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.15);
        masterGain.connect(audioCtx.destination);
        
        frequencies.forEach(f => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = f;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2800 + f * 1.2;
            osc.connect(filter).connect(masterGain);
            osc.start(now);
            osc.stop(now + durationSec + 0.2);
        });
    }
}

// Build piano (Preserved)
let keyIndex = 0;
for (let octave = 1; octave <= 6; octave++) {
    const octaveDiv = document.createElement('div');
    octaveDiv.className = 'octave';
    internalChromatic.forEach(note => {
        if (keyIndex >= 61) return;
        const isBlack = note.includes('#');
        const key = document.createElement('div');
        key.className = `key ${isBlack ? 'black' : ''}`;
        key.dataset.note = note;
        key.dataset.octave = octave;
        key.addEventListener('mousedown', () => {
            playNote(getFrequency(note, octave), 90, 1.2);
            key.classList.add('active');
        });
        key.addEventListener('mouseup', () => key.classList.remove('active'));
        key.addEventListener('mouseleave', () => key.classList.remove('active'));
        if (isBlack && octaveDiv.lastChild) octaveDiv.lastChild.appendChild(key);
        else octaveDiv.appendChild(key);
        keyIndex++;
    });
    piano.appendChild(octaveDiv);
}

const keyboardLayout = ['Z','S','X','D','C','V','G','B','H','N','J','M','Q','2','W','3','E','R','5','T','6','Y','7','U','I','9','O','0','P'];
const pianoKeys = Array.from(piano.querySelectorAll('.key'));
keyboardLayout.forEach((char, i) => { if (i < pianoKeys.length) keyMap[char.toLowerCase()] = pianoKeys[i]; });

document.addEventListener('keydown', e => {
    const key = keyMap[e.key.toLowerCase()];
    if (key && !key.classList.contains('active')) key.dispatchEvent(new MouseEvent('mousedown'));
});
document.addEventListener('keyup', e => {
    const key = keyMap[e.key.toLowerCase()];
    if (key) key.classList.remove('active');
});

const modeIntervals = {
    major:           [0,2,4,5,7,9,11],
    natural_minor:   [0,2,3,5,7,8,10],
    harmonic_minor:  [0,2,3,5,7,8,11],
    melodic_minor:   [0,2,3,5,7,9,11],
    dorian:          [0,2,3,5,7,9,10],
    mixolydian:      [0,2,4,5,7,9,10],
    phrygian:        [0,1,3,5,7,8,10],
    lydian:          [0,2,4,6,7,9,11]
};

function buildScale(root, mode) {
    const rootLookup = root.replace('b', '#').replace('Db','C#').replace('Eb','D#').replace('Gb','F#').replace('Ab','G#').replace('Bb','A#');
    const rootIdx = internalChromatic.indexOf(rootLookup);
    if (rootIdx === -1) return [];
    const intervals = modeIntervals[mode] || modeIntervals.major;
    const scale = [];
    const displayNames = enharmonicMap[root] || internalChromatic;
    for (let i = 0; i < intervals.length; i++) {
        const semitones = intervals[i];
        const noteIdx = (rootIdx + semitones) % 12;
        const octaveOffset = Math.floor((rootIdx + semitones) / 12);
        scale.push({note: displayNames[noteIdx], internalNote: internalChromatic[noteIdx], octaveOffset});
    }
    return scale;
}

function generateScaleNotes(root, mode, lowOct = 1, highOct = 6) {
    const baseScale = buildScale(root, mode);
    const notes = [];
    for (let o = lowOct; o <= highOct; o++) {
        baseScale.forEach((step, i) => {
            const octave = o + step.octaveOffset;
            if (octave >= 1 && octave <= 6) {
                notes.push({ note: step.note, octave, freq: getFrequency(step.internalNote, octave), scaleDegree: i });
            }
        });
    }
    return notes;
}

const lowSelect = document.getElementById('lowNote');
const highSelect = document.getElementById('highNote');
function updateRangeDropdowns() {
    const scaleNotes = generateScaleNotes(document.getElementById('rootNote').value, document.getElementById('mode').value, 1, 6);
    lowSelect.innerHTML = ''; highSelect.innerHTML = '';
    scaleNotes.forEach((n, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.text = n.note + n.octave;
        lowSelect.appendChild(opt.cloneNode(true)); highSelect.appendChild(opt);
    });
    const tonicIdx = scaleNotes.findIndex(n => n.scaleDegree === 0 && n.octave === 3);
    lowSelect.value = tonicIdx >= 0 ? tonicIdx : 0;
    highSelect.value = scaleNotes.length - 1;
}
document.getElementById('rootNote').addEventListener('change', updateRangeDropdowns);
document.getElementById('mode').addEventListener('change', updateRangeDropdowns);
updateRangeDropdowns();

const bpmSlider = document.getElementById('bpm');
const bpmValue = document.getElementById('bpmValue');
bpmSlider.addEventListener('input', () => bpmValue.textContent = `${bpmSlider.value} BPM`);

const chordVolumeSlider = document.getElementById('chordVolume');
const chordVolumeValue = document.getElementById('chordVolumeValue');
chordVolumeSlider.addEventListener('input', () => chordVolumeValue.textContent = chordVolumeSlider.value);

document.querySelectorAll('input[type="range"][id^="weight-"]').forEach(slider => {
    const valSpan = slider.nextElementSibling;
    if (valSpan && valSpan.classList.contains('weight-val')) {
        slider.addEventListener('input', () => valSpan.textContent = slider.value);
    }
});


// ────────────────────────────────────────────────
//  UPGRADE: HARMONIC SYSTEM DATA (NEW)
// ────────────────────────────────────────────────
const chordPresets = {
    tonic: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [5, 3, 0, 4], [5, 4, 3, 4]],
    subdominant: [[3, 4, 0, 3], [3, 0, 4, 5], [1, 4, 0, 5], [1, 4, 0, 3]],
    dominant: [[4, 5, 3, 0], [4, 0, 3, 4]],
    mediant: [[2, 5, 1, 4], [2, 3, 0, 4]]
};

const chordRules = {
    0: [{d:3, w:30}, {d:4, w:30}, {d:5, w:20}, {d:1, w:10}, {d:2, w:10}], 
    1: [{d:4, w:80}, {d:5, w:20}], 
    2: [{d:5, w:70}, {d:3, w:30}], 
    3: [{d:4, w:45}, {d:0, w:35}, {d:1, w:20}],
    4: [{d:0, w:75}, {d:5, w:20}, {d:3, w:5}], // V->IV is weak (5%)
    5: [{d:3, w:50}, {d:4, w:30}, {d:1, w:20}],
    6: [{d:0, w:90}, {d:5, w:10}]
};

function generateProgression(strategy, numBars, rate) {
    const totalChords = numBars * rate;
    let progression = [];
    const strategyBase = strategy.split('_')[0];

    if (chordPresets[strategyBase]) {
        const pool = chordPresets[strategyBase];
        const selected = pool[Math.floor(Math.random() * pool.length)];
        for(let i = 0; i < totalChords; i++) progression.push(selected[i % selected.length]);
    } else {
        // Rule-based Hybrid
        let current = 0; // Always start on Tonic
        for(let i = 0; i < totalChords; i++) {
            progression.push(current);
            const rules = chordRules[current] || chordRules[0];
            let totalW = rules.reduce((s, o) => s + o.w, 0);
            let r = Math.random() * totalW;
            for(let opt of rules) { if(r < opt.w) { current = opt.d; break; } r -= opt.w; }
        }
    }
    return progression;
}

// ────────────────────────────────────────────────
//  ORIGINAL GENERATOR ENGINE (Preserved)
// ────────────────────────────────────────────────
let melody = [];
let currentChords = []; // Added for progression tracking

const rhythmOptions = [
    {type: 'note', name: 'whole', baseSec: 2.0, prob: 0.01, beats: 4.0},
    {type: 'note', name: 'half', baseSec: 1.0, prob: 0.05, beats: 2.0},
    {type: 'note', name: 'dotted quarter', baseSec: 0.75, prob: 0.10, beats: 1.5},
    {type: 'note', name: 'quarter', baseSec: 0.5, prob: 0.22, beats: 1.0},
    {type: 'note', name: 'dotted eighth', baseSec: 0.375, prob: 0.18, beats: 0.75},
    {type: 'note', name: 'eighth', baseSec: 0.25, prob: 0.26, beats: 0.5},
    {type: 'note', name: 'dotted 16th', baseSec: 0.1875, prob: 0.08, beats: 0.375},
    {type: 'note', name: '16th', baseSec: 0.125, prob: 0.14, beats: 0.25},
    {type: 'rest', name: 'whole rest', baseSec: 2.0, prob: 0.01, beats: 4.0},
    {type: 'rest', name: 'half rest', baseSec: 1.0, prob: 0.02, beats: 2.0},
    {type: 'rest', name: 'dotted quarter rest', baseSec: 0.75, prob: 0.03, beats: 1.5},
    {type: 'rest', name: 'quarter rest', baseSec: 0.5, prob: 0.05, beats: 1.0},
    {type: 'rest', name: 'dotted eighth rest', baseSec: 0.375, prob: 0.04, beats: 0.75},
    {type: 'rest', name: 'eighth rest', baseSec: 0.25, prob: 0.06, beats: 0.5},
    {type: 'rest', name: 'dotted 16th rest', baseSec: 0.1875, prob: 0.02, beats: 0.375},
    {type: 'rest', name: '16th rest', baseSec: 0.125, prob: 0.04, beats: 0.25}
];

function getRhythmWeight(r) {
    const key = `weight-${r.type}-${r.name.replace(/ /g, '-').toLowerCase()}`;
    const slider = document.getElementById(key);
    return slider ? parseInt(slider.value) : Math.round(r.prob * 100);
}

function getRandomRhythm(remainingBeatsInBar = Infinity) {
    let candidates = rhythmOptions.filter(r => r.beats <= remainingBeatsInBar + 0.001);
    if (candidates.length === 0) candidates = rhythmOptions.filter(r => r.beats <= 0.5);
    let totalWeight = candidates.reduce((sum, r) => sum + getRhythmWeight(r), 0);
    if (totalWeight === 0) {
    console.warn('All rhythm weights are zero! Defaulting to quarter note.');
    return candidates.find(r => r.type === 'note' && r.name === 'quarter') || candidates[0];
}
    let rand = Math.random() * totalWeight;
    let cum = 0;
    for (const opt of candidates) {
    cum += getRhythmWeight(opt);
    if (rand <= cum) return opt;
}
    return candidates[0];
}

const intervalPresets = {
    natural: [{steps: 0, weight: 0.20}, {steps: 1, weight: 0.35}, {steps: -1, weight: 0.35}, {steps: 2, weight: 0.12}, {steps: -2, weight: 0.12}, {steps: 3, weight: 0.08}, {steps: -3, weight: 0.08}, {steps: 4, weight: 0.05}, {steps: -4, weight: 0.05}, {steps: 5, weight: 0.03}, {steps: -5, weight: 0.03}],
    stepwise: [{steps: 0, weight: 0.25}, {steps: 1, weight: 0.40}, {steps: -1, weight: 0.40}, {steps: 2, weight: 0.10}, {steps: -2, weight: 0.10}, {steps: 3, weight: 0.05}, {steps: -3, weight: 0.05}],
    leaps: [{steps: 0, weight: 0.15}, {steps: 1, weight: 0.15}, {steps: -1, weight: 0.15}, {steps: 3, weight: 0.15}, {steps: -3, weight: 0.15}, {steps: 5, weight: 0.10}, {steps: -5, weight: 0.10}, {steps: 4, weight: 0.10}, {steps: -4, weight: 0.10}],
    chromatic: [{steps: 0, weight: 0.20}, {steps: 1, weight: 0.20}, {steps: -1, weight: 0.20}, {steps: 2, weight: 0.10}, {steps: -2, weight: 0.10}]
};

function getWeightedInterval(style) {
    const weights = intervalPresets[style] || intervalPresets.natural;
    let total = weights.reduce((sum, w) => sum + w.weight, 0);
    let r = Math.random() * total, sum = 0;
    for (const w of weights) { sum += w.weight; if (r <= sum) return w.steps; }
    return 1;
}

document.getElementById('generateBtn').addEventListener('click', () => {
    loadPiano();
    
    // Phase 1: Store selected harmonic rhythm preset (behavior unchanged)
    const selectedHarmonicRhythmKey = document.getElementById('harmonicRhythm').value;
    const selectedHarmonicRhythmPreset = harmonicRhythmPresets[selectedHarmonicRhythmKey];
    
    const root = document.getElementById('rootNote').value, mode = document.getElementById('mode').value;
    const contour = document.getElementById('contour').value, numBars = parseInt(document.getElementById('numBars').value);
    const timeSig = document.getElementById('timeSig').value, beatsPerBar = parseInt(timeSig.split('/')[0]);
    const totalBeats = numBars * beatsPerBar;
    const lowIdx = parseInt(document.getElementById('lowNote').value), highIdx = parseInt(document.getElementById('highNote').value);
    const motifStartProb = parseFloat(document.getElementById('motifStartProb').value), motifRepeatChance = parseFloat(document.getElementById('motifRepeatChance').value);
    const motifLen = parseInt(document.getElementById('motifLength').value), intervalStyle = document.getElementById('intervalStyle').value;
    const bpm = parseInt(document.getElementById('bpm').value), phraseLenBars = parseInt(document.getElementById('phraseLen').value);
    const phraseLenBeats = phraseLenBars * beatsPerBar;

    if (lowIdx > highIdx || highIdx - lowIdx < 4) { alert("Select a wider range for better musical results."); return; }
    const fullScale = generateScaleNotes(root, mode, 1, 6), available = fullScale.slice(lowIdx, highIdx + 1);
    if (available.length < 5) { alert("Scale range too small."); return; }

    // ────────────────────────────────────────────────
    //  PHASE 2: GENERATE CHORDS (HARMONIC RHYTHM DRIVEN)
    // ────────────────────────────────────────────────
    
    // Get harmonic rhythm triggers based on selected preset
    const harmonicTriggers = getHarmonicTriggers(selectedHarmonicRhythmPreset, totalBeats, beatsPerBar);
    
    // Generate chord progression for the number of triggers
    const chordStrategy = document.getElementById('chordStrategy').value;
    const numChords = harmonicTriggers.length;
    const prog = generateProgression(chordStrategy, Math.ceil(numChords / 4), Math.max(1, Math.ceil(numChords / numBars)));
    const scaleForChords = generateScaleNotes(root, mode, 3, 4);
    
    // Map each trigger to a chord
    currentChords = harmonicTriggers.map((triggerBeat, index) => {
        const degree = prog[index % prog.length]; // Cycle through progression if needed
        const triad = [degree, (degree + 2) % 7, (degree + 4) % 7].map(d => {
            const match = scaleForChords.find(n => n.scaleDegree === d);
            return match || scaleForChords[0];
        });
        
        // Calculate duration until next trigger (or end of composition)
        const nextTrigger = harmonicTriggers[index + 1] || totalBeats;
        const durationBeats = nextTrigger - triggerBeat;
        const durationSec = durationBeats * (60 / bpm);
        
        const chordName = triad[0].note + (mode.includes('minor') && [0,3,4].includes(degree) ? 'm' : '');
        return { 
            notes: triad, 
            durationSec: durationSec, 
            beats: durationBeats, 
            name: chordName,
            triggerBeat: triggerBeat  // Store trigger beat for reference
        };
    });

    // ────────────────────────────────────────────────
    //  PHASE 2: GENERATE MELODY (PRESERVED)
    // ────────────────────────────────────────────────
    melody = [];
    let startNote = available.find(n => n.scaleDegree === 0 && n.octave === 4) || available.find(n => n.scaleDegree === 0) || available[Math.floor(available.length * 0.35)];
    let current = startNote, currentIdx = available.indexOf(current);
    let currentTotalBeats = 0, currentBeatInBar = 0, barContents = [[]];

    let rhythm = getRandomRhythm(beatsPerBar);
    let sec = rhythm.baseSec * (120 / bpm), vel = 78 + Math.floor(Math.random() * 22);
    
    // PHASE 3: Apply duration safety to first note
    const firstBoundary = getNextHarmonicBoundary(0, currentChords);
    let firstBeats = rhythm.beats;
    let firstSec = sec;
    if (rhythm.beats > firstBoundary && firstBoundary > 0.1) {
        firstBeats = firstBoundary;
        firstSec = firstBeats * (60 / bpm);
    }
    
    let item = {isRest:false, freq:current.freq, durationSec:firstSec, velocity:vel, display:`${current.note}${current.octave} ${rhythm.name}`, beats: firstBeats};
    melody.push(item); barContents[0].push(item);
    currentTotalBeats += firstBeats; currentBeatInBar += firstBeats;

    let motifStartIdx = -1, motifLengthInNotes = 0, motifBuffer = [], noteCount = 1;
    const approxPhrase1Len = Math.floor(totalBeats / 2), peakPos = Math.floor(approxPhrase1Len * (0.4 + Math.random() * 0.3));
    let currentPhraseBeats = rhythm.beats;

    while (currentTotalBeats < totalBeats - 2) {
        const remainingInBar = beatsPerBar - currentBeatInBar;
        rhythm = getRandomRhythm(remainingInBar);
        sec = rhythm.baseSec * (120 / bpm);

        if (rhythm.type === 'rest') {
            item = {isRest:true, durationSec:sec, display:rhythm.name, beats: rhythm.beats};
            melody.push(item); barContents[barContents.length - 1].push(item);
            currentTotalBeats += rhythm.beats; currentBeatInBar += rhythm.beats; currentPhraseBeats += rhythm.beats;
            if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
            continue;
        }

        let direction = 0;
        if (contour === 'rising') direction = 1;
        else if (contour === 'falling') direction = -1;
        else if (contour === 'arch') direction = (noteCount <= peakPos) ? 1 : -1;
        else if (contour === 'wavy') direction = (Math.random() < 0.5) ? 1 : -1;
        else if (contour === 'descending_arch') direction = (noteCount < approxPhrase1Len * 0.6) ? -1 : (Math.random() < 0.4 ? 1 : -1);
        else if (contour === 'stepwise_with_leaps') direction = (Math.random() < 0.7) ? (Math.random() < 0.5 ? 1 : -1) : (Math.random() < 0.5 ? 3 : -3);
        else if (contour === 'circular') direction = (Math.random() < 0.6) ? (Math.random() < 0.5 ? 1 : -1) : 0;
        else direction = (Math.random() < 0.5) ? 1 : -1;

        let stepSize = getWeightedInterval(intervalStyle), nextIdx = currentIdx + stepSize;
        if (Math.random() < 0.38) nextIdx = currentIdx;
        else if (Math.random() < 0.28) nextIdx = currentIdx + direction;

        if (motifLen > 1 && motifStartIdx < 0 && noteCount >= motifLen && Math.random() < motifStartProb) {
            motifStartIdx = melody.length - motifLen;
            motifBuffer = melody.slice(motifStartIdx).filter(m => !m.isRest);
            motifLengthInNotes = motifBuffer.length;
        }

        if (Math.random() < 0.18 && rhythm.baseSec <= 0.25) {
            if (Math.abs(nextIdx - currentIdx) === 2) {
                const mid = Math.floor((currentIdx + nextIdx)/2);
                if (mid !== currentIdx && mid !== nextIdx) nextIdx = mid;
            }
        }

        nextIdx = Math.max(0, Math.min(available.length-1, nextIdx));
        
        // PHASE 3: Apply chord-tone gravity (70% boost)
        const currentChord = getCurrentChord(currentTotalBeats, currentChords);
        const chordTones = getChordTones(currentChord, available);
        
        if (chordTones.length > 0 && Math.random() < 0.70) {
            // 70% chance to prefer chord tones
            const closestChordTone = chordTones.reduce((closest, ct) => {
                const ctIdx = available.indexOf(ct);
                const closestIdx = available.indexOf(closest);
                return Math.abs(ctIdx - currentIdx) < Math.abs(closestIdx - currentIdx) ? ct : closest;
            }, chordTones[0]);
            nextIdx = available.indexOf(closestChordTone);
        }
        
        current = available[nextIdx]; currentIdx = nextIdx;
        vel = 55 + Math.floor(Math.random() * 45);
        
        // PHASE 3: Duration safety - clamp to next harmonic boundary
        const nextBoundary = getNextHarmonicBoundary(currentTotalBeats, currentChords);
        const beatsToBoundary = nextBoundary - currentTotalBeats;
        let finalBeats = rhythm.beats;
        let finalSec = sec;
        
        // Check if note would overhang the boundary
        if (rhythm.beats > beatsToBoundary && beatsToBoundary > 0.1) {
            // Clamp duration to boundary (unless legato mode - not implemented yet)
            finalBeats = beatsToBoundary;
            finalSec = finalBeats * (60 / bpm);
        }
        
        item = {isRest:false, freq:current.freq, durationSec:finalSec, velocity:vel, display:`${current.note}${current.octave} ${rhythm.name}`, beats: finalBeats};
        melody.push(item); barContents[barContents.length - 1].push(item);
        currentTotalBeats += finalBeats; currentBeatInBar += finalBeats; currentPhraseBeats += finalBeats;
        noteCount++;

        if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }

        if (currentPhraseBeats >= phraseLenBeats - 0.001) {
            if (Math.random() < 0.7) {
                let breakRhythm = getRandomRhythm(1);
                if (breakRhythm.type === 'rest') {
                    let breakSec = breakRhythm.baseSec * (120 / bpm);
                    item = {isRest: true, durationSec: breakSec, display: breakRhythm.name + ' (phrase break)', beats: breakRhythm.beats};
                    melody.push(item); barContents[barContents.length - 1].push(item);
                    currentTotalBeats += breakRhythm.beats; currentBeatInBar += breakRhythm.beats; currentPhraseBeats += breakRhythm.beats;
                    if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
                }
            }
            currentPhraseBeats = 0; if (contour === 'arch' || contour === 'descending_arch') direction = 1;
        }

        if (motifLen > 0 && motifStartIdx >= 0 && Math.random() < motifRepeatChance && currentTotalBeats < totalBeats * 0.85 && melody.length > motifLen + 4) {
            const transposeOptions = [0, 2, -2, 3, -3, 4, -4], transpose = transposeOptions[Math.floor(Math.random() * transposeOptions.length)];
            let inserted = 0;
            for (let k = 0; k < motifBuffer.length && currentTotalBeats < totalBeats - 1.5; k++) {
                const orig = motifBuffer[k];
                let varIdx = currentIdx + transpose; varIdx = Math.max(0, Math.min(available.length - 1, varIdx));
                const varNote = available[varIdx];
                let varRhythm = getRandomRhythm(remainingInBar);
                if (varRhythm.type !== 'note') continue;
                sec = varRhythm.baseSec * (120 / bpm);
                item = {isRest: false, freq: varNote.freq, durationSec: sec, velocity: vel - 8 - inserted * 4, display: `${varNote.note}${varNote.octave} ${varRhythm.name} (motif var)`, beats: varRhythm.beats};
                if (varRhythm.beats > remainingInBar + 0.001) continue;
                melody.push(item); barContents[barContents.length - 1].push(item);
                currentTotalBeats += varRhythm.beats; currentBeatInBar += varRhythm.beats; currentPhraseBeats += varRhythm.beats; currentIdx = varIdx; inserted++;
                if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
            }
            if (inserted >= motifLengthInNotes / 2 && Math.random() < 0.4) { motifStartIdx = -1; motifBuffer = []; motifLengthInNotes = 0; }
        }
    }

    // Ending resolution (Preserved)
    const endingChoice = Math.random();
    let endDegree = endingChoice < 0.60 ? 0 : endingChoice < 0.85 ? 4 : 2;
    let endNote = available.filter(n => n.scaleDegree === endDegree).sort((a,b) => b.octave - a.octave)[0] || available[available.length - 1];
    let endRhythm = getRandomRhythm(Infinity);
    let endSec = endRhythm.baseSec * (120 / bpm), endBeats = endRhythm.beats;
    const remaining = totalBeats - currentTotalBeats;
    
    // PHASE 3: Apply duration safety to ending note
    const endBoundary = getNextHarmonicBoundary(currentTotalBeats, currentChords);
    const beatsToEndBoundary = Math.min(remaining, endBoundary - currentTotalBeats);
    if (endBeats > beatsToEndBoundary && beatsToEndBoundary > 0.1) {
        endBeats = beatsToEndBoundary;
        endSec = endBeats * (60 / bpm);
    } else if (endBeats > remaining) {
        endBeats = remaining;
        endSec = endBeats * (0.5 * 120 / bpm);
    }
    
    item = {isRest: false, freq: endNote.freq, durationSec: endSec, velocity: 90 + Math.floor(Math.random() * 10), display: `${endNote.note}${endNote.octave} ${endRhythm.name} (res)`, beats: endBeats};
    melody.push(item); barContents[barContents.length - 1].push(item);

    if (currentTotalBeats < totalBeats) {
        const fillBeats = totalBeats - currentTotalBeats, fillSec = fillBeats * (0.5 * 120 / bpm);
        item = {isRest: true, durationSec: fillSec, display: `rest (${fillBeats} b)`, beats: fillBeats};
        melody.push(item); barContents[barContents.length - 1].push(item);
    }

    // Display Update
    const presetDisplayName = document.getElementById('harmonicRhythm').selectedOptions[0].text;
    let displayText = `<strong>${root} ${mode.replace('_',' ')} – ${numBars} bars – Harmonic Rhythm: ${presetDisplayName} (${currentChords.length} triggers)</strong><br>`;
    displayText += `<strong>Chords: ${currentChords.map(c => c.name).join(' - ')}</strong><br><br>`;
    barContents.forEach((bar, i) => {
        if (bar.length === 0) return;
        displayText += `Bar ${i+1}: `;
        bar.forEach(m => displayText += `${m.display} `);
        displayText += "|\n";
    });
    document.getElementById('melody-display').innerHTML = displayText;
    document.getElementById('playBtn').disabled = false;
});

// ────────────────────────────────────────────────
//  PLAYBACK ENGINE (UPGRADED FOR SYNC)
// ────────────────────────────────────────────────
let isPlaying = false;
document.getElementById('playBtn').addEventListener('click', () => {
    loadPiano();
    if (isPlaying || melody.length === 0) return;
    isPlaying = true;
    const btn = document.getElementById('playBtn');
    btn.textContent = 'Playing Track...'; btn.disabled = true;

    const startTime = audioCtx.currentTime + 0.15;
    const chordVol = document.getElementById('chordVolume').value / 100;

    // Track 1: Melody (Preserved Logic)
    let mTime = startTime;
    melody.forEach(item => {
        if (!item.isRest) {
       /Users/creative/Documents/000Music Generation Software/Grok/Projectg17-Chords_2004_Phase8_pipeline copy     setTimeout(() => {
                playNote(item.freq, item.velocity, item.durationSec);
            }, (mTime - audioCtx.currentTime) * 1000);
        }
        mTime += item.durationSec;
    });

    // Track 2: Chords (PHASE 4: Polyphonic playback)
    let cTime = startTime;
    currentChords.forEach(chord => {
        setTimeout(() => {
            // Build array of frequencies for polyphonic playback
            const chordFreqs = chord.notes.map(note => note.freq);
            playNote(chordFreqs, Math.round(chordVol * 100), chord.durationSec);
        }, (cTime - audioCtx.currentTime) * 1000);
        cTime += chord.durationSec;
    });

    setTimeout(() => {
        isPlaying = false; btn.textContent = 'Play Composition'; btn.disabled = false;
    }, (Math.max(mTime, cTime) - audioCtx.currentTime + 0.8) * 1000);
});
