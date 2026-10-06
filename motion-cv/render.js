// Renders anim.js frame-by-frame with headless Chromium and pipes PNGs into ffmpeg.
//   node render.js                 -> out/frames video (cv-motion.mp4, needs audio.wav)
//   node render.js --stills 1,3,7  -> out/still_<t>.png for quick review
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname, OUT = path.join(ROOT, 'out'), FPS = 60, DUR = 20, WORKERS = 4;
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.otf': 'font/otf', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  // one browser per worker: pages of a single browser share one (software) GPU process
  const browsers = [], pages = [];
  for (let i = 0; i < WORKERS; i++) {
    const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-gpu-vsync'] });
    browsers.push(browser);
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    p.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
    await p.goto(`http://127.0.0.1:${port}/index.html`);
    await p.evaluate(() => window.ready);
    pages.push(p);
  }
  const page = pages[0];
  const shot = (p, t) => p.evaluate(t => window.render(t), t).then(() => p.screenshot({ type: 'png' }));

  const si = process.argv.indexOf('--stills');
  if (si > 0) {
    for (const t of process.argv[si + 1].split(',').map(Number)) {
      await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(OUT, `still_${t.toFixed(2)}.png`) });
    }
  } else {
    const audio = path.join(OUT, 'audio.wav');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      ...(fs.existsSync(audio) ? ['-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-tune', 'animation', '-movflags', '+faststart',
      path.join(ROOT, 'cv-motion.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = FPS * DUR, t0 = Date.now();
    // frames are rendered in parallel batches (one per page) and written in order
    for (let f = 0; f < N; f += WORKERS) {
      const bufs = await Promise.all(pages.map((p, k) => f + k < N ? shot(p, (f + k) / FPS) : null));
      for (const buf of bufs) if (buf && !ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await Promise.all(browsers.map(b => b.close())); server.close();
})();
