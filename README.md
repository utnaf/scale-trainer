# Scale Trainer

Web app per studiare le scale: scale maggiori e minori (naturale, armonica, melodica) in tutte le tonalità, con la grafia corretta, tastiera di 2 ottave e accordi diatonici (triadi e quadriadi) ascoltabili.

Nessuna build e nessuna dipendenza da installare: Alpine.js viene caricato da CDN.

## Avvio in locale

I moduli ES non funzionano aprendo il file con `file://`, quindi serve un piccolo server:

```bash
python3 -m http.server 8765
```

Poi apri http://localhost:8765. I test della teoria sono su http://localhost:8765/tests/.

## Struttura

- `js/theory.js` — note, scale, armature, accordi diatonici (nessuna dipendenza dal DOM)
- `js/audio.js` — sintetizzatore Web Audio
- `js/app.js` — stato dell'interfaccia (Alpine.js)
- `tests/` — test della teoria, eseguiti nel browser

## Deploy su GitHub Pages

Pubblica la cartella così com'è: Settings → Pages → "Deploy from a branch", branch `main`, cartella `/ (root)`.
