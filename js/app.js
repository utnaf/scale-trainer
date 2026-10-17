import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';
import {
  SCALE_TYPES, buildScale, keySignature, diatonicChords, chordName,
  chordMidi, scaleRunMidi, tonicMidi, noteName, parseNote, pitchClass,
} from './theory.js';
import { playNote, playChord, playSequence } from './audio.js';

// Tastiera: 2 ottave dalla tonica alla tonica. Se la tonica è un tasto nero
// si aggiunge il bianco adiacente, così la tastiera inizia e finisce su un bianco.
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const isBlack = (midi) => BLACK_PCS.has(midi % 12);

function buildKeys(tonic) {
  const first = isBlack(tonic) ? tonic - 1 : tonic;
  const last = isBlack(tonic) ? tonic + 25 : tonic + 24;
  let whiteCount = 0;
  for (let m = first; m <= last; m++) if (!isBlack(m)) whiteCount++;
  const whiteWidth = 100 / whiteCount;
  const blackWidth = whiteWidth * 0.62;

  const keys = [];
  let whites = 0;
  for (let midi = first; midi <= last; midi++) {
    const black = isBlack(midi);
    const left = black ? whites * whiteWidth - blackWidth / 2 : whites++ * whiteWidth;
    keys.push({ midi, pc: midi % 12, black, left, width: black ? blackWidth : whiteWidth });
  }
  return { keys, whiteCount };
}

// localStorage solo per le preferenze: può non essere disponibile.
const STORAGE_KEY = 'scaletrainer:prefs';
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

Alpine.data('trainer', () => {
  const prefs = loadPrefs();
  const type = SCALE_TYPES[prefs.type] ? prefs.type : 'major';
  const tonic = SCALE_TYPES[type].tonics.includes(prefs.tonic) ? prefs.tonic : SCALE_TYPES[type].tonics[0];

  return {
    lang: prefs.lang === 'en' ? 'en' : 'it',
    type,
    tonic,
    arpeggio: !!prefs.arpeggio,
    selected: null, // { size, degree }
    pressed: {}, // midi → true mentre il tasto suona
    typeIds: Object.keys(SCALE_TYPES),
    SCALE_TYPES,

    init() {
      this.$watch('lang', () => this.save());
      this.$watch('arpeggio', () => this.save());
    },

    save() {
      savePrefs({ lang: this.lang, type: this.type, tonic: this.tonic, arpeggio: this.arpeggio });
    },

    name(note) {
      return noteName(note, this.lang);
    },

    get tonicList() {
      return SCALE_TYPES[this.type].tonics.map((id) => {
        const sig = keySignature(id, this.type);
        return {
          id,
          name: this.name(parseNote(id)),
          signature: sig.kind ? `${sig.count}${sig.kind === 'sharp' ? '♯' : '♭'}` : '–',
        };
      });
    },

    get scale() {
      return buildScale(this.tonic, this.type);
    },

    get tonicMidi() {
      return tonicMidi(this.scale);
    },

    get keyboard() {
      return buildKeys(this.tonicMidi);
    },

    get title() {
      return `${this.name(this.scale[0])} ${SCALE_TYPES[this.type].suffix}`;
    },

    get chordRows() {
      return [
        { size: 3, label: 'Triadi', chords: diatonicChords(this.scale, 3) },
        { size: 4, label: 'Quadriadi', chords: diatonicChords(this.scale, 4) },
      ];
    },

    get selectedChord() {
      if (!this.selected) return null;
      return diatonicChords(this.scale, this.selected.size)[this.selected.degree];
    },

    get chordKeys() {
      const chord = this.selectedChord;
      return chord ? chordMidi(chord.notes, this.tonicMidi) : [];
    },

    chordLabel(chord) {
      return chordName(chord, this.lang);
    },

    chordNotes(chord) {
      return chord.notes.map((n) => this.name(n)).join(' ');
    },

    isSelected(size, degree) {
      return this.selected?.size === size && this.selected?.degree === degree;
    },

    // Nota della scala (con la grafia corretta) che cade su questo tasto, se c'è.
    scaleNoteAt(key) {
      return this.scale.find((n) => pitchClass(n) === key.pc) ?? null;
    },

    keyLabel(key) {
      const note = this.scaleNoteAt(key);
      return note ? this.name(note) : '';
    },

    keyClasses(key) {
      const inChord = this.chordKeys.includes(key.midi);
      return {
        black: key.black,
        white: !key.black,
        'in-scale': !!this.scaleNoteAt(key),
        tonic: key.pc === pitchClass(this.scale[0]),
        'in-chord': inChord,
        'chord-root': inChord && key.midi === this.chordKeys[0],
        pressed: !!this.pressed[key.midi],
      };
    },

    keyStyle(key) {
      return `left:${key.left}%;width:${key.width}%`;
    },

    setType(id) {
      if (id === this.type) return;
      // Mantiene la stessa tonica (o una enarmonica) quando si cambia tipo di scala.
      const pc = pitchClass(parseNote(this.tonic));
      const tonics = SCALE_TYPES[id].tonics;
      this.tonic = tonics.includes(this.tonic)
        ? this.tonic
        : tonics.find((t) => pitchClass(parseNote(t)) === pc) ?? tonics[0];
      this.type = id;
      this.selected = null;
      this.save();
    },

    setTonic(id) {
      this.tonic = id;
      this.selected = null;
      this.save();
    },

    flash(midi, delayMs = 0, durationMs = 350) {
      setTimeout(() => {
        this.pressed = { ...this.pressed, [midi]: true };
        setTimeout(() => {
          const { [midi]: _, ...rest } = this.pressed;
          this.pressed = rest;
        }, durationMs);
      }, delayMs);
    },

    pressKey(key) {
      playNote(key.midi);
      this.flash(key.midi);
    },

    toggleChord(size, degree) {
      if (this.isSelected(size, degree)) {
        this.selected = null;
        return;
      }
      this.selected = { size, degree };
      this.playSelectedChord();
    },

    playSelectedChord() {
      const midis = this.chordKeys;
      playChord(midis, { arpeggio: this.arpeggio });
      midis.forEach((m, i) => this.flash(m, this.arpeggio ? i * 120 : 0, 500));
    },

    playScale() {
      const midis = scaleRunMidi(this.tonic, this.type, 2);
      playSequence(midis, 0.25);
      midis.forEach((m, i) => this.flash(m, i * 250, 230));
    },
  };
});

Alpine.start();
