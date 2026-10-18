import { buildScale, diatonicChords, chordName, noteName, noteId, pitchClass } from '../js/theory.js';
import {
  DEFAULT_OPTIONS, makeQuestion, makeChoices, pickKey, judgeMidi, questionMidi, judgeScaleNote, tonicFor,
} from '../js/exercises.js';
import { test, assert, assertEqual } from './harness.js';

// Generatore pseudo-casuale con seme, per test ripetibili.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C_MAJOR = { tonic: 'C', type: 'major' };
const question = (tonic, type, size, degree, inversion = null) => {
  const scale = buildScale(tonic, type);
  return { tonic, type, scale, size, degree, inversion, chord: diatonicChords(scale, size)[degree] };
};

test('Esercizi: tonalità scelta o casuale col filtro', () => {
  const rng = seeded(1);
  assertEqual(pickKey(DEFAULT_OPTIONS, C_MAJOR, rng), C_MAJOR);
  const onlyMinors = { ...DEFAULT_OPTIONS, keyMode: 'random', majors: false };
  for (let i = 0; i < 50; i++) assert(pickKey(onlyMinors, C_MAJOR, rng).type !== 'major', 'uscita una maggiore');
  const onlyMajors = { ...DEFAULT_OPTIONS, keyMode: 'random', minors: false };
  for (let i = 0; i < 50; i++) assertEqual(pickKey(onlyMajors, C_MAJOR, rng).type, 'major');
});

test('Esercizi: domande rispettano le opzioni e non si ripetono', () => {
  const rng = seeded(2);
  const opts = { ...DEFAULT_OPTIONS, sevenths: false, inversions: true };
  let prev = null;
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion('playDegree', opts, C_MAJOR, prev, rng);
    assertEqual(q.size, 3);
    assert(q.inversion >= 0 && q.inversion < 3, `rivolto ${q.inversion}`);
    if (prev) assert(!(q.degree === prev.degree && q.inversion === prev.inversion), 'domanda ripetuta');
    prev = q;
  }
  const q = makeQuestion('playChord', DEFAULT_OPTIONS, C_MAJOR, null, rng);
  assertEqual(q.inversion, null);
});

test('Esercizi: scelte per nome (4 diverse, una giusta, stessa fondamentale)', () => {
  const rng = seeded(3);
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion('nameChord', { ...DEFAULT_OPTIONS, keyMode: 'random' }, C_MAJOR, null, rng);
    const labels = q.choices.map((c) => noteName(c.root) + c.quality.suffix);
    assertEqual(new Set(labels).size, 4);
    assertEqual(q.choices.filter((c) => c.correct).length, 1);
    assertEqual(labels[q.choices.findIndex((c) => c.correct)], chordName(q.chord));
    const sameRoot = q.choices.filter((c) => c.root.letter === q.chord.root.letter && c.root.acc === q.chord.root.acc);
    assertEqual(sameRoot.length, 3);
  }
});

test('Esercizi: scelte per grado', () => {
  const q = question('A', 'harmonicMinor', 4, 4);
  const choices = makeChoices(q, 'degree', seeded(4));
  assertEqual(choices.length, 4);
  assertEqual(new Set(choices.map((c) => c.id)).size, 4);
  assertEqual(choices.find((c) => c.correct).roman, 'V7');
});

test('Esercizi: verifica MIDI', () => {
  const g7 = question('C', 'major', 4, 4); // Sol Si Re Fa
  assertEqual(judgeMidi(g7, [55, 59]), 'pending');
  assertEqual(judgeMidi(g7, [55, 59, 62]), 'pending'); // manca la settima
  assertEqual(judgeMidi(g7, [55, 59, 62, 65]), 'correct');
  assertEqual(judgeMidi(g7, [43, 59, 62, 65, 67]), 'correct'); // ottave e raddoppi
  assertEqual(judgeMidi(g7, [55, 59, 62, 64]), 'wrong'); // Mi non c'entra
  assertEqual(judgeMidi(g7, [55, 59, 61]), 'wrong');
});

test('Esercizi: verifica MIDI con rivolto richiesto', () => {
  const c = question('C', 'major', 3, 0, 1); // Do, primo rivolto: Mi al basso
  assertEqual(judgeMidi(c, [52, 55, 60]), 'correct');
  assertEqual(judgeMidi(c, [48, 52, 55]), 'wrong');
});

test('Esercizi: voicing della domanda nel rivolto', () => {
  assertEqual(questionMidi(question('C', 'major', 3, 0)), [48, 52, 55]);
  assertEqual(questionMidi(question('C', 'major', 3, 0, 2)), [55, 60, 64]);
  // vii7 di Si maggiore al terzo rivolto resta entro le 2 ottave dalla tonica.
  const q = question('B', 'major', 4, 6, 3);
  const midis = questionMidi(q);
  assert(midis[0] >= 59 && midis[3] <= 59 + 24, `fuori tastiera: ${midis}`);
  assertEqual(pitchClass(q.chord.notes[3]), midis[0] % 12);
});

test('Suona la scala: un\'ottava su e giù', () => {
  const q = makeQuestion('playScale', DEFAULT_OPTIONS, C_MAJOR);
  assertEqual(q.offsets, [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0]);
  assertEqual(q.notes.map(noteId).join(' '), 'C D E F G A B C B A G F E D C');
  const m = makeQuestion('playScale', DEFAULT_OPTIONS, { tonic: 'A', type: 'melodicMinor' });
  assertEqual(m.notes.map(noteId).join(' '), 'A B C D E F# G# A G F E D C B A');
  assertEqual(m.offsets, [0, 2, 3, 5, 7, 9, 11, 12, 10, 8, 7, 5, 3, 2, 0]);
});

test('Suona la scala: verifica nota per nota, ottava libera ma continua', () => {
  const q = makeQuestion('playScale', DEFAULT_OPTIONS, { tonic: 'D', type: 'major' });
  assertEqual(judgeScaleNote(q, 0, null, 50), true); // Re3
  assertEqual(judgeScaleNote(q, 0, null, 74), true); // Re5: va bene qualsiasi ottava
  assertEqual(judgeScaleNote(q, 0, null, 52), false);
  assertEqual(judgeScaleNote(q, 1, 74, 76), true); // Mi sopra il Re di partenza
  assertEqual(judgeScaleNote(q, 1, 74, 64), false); // Mi un'ottava sotto: scala non continua
  assertEqual(judgeScaleNote(q, 2, 74, 78), true); // Fa♯
  assertEqual(judgeScaleNote(q, 2, 74, 77), false); // Fa naturale
  assertEqual(judgeScaleNote(q, 8, 74, 85), true); // discesa: Do♯
});

test('Suona la scala: tonalità casuale non si ripete', () => {
  const rng = seeded(5);
  const opts = { ...DEFAULT_OPTIONS, keyMode: 'random' };
  let prev = null;
  for (let i = 0; i < 50; i++) {
    const q = makeQuestion('playScale', opts, C_MAJOR, prev, rng);
    if (prev) assert(!(q.tonic === prev.tonic && q.type === prev.type), 'scala ripetuta');
    prev = q;
  }
});

test('Tutte le scale di una tonica: ordine e circolo delle quinte', () => {
  const opts = { ...DEFAULT_OPTIONS, keyMode: 'allOfTonic' };
  let q = null;
  const seq = [];
  for (let i = 0; i < 9; i++) {
    q = makeQuestion('playScale', opts, C_MAJOR, q);
    seq.push(`${q.tonic} ${q.type}`);
  }
  assertEqual(seq, [
    'C major', 'C naturalMinor', 'C harmonicMinor', 'C melodicMinor',
    'G major', 'G naturalMinor', 'G harmonicMinor', 'G melodicMinor',
    'D major',
  ]);
});

test('Tutte le scale di una tonica: grafia con meno alterazioni', () => {
  assertEqual(tonicFor(1, 'major', 'C#'), 'Db');
  assertEqual(tonicFor(1, 'naturalMinor', 'C#'), 'C#');
  assertEqual(tonicFor(8, 'naturalMinor', 'Ab'), 'G#');
  assertEqual(tonicFor(6, 'major', 'Gb'), 'Gb'); // Fa♯ e Sol♭: pari, vince quella scelta
  assertEqual(tonicFor(6, 'major', 'C'), 'F#');
});

test('Tutte le scale di una tonica: note che cambiano', () => {
  const opts = { ...DEFAULT_OPTIONS, keyMode: 'allOfTonic' };
  const changedIdx = (q) => q.changed.flatMap((c, i) => (c ? [i] : []));
  const major = makeQuestion('playScale', opts, C_MAJOR);
  assertEqual(changedIdx(major), []);
  const natural = makeQuestion('playScale', opts, C_MAJOR, major);
  assertEqual(changedIdx(natural), [2, 5, 6, 8, 9, 12]); // Mi♭ La♭ Si♭, su e giù
  const harmonic = makeQuestion('playScale', opts, C_MAJOR, natural);
  assertEqual(changedIdx(harmonic), [6, 8]); // Si naturale
  const melodic = makeQuestion('playScale', opts, C_MAJOR, harmonic);
  assertEqual(changedIdx(melodic), [5, 8]); // La in salita, Si♭ in discesa
  // Re♭ maggiore → Do♯ minore: grafia diversa ma si confronta il suono.
  const dbMajor = makeQuestion('playScale', opts, { tonic: 'Db', type: 'major' });
  const csMinor = makeQuestion('playScale', opts, { tonic: 'Db', type: 'major' }, dbMajor);
  assertEqual(csMinor.tonic, 'C#');
  assertEqual(changedIdx(csMinor), [2, 5, 6, 8, 9, 12]);
});
