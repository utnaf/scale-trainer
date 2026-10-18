import {
  SCALE_TYPES, buildScale, keySignature, diatonicChords, chordName,
  chordMidi, scaleMidi, scaleRunMidi, tonicMidi, recognizeChord, scaleFormula, noteName, noteId, parseNote, pitchClass,
} from '../js/theory.js';
import { test, assertEqual } from './harness.js';

const ids = (notes) => notes.map(noteId);
const names = (chords) => chords.map((c) => chordName(c));
const romans = (chords) => chords.map((c) => c.roman);

test('Do maggiore', () => {
  assertEqual(ids(buildScale('C', 'major')), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
});

test('Fa# maggiore usa Mi#', () => {
  assertEqual(ids(buildScale('F#', 'major')), ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
});

test('Dob maggiore usa Fab', () => {
  assertEqual(ids(buildScale('Cb', 'major')), ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb']);
});

test('La♭ minore naturale', () => {
  assertEqual(ids(buildScale('Ab', 'naturalMinor')), ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb']);
});

test('Re# minore armonica usa Do doppio diesis', () => {
  assertEqual(ids(buildScale('D#', 'harmonicMinor')), ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C##']);
});

test('La minore melodica', () => {
  assertEqual(ids(buildScale('A', 'melodicMinor')), ['A', 'B', 'C', 'D', 'E', 'F#', 'G#']);
});

test('Tutte le scale: 7 lettere diverse e intervalli corretti', () => {
  for (const [type, def] of Object.entries(SCALE_TYPES)) {
    for (const tonic of def.tonics) {
      const scale = buildScale(tonic, type);
      const letters = new Set(scale.map((n) => n.letter));
      if (letters.size !== 7) throw new Error(`${tonic} ${type}: lettere ripetute`);
      const t = pitchClass(scale[0]);
      const steps = scale.map((n) => (pitchClass(n) - t + 12) % 12);
      assertEqual(steps, def.steps);
      if (scale.some((n) => Math.abs(n.acc) > 2)) throw new Error(`${tonic} ${type}: alterazione > 2`);
      diatonicChords(scale, 3);
      diatonicChords(scale, 4);
    }
  }
});

test('Armature', () => {
  assertEqual(keySignature('C', 'major'), { count: 0, kind: null });
  assertEqual(keySignature('C#', 'major'), { count: 7, kind: 'sharp' });
  assertEqual(keySignature('Cb', 'major'), { count: 7, kind: 'flat' });
  assertEqual(keySignature('D', 'naturalMinor'), { count: 1, kind: 'flat' });
  assertEqual(keySignature('E', 'harmonicMinor'), { count: 1, kind: 'sharp' });
  assertEqual(keySignature('A#', 'melodicMinor'), { count: 7, kind: 'sharp' });
});

test('Do maggiore: triadi', () => {
  const chords = diatonicChords(buildScale('C', 'major'), 3);
  assertEqual(names(chords), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
  assertEqual(romans(chords), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
});

test('Do maggiore: quadriadi', () => {
  const chords = diatonicChords(buildScale('C', 'major'), 4);
  assertEqual(names(chords), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7']);
  assertEqual(romans(chords), ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
});

test('La minore armonica: triadi e quadriadi', () => {
  const scale = buildScale('A', 'harmonicMinor');
  assertEqual(names(diatonicChords(scale, 3)), ['Am', 'B°', 'C+', 'Dm', 'E', 'F', 'G♯°']);
  assertEqual(names(diatonicChords(scale, 4)), ['Am(maj7)', 'Bø7', 'Cmaj7(♯5)', 'Dm7', 'E7', 'Fmaj7', 'G♯°7']);
});

test('La minore melodica: triadi e quadriadi', () => {
  const scale = buildScale('A', 'melodicMinor');
  assertEqual(names(diatonicChords(scale, 3)), ['Am', 'Bm', 'C+', 'D', 'E', 'F♯°', 'G♯°']);
  assertEqual(names(diatonicChords(scale, 4)), ['Am(maj7)', 'Bm7', 'Cmaj7(♯5)', 'D7', 'E7', 'F♯ø7', 'G♯ø7']);
});

test('Nomi italiani', () => {
  assertEqual(noteName(parseNote('F#'), 'it'), 'Fa♯');
  assertEqual(noteName(parseNote('Bb'), 'it'), 'Si♭');
  assertEqual(noteName(parseNote('C##'), 'it'), 'Do𝄪');
  assertEqual(chordName(diatonicChords(buildScale('D', 'major'), 4)[4], 'it'), 'La7');
});

test('Voicing MIDI', () => {
  assertEqual(scaleMidi(buildScale('C', 'major')), [48, 50, 52, 53, 55, 57, 59, 60]);
  assertEqual(chordMidi(['B', 'D#', 'F#', 'A#'].map(parseNote)), [59, 63, 66, 70]);
  assertEqual(chordMidi(['B#', 'D##', 'F##'].map(parseNote)), [48, 52, 55]);
  assertEqual(scaleMidi(buildScale('Cb', 'major'))[7], 71);
});

test('Accordi partono dalla tonica e salgono', () => {
  const scale = buildScale('G', 'major');
  const base = tonicMidi(scale);
  assertEqual(base, 55);
  const roots = diatonicChords(scale, 4).map((c) => chordMidi(c.notes, base)[0]);
  assertEqual(roots, [55, 57, 59, 60, 62, 64, 66]);
  // vii7 di Si maggiore: la settima resta entro le 2 ottave dalla tonica.
  const b = buildScale('B', 'major');
  const top = chordMidi(diatonicChords(b, 4)[6].notes, tonicMidi(b))[3];
  if (top > tonicMidi(b) + 24) throw new Error(`fuori tastiera: ${top}`);
});

test('Scala su 2 ottave in salita e discesa', () => {
  const run = scaleRunMidi('C', 'major', 2);
  assertEqual(run.length, 29);
  assertEqual([run[0], run[14], run[28]], [48, 72, 48]);
});

test('Minore melodica scende come naturale', () => {
  const run = scaleRunMidi('A', 'melodicMinor', 1);
  assertEqual(run, [57, 59, 60, 62, 64, 66, 68, 69, 67, 65, 64, 62, 60, 59, 57]);
});

test('Riconoscimento: triade e quadriade in stato fondamentale', () => {
  const scale = buildScale('C', 'major');
  const r = recognizeChord([60, 64, 67], scale);
  assertEqual([chordName(r.chord), r.size, r.inversion], ['C', 3, 0]);
  const r7 = recognizeChord([55, 59, 62, 65], scale);
  assertEqual([chordName(r7.chord), r7.chord.roman, r7.inversion], ['G7', 'V7', 0]);
});

test('Riconoscimento: rivolti, ottave e raddoppi', () => {
  const scale = buildScale('C', 'major');
  // Si (la terza di G7) al basso → primo rivolto.
  assertEqual(recognizeChord([47, 55, 62, 65, 67], scale).inversion, 1);
  // Fa al basso di G7 → terzo rivolto.
  assertEqual(recognizeChord([53, 59, 62, 67], scale).inversion, 3);
  // Am con La raddoppiato e Mi al basso → secondo rivolto.
  const r = recognizeChord([52, 57, 60, 69], scale);
  assertEqual([chordName(r.chord), r.inversion], ['Am', 2]);
});

test('Riconoscimento: grafia della scala e casi limite', () => {
  const scale = buildScale('D#', 'harmonicMinor');
  // La♯7: La♯ Do𝄪 Mi♯ Sol♯ (tasti La♯ Re Fa Sol♯).
  const r = recognizeChord([58, 62, 65, 68], scale);
  assertEqual([noteId(r.chord.notes[1]), r.chord.roman], ['C##', 'V7']);
  assertEqual(recognizeChord([60, 64], buildScale('C', 'major')), null);
  assertEqual(recognizeChord([62, 66, 69], buildScale('C', 'major')), { chord: null });
  assertEqual(recognizeChord([60, 62, 64, 65, 67], buildScale('C', 'major')), { chord: null });
});


test('Formula delle scale: intervalli e gradi rispetto alla maggiore', () => {
  const f = (type) => scaleFormula('C', type);
  assertEqual(f('major').steps, [2, 2, 1, 2, 2, 2, 1]);
  assertEqual(f('major').degrees.map((d) => d.label), ['1', '2', '3', '4', '5', '6', '7']);
  assertEqual(f('naturalMinor').degrees.map((d) => d.label), ['1', '2', '♭3', '4', '5', '♭6', '♭7']);
  assertEqual(f('harmonicMinor').steps, [2, 1, 2, 2, 1, 3, 1]);
  assertEqual(f('harmonicMinor').degrees.filter((d) => d.altered).map((d) => d.label), ['♭3', '♭6']);
  assertEqual(f('melodicMinor').degrees.filter((d) => d.altered).map((d) => d.label), ['♭3']);
  // Con tonica alterata i gradi restano relativi: in Fa♯ minore il ♭3 è La.
  assertEqual(scaleFormula('F#', 'naturalMinor').degrees[2].label, '♭3');
});
