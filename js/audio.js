// Sintetizzatore minimale con Web Audio API: nessun campione, nessuna dipendenza.
// L'AudioContext si crea al primo gesto dell'utente (richiesto dai browser).

let ctx = null;
let master = null;

function ensureContext() {
  if (!ctx) {
    ctx = new AudioContext();
    const compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(compressor).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function playNote(midi, { delay = 0, duration = 1.2, velocity = 0.7 } = {}) {
  const c = ensureContext();
  const t = c.currentTime + delay;
  const freq = midiToFreq(midi);

  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(velocity, t + 0.008);
  env.gain.exponentialRampToValueAtTime(velocity * 0.35, t + 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(freq * 8, 8000), t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 400), t + duration);

  // Triangolo per il corpo, sinusoide all'ottava per un po' di brillantezza.
  const partials = [
    { type: 'triangle', ratio: 1, gain: 1 },
    { type: 'sine', ratio: 2, gain: 0.25 },
  ];
  for (const p of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = p.type;
    osc.frequency.value = freq * p.ratio;
    g.gain.value = p.gain;
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
  filter.connect(env).connect(master);
}

export function playChord(midis, { arpeggio = false } = {}) {
  midis.forEach((m, i) => playNote(m, { delay: arpeggio ? i * 0.12 : 0, velocity: 0.5 }));
}

export function playSequence(midis, step = 0.32) {
  midis.forEach((m, i) => playNote(m, { delay: i * step, duration: 0.6 }));
}
