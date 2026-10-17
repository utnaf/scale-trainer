import {
  SCALE_TYPES, buildScale, keySignature, diatonicChords, chordName,
  chordMidi, scaleMidi, noteName, noteId, parseNote, pitchClass,
} from '../js/theory.js';

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
  }
}

function assertEqual(actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`atteso ${b}, ottenuto ${a}`);
}

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

export default results;
