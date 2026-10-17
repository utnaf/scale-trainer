import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';
import {
  SCALE_TYPES, buildScale, keySignature, diatonicChords, chordName,
  chordMidi, scaleRunMidi, tonicMidi, recognizeChord, INVERSIONS, noteName, parseNote, pitchClass,
} from './theory.js';
import { playNote, playChord, playSequence } from './audio.js';
import { isMidiSupported, connectMidi } from './midi.js';
import {
  EXERCISES, DEFAULT_OPTIONS, makeQuestion, questionMidi, judgeMidi, judgeScaleNote,
} from './exercises.js';

// Attesa prima di riconoscere l'accordo: i tasti non vengono mai premuti tutti nello stesso istante.
// Negli esercizi è più lunga, per non dare "sbagliato" mentre si stanno ancora premendo i tasti.
const RECOGNITION_DELAY_MS = 50;
const EXERCISE_DELAY_MS = 300;
const NEXT_QUESTION_MS = 1200;

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
    midiStatus: isMidiSupported() ? 'off' : 'unsupported', // off | connecting | on | error | unsupported
    midiDevices: [],
    midiSound: prefs.midiSound ?? true,
    held: {}, // note MIDI tenute premute sulla tastiera fisica
    heldStable: [], // copia di `held` aggiornata dopo RECOGNITION_DELAY_MS
    typeIds: Object.keys(SCALE_TYPES),
    SCALE_TYPES,
    EXERCISES,

    mode: prefs.mode === 'exercise' ? 'exercise' : 'explore',
    exercise: EXERCISES[prefs.exercise] ? prefs.exercise : 'playDegree',
    opts: { ...DEFAULT_OPTIONS, ...prefs.opts },
    question: null,
    feedback: 'idle', // idle | correct | wrong
    wrongChoices: {}, // id → true per le risposte sbagliate già cliccate
    solutionShown: false,
    scaleProgress: 0, // "Suona la scala": note già suonate giuste
    scaleStart: null, // tasto MIDI della prima tonica suonata

    init() {
      this.$watch('lang', () => this.save());
      this.$watch('arpeggio', () => this.save());
      this.$watch('midiSound', () => this.save());
      this.$watch('opts', () => {
        this.save();
        this.newQuestion();
      });
      if (this.mode === 'exercise') this.newQuestion();
    },

    save() {
      savePrefs({
        lang: this.lang, type: this.type, tonic: this.tonic,
        arpeggio: this.arpeggio, midiSound: this.midiSound,
        mode: this.mode, exercise: this.exercise, opts: this.opts,
      });
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

    // Negli esercizi la tastiera mostra la tonalità della domanda, in "Esplora" quella scelta.
    get activeKey() {
      return this.mode === 'exercise' && this.question
        ? { tonic: this.question.tonic, type: this.question.type }
        : { tonic: this.tonic, type: this.type };
    },

    get scale() {
      return buildScale(this.activeKey.tonic, this.activeKey.type);
    },

    get showScaleHints() {
      return this.mode === 'explore' || this.opts.showScale;
    },

    get tonicMidi() {
      return tonicMidi(this.scale);
    },

    get keyboard() {
      return buildKeys(this.tonicMidi);
    },

    get title() {
      return `${this.name(this.scale[0])} ${SCALE_TYPES[this.activeKey.type].suffix}`;
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
      if (this.mode === 'exercise') {
        const q = this.question;
        if (q?.exercise === 'playScale') return [];
        const visible = q && (q.exercise === 'nameChord' || this.solutionShown);
        return visible ? questionMidi(q) : [];
      }
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
      if (!this.showScaleHints) return '';
      const note = this.scaleNoteAt(key);
      return note ? this.name(note) : '';
    },

    keyClasses(key) {
      const inChord = this.chordKeys.includes(key.midi);
      return {
        black: key.black,
        white: !key.black,
        'in-scale': this.showScaleHints && !!this.scaleNoteAt(key),
        tonic: this.showScaleHints && key.pc === pitchClass(this.scale[0]),
        'in-chord': inChord,
        // Negli esercizi non si segna la fondamentale: sarebbe un suggerimento.
        'chord-root': this.mode === 'explore' && inChord && key.midi === this.chordKeys[0],
        pressed: !!this.pressed[key.midi],
        held: !!this.held[key.midi],
        wrong: !!this.held[key.midi] && this.feedback === 'wrong',
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

    // --- MIDI ---

    get midiLabel() {
      return {
        off: 'Collega tastiera MIDI',
        connecting: 'Connessione…',
        on: this.midiDevices.length ? this.midiDevices.join(', ') : 'Nessuna tastiera trovata',
        error: 'Accesso MIDI negato',
        unsupported: 'MIDI non supportato da questo browser',
      }[this.midiStatus];
    },

    async connectMidi() {
      this.midiStatus = 'connecting';
      try {
        await connectMidi({
          onNoteOn: (note, velocity) => this.midiNoteOn(note, velocity),
          onNoteOff: (note) => this.midiNoteOff(note),
          onDevicesChange: (names) => { this.midiDevices = names; },
        });
        this.midiStatus = 'on';
      } catch {
        this.midiStatus = 'error';
      }
    },

    midiNoteOn(note, velocity) {
      if (this.midiSound) playNote(note, { velocity: 0.3 + (velocity / 127) * 0.5 });
      this.held = { ...this.held, [note]: true };
      if (this.isScaleExercise) this.judgeScaleNote(note);
      this.scheduleRecognition();
    },

    midiNoteOff(note) {
      const { [note]: _, ...rest } = this.held;
      this.held = rest;
      this.scheduleRecognition();
    },

    scheduleRecognition() {
      clearTimeout(this._recognitionTimer);
      const delay = this.isMidiExercise && !this.isScaleExercise ? EXERCISE_DELAY_MS : RECOGNITION_DELAY_MS;
      this._recognitionTimer = setTimeout(() => {
        this.heldStable = Object.keys(this.held).map(Number);
        if (this.isMidiExercise && !this.isScaleExercise) this.judgeHeld();
      }, delay);
    },

    get recognized() {
      return recognizeChord(this.heldStable, this.scale);
    },

    get recognizedText() {
      const r = this.recognized;
      if (!r) return '';
      if (!r.chord) return 'Accordo non presente nella scala';
      return `${this.chordLabel(r.chord)} · ${r.chord.roman} · ${INVERSIONS[r.inversion]}`;
    },

    isRecognized(size, degree) {
      const r = this.recognized;
      return !!r?.chord && r.size === size && r.chord.degree === degree;
    },

    // --- Esercizi ---

    get isMidiExercise() {
      return this.mode === 'exercise' && !!this.question && EXERCISES[this.exercise].midi;
    },

    get isScaleExercise() {
      return this.mode === 'exercise' && this.question?.exercise === 'playScale';
    },

    setMode(mode) {
      this.mode = mode;
      if (mode === 'exercise') this.newQuestion();
      else clearTimeout(this._nextTimer);
      this.save();
    },

    setExercise(id) {
      this.exercise = id;
      this.newQuestion();
      this.save();
    },

    newQuestion() {
      if (this.mode !== 'exercise') return;
      clearTimeout(this._nextTimer);
      this.question = makeQuestion(this.exercise, this.opts, { tonic: this.tonic, type: this.type }, this.question);
      this.feedback = 'idle';
      this.wrongChoices = {};
      this.solutionShown = false;
      this.scaleProgress = 0;
      this.scaleStart = null;
    },

    succeed() {
      this.feedback = 'correct';
      clearTimeout(this._nextTimer);
      this._nextTimer = setTimeout(() => this.newQuestion(), NEXT_QUESTION_MS);
    },

    judgeHeld() {
      if (this.feedback === 'correct') return;
      const result = judgeMidi(this.question, this.heldStable);
      if (result === 'correct') this.succeed();
      else this.feedback = result === 'wrong' ? 'wrong' : 'idle';
    },

    // Ogni nota conta appena premuta. Con una nota sbagliata si resta su quella da suonare.
    judgeScaleNote(midi) {
      if (this.feedback === 'correct') return;
      if (!judgeScaleNote(this.question, this.scaleProgress, this.scaleStart, midi)) {
        this.feedback = 'wrong';
        return;
      }
      if (this.scaleProgress === 0) this.scaleStart = midi;
      this.scaleProgress++;
      this.feedback = 'idle';
      if (this.scaleProgress === this.question.offsets.length) this.succeed();
    },

    scaleChipLabel(note, i) {
      const visible = this.opts.showScale || this.solutionShown || i < this.scaleProgress;
      return visible ? this.name(note) : '?';
    },

    chooseAnswer(choice) {
      if (this.feedback === 'correct' || this.wrongChoices[choice.id]) return;
      if (choice.correct) {
        this.succeed();
      } else {
        this.wrongChoices = { ...this.wrongChoices, [choice.id]: true };
        this.feedback = 'wrong';
      }
    },

    choiceLabel(choice) {
      return choice.roman ?? this.name(choice.root) + choice.quality.suffix;
    },

    choiceClasses(choice) {
      return {
        wrong: !!this.wrongChoices[choice.id],
        right: choice.correct && (this.feedback === 'correct' || this.solutionShown),
      };
    },

    showSolution() {
      this.solutionShown = true;
      this.playQuestion();
    },

    playQuestion() {
      if (this.question.exercise === 'playScale') {
        const midis = scaleRunMidi(this.question.tonic, this.question.type, 1);
        playSequence(midis, 0.25);
        midis.forEach((m, i) => this.flash(m, i * 250, 230));
        return;
      }
      const midis = questionMidi(this.question);
      playChord(midis, { arpeggio: this.arpeggio });
    },

    get exploreKeyLabel() {
      return `${this.name(parseNote(this.tonic))} ${SCALE_TYPES[this.type].suffix}`;
    },

    get questionKey() {
      if (!this.question) return '';
      return this.question.exercise === 'playScale' ? "Un'ottava, in salita e in discesa" : `in ${this.title}`;
    },

    get prompt() {
      const q = this.question;
      if (!q) return '';
      if (q.exercise === 'playDegree') return q.chord.roman;
      if (q.exercise === 'playChord') return this.chordLabel(q.chord);
      if (q.exercise === 'playScale') return this.title;
      return this.opts.answer === 'degree' ? 'Che grado è?' : 'Che accordo è?';
    },

    get promptInversion() {
      const q = this.question;
      return q && q.inversion !== null && EXERCISES[q.exercise].midi ? INVERSIONS[q.inversion] : '';
    },

    get feedbackText() {
      if (this.feedback === 'correct') return this.isScaleExercise ? 'Scala completata!' : 'Giusto!';
      if (this.feedback !== 'wrong') return '';
      if (this.isScaleExercise) return 'Non è la nota giusta, riprova';
      if (!this.isMidiExercise) return 'No, riprova';
      const r = this.recognized;
      if (!r?.chord) return 'Non è questo, riprova';
      const played = this.question.inversion !== null
        ? `${this.chordLabel(r.chord)}, ${INVERSIONS[r.inversion]}`
        : `${this.chordLabel(r.chord)} (${r.chord.roman})`;
      return `Hai suonato ${played}, riprova`;
    },
  };
});

Alpine.start();
