// Esercizi: generazione delle domande e verifica delle risposte. Nessuna dipendenza dal DOM.

import {
  SCALE_TYPES, CHORD_QUALITIES, buildScale, diatonicChords, chordMidi, tonicMidi, pitchClass, noteId,
  scaleRunMidi, keySignature, parseNote,
} from './theory.js';

export const EXERCISES = {
  playDegree: { label: 'Suona il grado', midi: true },
  playChord: { label: "Suona l'accordo", midi: true },
  nameChord: { label: "Riconosci l'accordo", midi: false },
  playScale: { label: 'Suona la scala', midi: true },
};

export const DEFAULT_OPTIONS = {
  triads: true,
  sevenths: true,
  inversions: false, // MIDI: rivolto richiesto. Riconosci: mostra anche rivolti.
  keyMode: 'current', // 'current' | 'random' | 'allOfTonic' (solo "Suona la scala")
  majors: true,
  minors: true,
  answer: 'name', // Riconosci: 'name' | 'degree'
  showScale: true,
};

const MINOR_TYPES = ['naturalMinor', 'harmonicMinor', 'melodicMinor'];
const mod = (n, m) => ((n % m) + m) % m;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// current: { tonic, type } della scala scelta in "Esplora".
export function pickKey(opts, current, rng = Math.random) {
  if (opts.keyMode !== 'random') return current;
  const types = [...(opts.majors ? ['major'] : []), ...(opts.minors ? MINOR_TYPES : [])];
  const type = pick(types.length ? types : ['major'], rng);
  return { tonic: pick(SCALE_TYPES[type].tonics, rng), type };
}

const sameQuestion = (a, b) =>
  a.tonic === b.tonic && a.type === b.type && a.size === b.size && a.degree === b.degree && a.inversion === b.inversion;

// Scala di un'ottava in salita e discesa: 15 note, con offset in semitoni dalla tonica.
// La melodica scende come minore naturale.
function scaleQuestion(tonic, type) {
  const scale = buildScale(tonic, type);
  const down = buildScale(tonic, SCALE_TYPES[type].descendingAs ?? type);
  const notes = [...scale, scale[0], ...[...down].reverse()];
  const run = scaleRunMidi(tonic, type, 1);
  return { exercise: 'playScale', tonic, type, scale, notes, offsets: run.map((m) => m - run[0]) };
}

// "Tutte le scale di una tonica": le quattro scale in quest'ordine, poi la tonica
// successiva sul circolo delle quinte.
export const CYCLE_TYPES = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'];

// Grafia della tonica per questa scala: tra le tonalità con armatura standard, quella con meno
// alterazioni (es. Re♭ maggiore ma Do♯ minore). A parità vince la grafia `preferred`.
export function tonicFor(pc, type, preferred) {
  const candidates = SCALE_TYPES[type].tonics.filter((t) => pitchClass(parseNote(t)) === pc);
  const cost = (t) => keySignature(t, type).count * 2 - (t === preferred ? 1 : 0);
  return candidates.reduce((best, t) => (cost(t) < cost(best) ? t : best));
}

function cycleQuestion(current, previous) {
  let pc = pitchClass(parseNote(current.tonic));
  let index = 0;
  if (previous?.cycle) {
    ({ pc, index } = previous.cycle);
    index++;
    if (index === CYCLE_TYPES.length) {
      index = 0;
      pc = (pc + 7) % 12;
    }
  }
  const type = CYCLE_TYPES[index];
  const q = scaleQuestion(tonicFor(pc, type, current.tonic), type);
  q.cycle = { pc, index };
  // Note che cambiano rispetto alla scala precedente della stessa tonica (confronto per suono).
  const before = index > 0 ? previous?.notes : null;
  q.changed = q.notes.map((n, i) => !!before && pitchClass(n) !== pitchClass(before[i]));
  return q;
}

export function makeQuestion(exercise, opts, current, previous = null, rng = Math.random) {
  if (exercise === 'playScale' && opts.keyMode === 'allOfTonic') return cycleQuestion(current, previous);
  if (exercise === 'playScale') {
    for (let attempt = 0; ; attempt++) {
      const { tonic, type } = pickKey(opts, current, rng);
      const sameAsPrevious = previous && previous.tonic === tonic && previous.type === type;
      if (sameAsPrevious && opts.keyMode === 'random' && attempt < 20) continue;
      return scaleQuestion(tonic, type);
    }
  }
  const sizes = [...(opts.triads ? [3] : []), ...(opts.sevenths ? [4] : [])];
  for (let attempt = 0; ; attempt++) {
    const { tonic, type } = pickKey(opts, current, rng);
    const scale = buildScale(tonic, type);
    const size = pick(sizes.length ? sizes : [3], rng);
    const degree = Math.floor(rng() * 7);
    const inversion = opts.inversions ? Math.floor(rng() * size) : null;
    const q = { exercise, tonic, type, scale, size, degree, inversion, chord: diatonicChords(scale, size)[degree] };
    // Evita di ripetere la stessa domanda due volte di fila (se possibile).
    if (previous && sameQuestion(q, previous) && attempt < 20) continue;
    if (exercise === 'nameChord') q.choices = makeChoices(q, opts.answer, rng);
    return q;
  }
}

// 4 risposte: quella giusta più 3 plausibili.
// Per nome: stessa fondamentale con altra qualità, più un altro accordo della scala.
// Per grado: altri gradi della stessa scala.
export function makeChoices(q, answer, rng = Math.random) {
  const diatonic = diatonicChords(q.scale, q.size).filter((c) => c.degree !== q.degree);

  if (answer === 'degree') {
    const others = shuffle(diatonic, rng).slice(0, 3);
    return shuffle([q.chord, ...others], rng).map((c) => ({
      id: c.roman, roman: c.roman, correct: c.degree === q.degree,
    }));
  }

  const toChoice = (root, quality, correct = false) => ({ id: noteId(root) + quality.id, root, quality, correct });
  const sameRoot = Object.entries(CHORD_QUALITIES)
    .filter(([intervals, quality]) => intervals.split(',').length === q.size - 1 && quality.id !== q.chord.quality.id)
    .map(([, quality]) => toChoice(q.chord.root, quality));
  const nearby = diatonic.map((c) => toChoice(c.root, c.quality));

  const wrong = [...shuffle(sameRoot, rng).slice(0, 2), ...shuffle(nearby, rng)].slice(0, 3);
  return shuffle([toChoice(q.chord.root, q.chord.quality, true), ...wrong], rng);
}

// Tasti dell'accordo della domanda, nel rivolto richiesto, a partire dalla tonica.
export function questionMidi(q) {
  const inv = q.inversion ?? 0;
  const notes = [...q.chord.notes.slice(inv), ...q.chord.notes.slice(0, inv)];
  return chordMidi(notes, tonicMidi(q.scale));
}

// Verifica le note tenute sulla tastiera MIDI.
// 'pending': meno di 3 note, oppure note giuste ma ne manca ancora qualcuna.
export function judgeMidi(q, midis) {
  const held = new Set(midis.map((m) => mod(m, 12)));
  if (held.size < 3) return 'pending';
  const target = new Set(q.chord.notes.map(pitchClass));
  if (![...held].every((pc) => target.has(pc))) return 'wrong';
  if (held.size < target.size) return 'pending';
  if (q.inversion === null) return 'correct';
  const bass = mod(Math.min(...midis), 12);
  return bass === pitchClass(q.chord.notes[q.inversion]) ? 'correct' : 'wrong';
}

// Verifica una nota di "Suona la scala". progress: note già suonate giuste;
// start: tasto MIDI della prima tonica suonata (qualsiasi ottava).
// Dopo la prima nota la scala deve essere continua: conta il tasto esatto, non solo il nome.
export function judgeScaleNote(q, progress, start, midi) {
  if (progress === 0) return mod(midi, 12) === pitchClass(q.scale[0]);
  return midi === start + q.offsets[progress];
}
