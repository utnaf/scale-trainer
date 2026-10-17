# Scale Trainer

Web app per studiare le scale: scale maggiori e minori (naturale, armonica, melodica) in tutte le tonalità, con la grafia corretta, tastiera di 2 ottave e accordi diatonici (triadi e quadriadi) ascoltabili.

Con una tastiera MIDI collegata (Chrome, Edge o Firefox; Safari non supporta Web MIDI) riconosce gli accordi della scala che stai suonando, con il rivolto.

La modalità **Esercizi** propone tre esercizi liberi, senza punteggi:
- **Suona il grado** (MIDI): l'app chiede per esempio "ii7" e tu lo suoni;
- **Suona l'accordo** (MIDI): l'app dà il nome, per esempio "Fa♯m7", e tu lo suoni;
- **Riconosci l'accordo**: un accordo si accende sulla tastiera e scegli fra 4 risposte (nome o grado).

Nessuna build e nessuna dipendenza da installare: Alpine.js viene caricato da CDN.

## Avvio in locale

I moduli ES non funzionano aprendo il file con `file://`, quindi serve un piccolo server:

```bash
python3 -m http.server 8765
```

Poi apri http://localhost:8765. I test sono su http://localhost:8765/tests/.

## Struttura

- `js/theory.js` — note, scale, armature, accordi diatonici (nessuna dipendenza dal DOM)
- `js/audio.js` — sintetizzatore Web Audio
- `js/midi.js` — input da tastiera MIDI
- `js/exercises.js` — domande e verifica delle risposte degli esercizi
- `js/app.js` — stato dell'interfaccia (Alpine.js)
- `tests/` — test di teoria ed esercizi, eseguiti nel browser

## Deploy su GitHub Pages

Pubblica la cartella così com'è: Settings → Pages → "Deploy from a branch", branch `main`, cartella `/ (root)`.
