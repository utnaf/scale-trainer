// Teoria musicale: note, scale, accordi diatonici.
// Una nota è { letter, acc }: letter 0..6 (C..B), acc -2..2 (𝄫 ♭ ♮ ♯ 𝄪).
// Lavorare con la lettera separata dall'alterazione garantisce la grafia corretta:
// ogni grado della scala usa una lettera diversa, l'alterazione si ricava dopo.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
const NAMES = {
  en: LETTERS,
  it: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
};
const ACC_SYMBOLS = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

const mod = (n, m) => ((n % m) + m) % m;

// "F#", "Bb", "C##", "Ebb" → { letter, acc }
export function parseNote(str) {
  const letter = LETTERS.indexOf(str[0].toUpperCase());
  if (letter < 0) throw new Error(`Nota non valida: ${str}`);
  let acc = 0;
  for (const ch of str.slice(1)) {
    if (ch === '#') acc++;
    else if (ch === 'b') acc--;
    else throw new Error(`Nota non valida: ${str}`);
  }
  return { letter, acc };
}

export function pitchClass(note) {
  return mod(NATURAL_PC[note.letter] + note.acc, 12);
}

export function noteName(note, lang = 'en') {
  return NAMES[lang][note.letter] + ACC_SYMBOLS[note.acc];
}

// Identificativo ASCII stabile, es. "F#", "Bb".
export function noteId(note) {
  return LETTERS[note.letter] + (note.acc > 0 ? '#' : 'b').repeat(Math.abs(note.acc));
}

// Tonalità con armatura standard (fino a 7 alterazioni), in ordine di quinte.
const MAJOR_TONICS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const MINOR_TONICS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];

export const SCALE_TYPES = {
  major: {
    steps: [0, 2, 4, 5, 7, 9, 11],
    tonics: MAJOR_TONICS,
    signatureOf: 'major',
    label: 'Maggiore',
    suffix: 'maggiore',
  },
  naturalMinor: {
    steps: [0, 2, 3, 5, 7, 8, 10],
    tonics: MINOR_TONICS,
    signatureOf: 'naturalMinor',
    label: 'Minore naturale',
    suffix: 'minore naturale',
  },
  harmonicMinor: {
    steps: [0, 2, 3, 5, 7, 8, 11],
    tonics: MINOR_TONICS,
    signatureOf: 'naturalMinor',
    label: 'Minore armonica',
    suffix: 'minore armonica',
  },
  melodicMinor: {
    steps: [0, 2, 3, 5, 7, 9, 11],
    tonics: MINOR_TONICS,
    signatureOf: 'naturalMinor',
    descendingAs: 'naturalMinor',
    label: 'Minore melodica',
    suffix: 'minore melodica',
  },
};

export function buildScale(tonicStr, type) {
  const tonic = parseNote(tonicStr);
  const tonicPc = pitchClass(tonic);
  return SCALE_TYPES[type].steps.map((step, i) => {
    const letter = (tonic.letter + i) % 7;
    const acc = mod(tonicPc + step - NATURAL_PC[letter] + 6, 12) - 6;
    return { letter, acc };
  });
}

// Armatura: { count, kind: 'sharp' | 'flat' | null }.
// Armonica e melodica usano l'armatura della minore naturale.
export function keySignature(tonicStr, type) {
  const scale = buildScale(tonicStr, SCALE_TYPES[type].signatureOf);
  const sum = scale.reduce((s, n) => s + n.acc, 0);
  return { count: Math.abs(sum), kind: sum > 0 ? 'sharp' : sum < 0 ? 'flat' : null };
}

// Qualità degli accordi, indicizzate dagli intervalli (in semitoni) dalla fondamentale.
// upper: numerale romano maiuscolo; romanSuffix: simbolo dopo il numerale.
export const CHORD_QUALITIES = {
  '4,7': { id: 'maj', suffix: '', upper: true, romanSuffix: '', name: 'maggiore' },
  '3,7': { id: 'min', suffix: 'm', upper: false, romanSuffix: '', name: 'minore' },
  '3,6': { id: 'dim', suffix: '°', upper: false, romanSuffix: '°', name: 'diminuito' },
  '4,8': { id: 'aug', suffix: '+', upper: true, romanSuffix: '+', name: 'aumentato' },
  '4,7,11': { id: 'maj7', suffix: 'maj7', upper: true, romanSuffix: 'maj7', name: 'settima maggiore' },
  '4,7,10': { id: 'dom7', suffix: '7', upper: true, romanSuffix: '7', name: 'settima di dominante' },
  '3,7,10': { id: 'min7', suffix: 'm7', upper: false, romanSuffix: '7', name: 'minore settima' },
  '3,6,10': { id: 'halfDim7', suffix: 'ø7', upper: false, romanSuffix: 'ø7', name: 'semidiminuito' },
  '3,6,9': { id: 'dim7', suffix: '°7', upper: false, romanSuffix: '°7', name: 'diminuito settima' },
  '3,7,11': { id: 'minMaj7', suffix: 'm(maj7)', upper: false, romanSuffix: '(maj7)', name: 'minore settima maggiore' },
  '4,8,11': { id: 'augMaj7', suffix: 'maj7(♯5)', upper: true, romanSuffix: '+maj7', name: 'aumentato settima maggiore' },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Accordi diatonici per sovrapposizione di terze: size 3 = triadi, 4 = quadriadi.
export function diatonicChords(scale, size) {
  return scale.map((root, degree) => {
    const notes = Array.from({ length: size }, (_, k) => scale[(degree + 2 * k) % 7]);
    const intervals = notes.slice(1).map((n) => mod(pitchClass(n) - pitchClass(root), 12));
    const quality = CHORD_QUALITIES[intervals.join(',')];
    if (!quality) throw new Error(`Qualità sconosciuta: ${intervals}`);
    const numeral = quality.upper ? ROMAN[degree] : ROMAN[degree].toLowerCase();
    return { degree, root, notes, quality, roman: numeral + quality.romanSuffix };
  });
}

export function chordName(chord, lang = 'en') {
  return noteName(chord.root, lang) + chord.quality.suffix;
}

// Tasto MIDI della tonica: sempre nell'ottava Do3–Si3.
export function tonicMidi(scale) {
  return 48 + pitchClass(scale[0]);
}

// Voicing in stato fondamentale: fondamentale sul primo tasto ≥ `base`, poi note ascendenti.
export function chordMidi(notes, base = 48) {
  const midis = [base + mod(pitchClass(notes[0]) - base, 12)];
  for (const n of notes.slice(1)) {
    const prev = midis[midis.length - 1];
    midis.push(prev + (mod(pitchClass(n) - prev, 12) || 12));
  }
  return midis;
}

// Scala ascendente di un'ottava (8 note, tonica ripetuta in alto).
export function scaleMidi(scale, base = 48) {
  return chordMidi([...scale, scale[0]], base);
}

// Scala su più ottave, in salita e in discesa dalla tonica.
// La melodica scende come minore naturale.
export function scaleRunMidi(tonicStr, type, octaves = 2) {
  const run = (t) => {
    const scale = buildScale(tonicStr, t);
    const notes = Array.from({ length: octaves }, () => scale).flat();
    return chordMidi([...notes, scale[0]], tonicMidi(scale));
  };
  const up = run(type);
  const down = run(SCALE_TYPES[type].descendingAs ?? type).reverse().slice(1);
  return [...up, ...down];
}
