# CV motion design — Hocine Boukhemza

Vidéo de 15 s (1920×1080, 60 fps, son stéréo) : `cv-motion.mp4`.

Tout est généré par code, sans assets externes (hors polices) :

- `anim.js` : moteur d'animation canvas 2D déterministe (`render(t)`), 5 scènes + transitions
  (wipe en biseau, iris double, découpe en bandes, zoom-through), aberration chromatique,
  glitch, shake caméra, grain et HUD.
- `audio.py` : bande-son 120 BPM synthétisée avec numpy, calée sur les coupes.
- `render.js` : rendu image par image via Chromium headless, encodage ffmpeg (H.264 + AAC).

```bash
python3 audio.py          # -> out/audio.wav
node render.js            # -> cv-motion.mp4
node render.js --stills 1.6,7.6,10.6   # images de contrôle dans out/
```

Aperçu temps réel : servir le dossier et ouvrir `index.html#play`.

Polices : Inter / Inter Display (SIL OFL), JetBrains Mono (SIL OFL).
