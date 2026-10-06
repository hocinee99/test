'use strict';
/* Hocine Boukhemza — CV motion design, 15 s @ 60 fps.
   Deterministic: render(t) draws the frame at time t (seconds). */

const W = 1920, H = 1080, FPS = 60, DUR = 15, TAU = Math.PI * 2;

const main = document.getElementById('c');
main.width = W; main.height = H;
const X = main.getContext('2d');
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const BA = mk(), BB = mk(), BC = mk(), CR = mk(), CG = mk(), CB = mk();
const xa = BA.getContext('2d'), xb = BB.getContext('2d'), xc = BC.getContext('2d');

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outBack: t => { const c1 = 1.9, c3 = c1 + 1; return t <= 0 ? 0 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
function R(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
const sp = (x, k = 120) => k * Math.log1p(Math.exp(x / k)); // softplus

/* ---------- palette & type ---------- */
const COL = { bg: '#05050A', ink: '#F3F3F7', cyan: '#38F2FF', violet: '#7C5CFF', lime: '#D7FF3C', pink: '#FF4F8B' };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const FD = (w, s) => `${w} ${s}px D`, FT = (w, s) => `${w} ${s}px T`, FM = (w, s) => `${w} ${s}px M`;
const DIM = 'rgba(243,243,247,0.52)', FAINT = 'rgba(243,243,247,0.14)';

/* beat-synced impacts: [time, strength, x, y] */
const HITS = [[0.5, 1.25, W / 2, H / 2], [2.0, 0.7, W / 2, H / 2], [5.0, 0.9, 960, 600], [9.0, 0.75, W / 2, H / 2], [12.5, 1.1, W / 2, H / 2], [14.0, 1.0, 960, 380]];

/* ---------- drawing helpers ---------- */
function txt(c, s, x, y, font, color, o = {}) {
  c.save(); c.font = font; c.fillStyle = color; c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic'; c.letterSpacing = (o.ls || 0) + 'px';
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  c.fillText(s, x, y); c.restore();
}
function measure(c, s, font, ls = 0) { c.save(); c.font = font; c.letterSpacing = ls + 'px'; const w = c.measureText(s).width; c.restore(); return w; }

/* letters slide in from behind a per-glyph mask */
function reveal(c, s, x, y, size, font, fill, t, t0, stag, dur, o = {}) {
  const chars = [...s], ls = o.ls || 0, dir = o.dir || 1;
  c.save(); c.font = font; c.letterSpacing = '0px'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const pos = []; let acc = 0;
  for (let i = 0; i < chars.length; i++) { pos.push(acc + i * ls); acc = c.measureText(chars.slice(0, i + 1).join('')).width; }
  const total = acc + (chars.length - 1) * ls;
  const ox = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  c.fillStyle = fill;
  for (let i = 0; i < chars.length; i++) {
    const k = o.order === 'center' ? Math.abs(i - (chars.length - 1) / 2) : i;
    const p = E.outExpo(P(t, t0 + k * stag, t0 + k * stag + dur));
    if (p <= 0 || chars[i] === ' ') continue;
    const cx = ox + pos[i], w = c.measureText(chars[i]).width;
    c.save(); c.beginPath(); c.rect(cx - size * .08, y - size * .98, w + size * .16, size * 1.25); c.clip();
    c.fillText(chars[i], cx, y + (1 - p) * size * 1.05 * dir);
    c.restore();
  }
  c.restore(); return total;
}

/* typewriter + scramble decode (monospace) */
const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\$@';
function decode(c, s, x, y, size, color, t, t0, o = {}) {
  if (t < t0) return;
  const speed = o.speed || 0.014, settle = o.settle || 0.12, ls = o.ls || 0, font = o.font || FM(500, size);
  const chars = [...s]; let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ti = t0 + i * speed; if (t < ti) break;
    out += (chars[i] === ' ' || t > ti + settle) ? chars[i] : GLY[(Math.floor(t * 60) * 7 + i * 13) % GLY.length];
  }
  c.save(); c.font = font; c.letterSpacing = ls + 'px'; c.fillStyle = color; c.textAlign = 'left';
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  const full = c.measureText(s).width;
  const xx = o.align === 'center' ? x - full / 2 : o.align === 'right' ? x - full : x;
  c.fillText(out, xx, y);
  if (out.length < chars.length || (t - t0 - chars.length * speed) < 0.35) {
    const w = c.measureText(out).width;
    if (Math.floor(t * 8) % 2 === 0 || out.length < chars.length) c.fillRect(xx + w + 3, y - size * .78, size * .55, size * .92);
  }
  c.restore();
}

function line(c, x0, y0, x1, y1, col, w = 1) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function glow(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function pill(c, s, x, y, size, col, o = {}) {
  const font = FM(500, size), w = measure(c, s, font, 1) + size * 1.4, h = size * 2;
  c.save(); if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  rrect(c, x, y - h / 2, w, h, h / 2);
  if (o.fill) { c.fillStyle = o.fill; c.fill(); } c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
  txt(c, s, x + size * .7, y + size * .36, font, o.text || col, { ls: 1 });
  c.restore(); return w;
}

/* ---------- background: glows + reactive dot grid ---------- */
const DOTS = []; { const s = 60; for (let y = 30; y < H + s; y += s) for (let x = 30; x < W + s; x += s) DOTS.push([x, y]); }
function bg(c, t, tint) {
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
  glow(c, W * .22 + Math.sin(t * .6) * 220, H * .3 + Math.cos(t * .5) * 140, 950, rgba(tint[0], .17));
  glow(c, W * .8 + Math.cos(t * .45) * 220, H * .75 + Math.sin(t * .7) * 110, 1050, rgba(tint[1], .14));
  c.fillStyle = '#fff';
  for (const [x, y] of DOTS) {
    let b = .075, dx = 0, dy = 0;
    for (const [ht, s, hx, hy] of HITS) {
      const dt = t - ht; if (dt < 0 || dt > 1.5) continue;
      const r = dt * 1750, ex = x - hx, ey = y - hy, d = Math.hypot(ex, ey) + 1e-3;
      const w = Math.exp(-(((d - r) / 110) ** 2)) * (1 - dt / 1.5) * s;
      b += w * .85; dx += ex / d * w * 22; dy += ey / d * w * 22;
    }
    c.globalAlpha = Math.min(1, b); c.fillRect(x + dx - 1.5, y + dy - 1.5, 3, 3);
  }
  c.globalAlpha = 1;
}

/* section header */
function header(c, u, num, title, sub) {
  decode(c, num, 120, 112, 16, COL.lime, u, 0.0, { ls: 3 });
  reveal(c, title, 116, 180, 66, FD(900, 66), COL.ink, u, 0.08, 0.028, 0.6, { ls: -1 });
  const p = E.outExpo(P(u, 0.15, 0.8));
  line(c, 120, 206, 120 + 360 * p, 206, COL.cyan, 2);
  decode(c, sub, 120, 236, 15, DIM, u, 0.3, { ls: 2, speed: .01 });
}

/* =========================================================
   SCENE 1 — INTRO (0 → 2.2)
   ========================================================= */
const RAYS = (() => { const r = R(3); return Array.from({ length: 64 }, (_, i) => ({ a: i / 64 * TAU + r() * .08, l: 700 + r() * 1100, d: r() * .35, c: [COL.cyan, COL.violet, COL.ink, COL.lime][i % 4], w: 1.5 + r() * 3 })); })();
const INRAYS = (() => { const r = R(9); return Array.from({ length: 42 }, () => ({ a: r() * TAU, d: r() * .18, len: 80 + r() * 260 })); })();

function S1(c, t) {
  bg(c, t, [COL.violet, COL.cyan]);
  const cx = W / 2, cy = H / 2;
  c.save();
  const z = 1 + .07 * E.outCubic(P(t, .5, 2.3));
  c.translate(cx, cy); c.scale(z, z); c.translate(-cx, -cy);

  // anticipation: streaks converging to the center
  if (t < .52) {
    c.globalCompositeOperation = 'lighter';
    for (const r of INRAYS) {
      const p = E.inCubic(P(t, .02 + r.d, .5));
      if (p <= 0) continue;
      const r1 = lerp(1250, 0, p), r0 = r1 + r.len * (1 - p * .6);
      c.globalAlpha = p * .9;
      line(c, cx + Math.cos(r.a) * r0, cy + Math.sin(r.a) * r0, cx + Math.cos(r.a) * r1, cy + Math.sin(r.a) * r1, COL.cyan, 2);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const pop = E.outBack(P(t, 0, .25)), shrink = E.inExpo(P(t, .36, .5));
    const rad = (12 + Math.sin(t * 45) * 2) * pop * (1 - shrink);
    glow(c, cx, cy, 120 * pop, rgba(COL.cyan, .5));
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, Math.max(0, rad), 0, TAU); c.fill();
  }

  // the burst
  if (t >= .5) {
    c.globalCompositeOperation = 'lighter';
    for (const r of RAYS) {
      const p1 = E.outExpo(P(t, .5, 1.0 + r.d)), p0 = E.outExpo(P(t, .56 + r.d * .3, 1.35 + r.d));
      if (p0 >= 1) continue;
      const a = r.a + (t - .5) * .15;
      c.globalAlpha = 1 - p0;
      line(c, cx + Math.cos(a) * r.l * p0, cy + Math.sin(a) * r.l * p0, cx + Math.cos(a) * r.l * p1, cy + Math.sin(a) * r.l * p1, r.c, r.w * (1 - p0 * .7));
    }
    const pr = P(t, .5, 1.6);
    if (pr < 1) {
      c.globalAlpha = (1 - pr) * .9;
      c.strokeStyle = COL.cyan; c.lineWidth = 70 * (1 - pr) ** 2; c.beginPath(); c.arc(cx, cy, 1500 * E.outExpo(pr), 0, TAU); c.stroke();
      c.strokeStyle = COL.ink; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 1100 * E.outExpo(P(t, .52, 1.4)), 0, TAU); c.stroke();
      c.strokeStyle = COL.violet; c.lineWidth = 6 * (1 - pr); c.beginPath(); c.arc(cx, cy, 700 * E.outExpo(P(t, .55, 1.3)), 0, TAU); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // name
  const g = c.createLinearGradient(cx - 640, 0, cx + 640, 0);
  g.addColorStop(0, COL.cyan); g.addColorStop(.55, COL.violet); g.addColorStop(1, COL.pink);
  reveal(c, 'HOCINE', cx, 500, 205, FD(900, 205), COL.ink, t, .55, .04, .85, { align: 'center', ls: -5, order: 'center' });
  reveal(c, 'BOUKHEMZA', cx, 694, 205, FD(900, 205), g, t, .64, .035, .85, { align: 'center', ls: -5, dir: -1, order: 'center' });

  // hairlines + edge labels
  const ph = E.outExpo(P(t, .7, 1.5));
  if (ph > 0) {
    line(c, cx - 690, 522, lerp(cx - 690, 140, ph), 522, 'rgba(255,255,255,.35)', 1);
    line(c, cx + 690, 522, lerp(cx + 690, W - 140, ph), 522, 'rgba(255,255,255,.35)', 1);
    decode(c, '[ CV ]', 140, 510, 15, COL.lime, t, .95, { ls: 2 });
    decode(c, 'ALTERNANCE 26/27', W - 140, 510, 15, COL.lime, t, 1.0, { ls: 2, align: 'right' });
  }
  decode(c, 'ÉLÈVE INGÉNIEUR · CENTRALE MÉDITERRANÉE × DAUPHINE-PSL', cx, 800, 25, COL.ink, t, 1.0, { ls: 5, align: 'center', speed: .011 });
  decode(c, 'DATA SCIENCE — MACHINE LEARNING — OPTIMISATION', cx, 848, 18, COL.cyan, t, 1.25, { ls: 6, align: 'center', speed: .01 });
  c.restore();
}

/* =========================================================
   SCENE 2 — FORMATION timeline (≈2.0 → 5.0)
   ========================================================= */
const EDU = [
  { y: '2023', tag: 'BACCALAURÉAT', ti: 'Mention Très bien', sub: 'Maths · Physique-Chimie · Maths expertes' },
  { y: '23—24', tag: 'CPGE · MPSI', ti: 'Lycée Paul Valéry', sub: 'Maths avancées · Physique · SI' },
  { y: '24—25', tag: 'LICENCE 2 · INFORMATIQUE', ti: 'Sorbonne Université', sub: 'Algorithmique · Structures de données · C · Java' },
  { y: '25—26', tag: 'LICENCE · INFO & MATHS', ti: 'Dauphine-PSL', sub: 'Machine Learning · Stats · Optimisation · IA' },
  { y: '26—27', tag: 'CYCLE INGÉNIEUR + MASTER 1', ti: 'Centrale Méditerranée', sub: '× Dauphine-PSL — Informatique, Décision, Données' },
];
const NX = i => 300 + i * 560, LY = 600, T0 = .4, ST = .45, MV = .28;
function headX(u) {
  if (u < T0) return lerp(-260, NX(0), E.outExpo(P(u, .02, T0)));
  const k = Math.floor((u - T0) / ST);
  if (k >= 4) return NX(4);
  const lu = u - T0 - k * ST;
  return lerp(NX(k), NX(k + 1), E.inOutExpo(P(lu, ST - MV, ST)));
}

function S2(c, t) {
  bg(c, t, [COL.cyan, COL.violet]);
  const u = t - 2.0;
  const hx = headX(u), camX = sp(hx - 960 + 40) - 40;
  c.save();
  // final push-in toward the last node
  const zz = 1 + .35 * E.inExpo(P(u, 2.5, 3.2));
  c.translate(960, LY); c.scale(zz, zz); c.translate(-960, -LY);

  // background parallax word
  c.save(); c.font = FD(900, 300); c.letterSpacing = '-6px';
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2;
  c.strokeText('PARCOURS ACADÉMIQUE', 60 - camX * .3 - u * 40, 1000); c.restore();

  c.save(); c.translate(-camX, 0);
  // ruler
  c.globalAlpha = .9;
  for (let x = -400; x < NX(4) + 900; x += 40) {
    const big = x % 200 === 0;
    line(c, x, LY + 40, x, LY + 40 + (big ? 14 : 6), 'rgba(255,255,255,.12)', 1);
  }
  c.globalAlpha = 1;
  // future dashed track
  c.setLineDash([3, 10]); line(c, -400, LY, NX(4) + 900, LY, 'rgba(255,255,255,.18)', 2); c.setLineDash([]);
  // progress line
  const g = c.createLinearGradient(hx - 900, 0, hx, 0);
  g.addColorStop(0, rgba(COL.violet, .0)); g.addColorStop(.6, rgba(COL.violet, .9)); g.addColorStop(1, COL.cyan);
  line(c, -400, LY, hx, LY, g, 4);
  c.globalCompositeOperation = 'lighter'; glow(c, hx, LY, 90, rgba(COL.cyan, .55)); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx, LY, 5, 0, TAU); c.fill();

  EDU.forEach((e, i) => {
    const ti = T0 + i * ST, x = NX(i), last = i === 4;
    const pop = E.outBack(P(u, ti - .04, ti + .3));
    if (pop <= 0) return;
    const pr = P(u, ti, ti + .9);
    if (pr < 1) { c.globalAlpha = 1 - pr; c.strokeStyle = last ? COL.lime : COL.cyan; c.lineWidth = 2; c.beginPath(); c.arc(x, LY, 18 + 90 * E.outExpo(pr), 0, TAU); c.stroke(); c.globalAlpha = 1; }
    if (last) { c.globalCompositeOperation = 'lighter'; glow(c, x, LY, 260 * pop, rgba(COL.lime, .22 + .06 * Math.sin(u * 12))); c.globalCompositeOperation = 'source-over'; }
    c.fillStyle = COL.bg; c.strokeStyle = last ? COL.lime : COL.cyan; c.lineWidth = 3;
    c.beginPath(); c.arc(x, LY, 17 * pop, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = last ? COL.lime : COL.cyan; c.beginPath(); c.arc(x, LY, 6.5 * pop, 0, TAU); c.fill();

    const up = i % 2 === 0 ? -1 : 1, ps = E.outExpo(P(u, ti, ti + .4));
    line(c, x, LY + up * 26, x, LY + up * (26 + 64 * ps), 'rgba(255,255,255,.4)', 1);
    const bx = x - 18;
    const yTag = up < 0 ? LY - 300 : LY + 132, yYear = up < 0 ? LY - 196 : LY + 236;
    const yTi = yYear + 50, ySub = yYear + 86;
    decode(c, e.tag, bx, yTag, 16, last ? COL.lime : COL.cyan, u, ti + .02, { ls: 2.5, speed: .009 });
    reveal(c, e.y, bx - 4, yYear, 100, FD(900, 100), COL.ink, u, ti, .035, .55, { ls: -3 });
    const pt = E.outExpo(P(u, ti + .1, ti + .6));
    txt(c, e.ti, bx + (1 - pt) * 40, yTi, FD(700, 36), COL.ink, { alpha: pt });
    const pb = E.outExpo(P(u, ti + .18, ti + .7));
    txt(c, e.sub, bx + (1 - pb) * 40, ySub, FT(400, 20), DIM, { alpha: pb });
    if (last) {
      const pp = E.outBack(P(u, ti + .25, ti + .6));
      if (pp > 0) {
        c.save(); c.translate(bx + 356, yYear - 66); c.scale(pp, pp);
        pill(c, 'EN COURS', 0, 0, 14, COL.lime, { fill: COL.lime, text: COL.bg }); c.restore();
      }
    }
  });
  c.restore();
  c.restore();
  header(c, u, '01 —', 'FORMATION', 'PARCOURS / 2023 → 2027');
}

/* =========================================================
   SCENE 3 — COMPÉTENCES (≈5.0 → 9.0)
   ========================================================= */
const KM = (() => {
  const r = R(21), cs = [[.27, .34], [.73, .3], [.52, .74]], init = [[.12, .78], [.5, .18], [.86, .66]];
  const pts = [];
  for (let i = 0; i < 190; i++) {
    const k = i % 3; const [mx, my] = cs[k];
    pts.push({ k, x0: .04 + r() * .92, y0: .06 + r() * .88, x1: clamp(mx + gauss(r) * .075, .03, .97), y1: clamp(my + gauss(r) * .075, .03, .97), d: r() });
  }
  return { pts, cs, init };
})();
const KCOL = [COL.cyan, COL.violet, COL.lime];
const SK = [
  { n: '01', t: 'MACHINE LEARNING', s: 'SVM · KNN · RANDOM FOREST · K-MEANS · PCA' },
  { n: '02', t: 'DATA SCIENCE', s: 'PANDAS · NUMPY · SCIKIT-LEARN · EDA · SEABORN' },
  { n: '03', t: 'MATHS & STATS', s: 'PROBABILITÉS · INFÉRENCE · OPTIMISATION' },
  { n: '04', t: 'PROGRAMMATION', s: 'PYTHON · SQL · R · JAVA · C · GIT · LINUX' },
];
const CHIPS = ['PYTHON', 'PANDAS', 'NUMPY', 'SCIKIT-LEARN', 'MATPLOTLIB', 'SEABORN', 'SQL', 'R', 'JAVA', 'C', 'GIT / GITHUB', 'LINUX', 'LATEX', 'UML', 'APIs', 'JUNIT'];
const LANGS = [['FR', 'NATIF', 5], ['EN', 'AVANCÉ', 4], ['AR', 'AVANCÉ', 4]];

function S3(c, t) {
  bg(c, t, [COL.violet, COL.cyan]);
  const u = t - 5.0;
  header(c, u - .15, '02 —', 'COMPÉTENCES', 'DATA · ML · MATHS · CODE');

  /* --- left: live K-Means plot --- */
  const px = 130, py = 290, pw = 780, ph = 600;
  const pf = E.outExpo(P(u, .15, .75));
  c.save();
  for (let i = 0; i <= 8; i++) { const a = E.outExpo(P(u, .2 + i * .03, .7 + i * .03)); line(c, px + pw * i / 8, py + ph, px + pw * i / 8, py + ph - ph * a, 'rgba(255,255,255,.06)', 1); }
  for (let j = 0; j <= 6; j++) { const a = E.outExpo(P(u, .2 + j * .03, .7 + j * .03)); line(c, px, py + ph * j / 6, px + pw * a, py + ph * j / 6, 'rgba(255,255,255,.06)', 1); }
  line(c, px, py + ph, px + pw * pf, py + ph, 'rgba(255,255,255,.5)', 1.5);
  line(c, px, py + ph, px, py + ph - ph * pf, 'rgba(255,255,255,.5)', 1.5);
  txt(c, 'PC1 →', px + pw - 70, py + ph + 30, FM(500, 14), DIM, { alpha: pf, ls: 2 });
  txt(c, '↑ PC2', px - 2, py - 14, FM(500, 14), DIM, { alpha: pf, ls: 2 });

  // centroid positions — 3 stepped iterations on the beat
  const steps = [1.0, 1.5, 2.0];
  const it = steps.reduce((a, s) => a + E.inOutExpo(P(u, s, s + .28)), 0) / 3;
  const cen = KM.cs.map((cc, k) => [lerp(KM.init[k][0], cc[0], it), lerp(KM.init[k][1], cc[1], it)]);
  const toS = (x, y) => [px + x * pw, py + y * ph];
  const lineA = .2 * P(u, 1.0, 1.4) * (1 - P(u, 3.2, 3.8));
  for (const p of KM.pts) {
    const a = E.outBack(P(u, .3 + p.d * .55, .62 + p.d * .55)); if (a <= 0) continue;
    const m = E.inOutCubic(P(u, 1.0 + p.d * .35, 2.1 + p.d * .35));
    const [sx, sy] = toS(lerp(p.x0, p.x1, m), lerp(p.y0, p.y1, m));
    if (lineA > 0) { const [cxx, cyy] = toS(...cen[p.k]); c.globalAlpha = lineA; line(c, sx, sy, cxx, cyy, KCOL[p.k], 1); c.globalAlpha = 1; }
    const colA = P(u, 1.05 + p.d * .3, 1.4 + p.d * .3);
    c.fillStyle = colA > .5 ? KCOL[p.k] : 'rgba(255,255,255,.75)';
    c.beginPath(); c.arc(sx, sy, 4.2 * a, 0, TAU); c.fill();
  }
  // cluster rings
  KM.cs.forEach((cc, k) => {
    const a = E.outExpo(P(u, 2.3 + k * .08, 3.0 + k * .08)); if (a <= 0) return;
    const [sx, sy] = toS(...cc);
    c.save(); c.setLineDash([6, 8]); c.lineDashOffset = -t * 40; c.strokeStyle = rgba(KCOL[k], .8); c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(sx, sy, 135 * a, 105 * a, 0, -Math.PI / 2, -Math.PI / 2 + TAU * a); c.stroke(); c.restore();
    decode(c, `C${k + 1}`, sx + 100, sy - 92, 14, KCOL[k], u, 2.45 + k * .08, { ls: 2 });
  });
  // centroids
  const ca = E.outBack(P(u, .95, 1.25));
  if (ca > 0) cen.forEach((cc, k) => {
    const [sx, sy] = toS(...cc), s = 14 * ca;
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    line(c, sx - s, sy - s, sx + s, sy + s, '#fff', 3); line(c, sx - s, sy + s, sx + s, sy - s, '#fff', 3);
    c.strokeStyle = KCOL[k]; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 22 * ca, 0, TAU); c.stroke();
  });
  // PCA axes
  const pa = E.outExpo(P(u, 2.9, 3.5));
  if (pa > 0) {
    const [mx, my] = toS(.5, .46), ang = -.18;
    const arrow = (len, a, lab, col) => {
      const ex = mx + Math.cos(a) * len * pa, ey = my + Math.sin(a) * len * pa;
      line(c, mx - Math.cos(a) * len * pa, my - Math.sin(a) * len * pa, ex, ey, col, 2.5);
      c.fillStyle = col; c.save(); c.translate(ex, ey); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(-14, -7); c.lineTo(-14, 7); c.fill(); c.restore();
      txt(c, lab, ex + 12, ey - 10, FM(700, 15), col, { alpha: pa, ls: 2 });
    };
    arrow(330, ang, 'PC1', COL.ink); arrow(150, ang - Math.PI / 2, 'PC2', COL.pink);
  }
  // readout
  const iter = u < 1 ? 0 : u < 1.5 ? 1 : u < 2 ? 2 : 3;
  decode(c, 'K-MEANS  k=3', px + pw - 230, py + 30, 15, COL.ink, u, .5, { ls: 2 });
  if (u > .9) txt(c, `ITER  ${String(iter).padStart(2, '0')}/03`, px + pw - 230, py + 56, FM(500, 15), COL.lime, { ls: 2 });
  if (u > 2.9) decode(c, '+ PCA · RÉDUCTION 2D', px + pw - 230, py + 82, 15, COL.pink, u, 2.9, { ls: 2 });
  decode(c, 'FIG.01 — APPRENTISSAGE NON SUPERVISÉ', px, py + ph + 42, 14, DIM, u, .7, { ls: 2, speed: .008 });
  c.restore();

  /* --- right: skill stack --- */
  const rx = 1020;
  SK.forEach((s, i) => {
    const y0 = 340 + i * 130, t0 = .35 + i * .12;
    const hl = Math.max(0, 1 - Math.abs(u - (2.0 + i * .5) - .2) / .35); // beat-synced highlight
    const pd = E.outExpo(P(u, t0 + .1, t0 + .9));
    line(c, rx, y0 + 52, rx + 800 * pd, y0 + 52, 'rgba(255,255,255,.12)', 1);
    if (hl > 0) { c.fillStyle = rgba(COL.cyan, .08 * hl); c.fillRect(rx - 20, y0 - 70, 840, 122); c.fillStyle = COL.cyan; c.fillRect(rx - 20, y0 - 70, 4, 122 * hl); }
    decode(c, s.n, rx, y0 - 30, 16, COL.lime, u, t0, { ls: 2 });
    reveal(c, s.t, rx + 50, y0, 62, FD(900, 62), hl > .3 ? COL.cyan : COL.ink, u, t0, .022, .6, { ls: -1 });
    decode(c, s.s, rx + 52, y0 + 34, 15, DIM, u, t0 + .3, { ls: 2, speed: .006 });
  });
  // languages
  LANGS.forEach(([code, lvl, n], i) => {
    const x = rx + i * 270, y = 880, t0 = 1.3 + i * .1;
    const a = E.outExpo(P(u, t0, t0 + .5)); if (a <= 0) return;
    txt(c, code, x, y + (1 - a) * 30, FD(900, 40), COL.ink, { alpha: a });
    txt(c, lvl, x + 66, y - 18, FM(500, 13), DIM, { alpha: a, ls: 2 });
    for (let k = 0; k < 5; k++) {
      const on = k < n, ak = E.outBack(P(u, t0 + .2 + k * .06, t0 + .45 + k * .06));
      c.fillStyle = on ? (i === 0 ? COL.lime : COL.cyan) : 'rgba(255,255,255,.15)';
      c.fillRect(x + 66 + k * 30, y - 8, 22 * ak, 8);
    }
  });
  // marquee of tools
  const ma = E.outCubic(P(u, .4, 1.0));
  if (ma > 0) {
    c.save(); c.globalAlpha = ma;
    let x = 120 - ((u + 4) * 130) % 2600;
    for (let rep = 0; rep < 3; rep++) for (const s of CHIPS) {
      const w = pill(c, s, x, 975, 15, 'rgba(255,255,255,.35)', { text: COL.ink }); x += w + 16;
    }
    c.restore();
  }
}

/* =========================================================
   SCENE 4 — PROJETS (≈9.0 → 12.5)
   ========================================================= */
const PROJ = [
  { id: 'P/01', date: '03/2026', stat: 89, fmt: v => `${v}%`, lab: 'PRÉCISION · SUPERVISÉ', ti: 'Fashion-MNIST', d: ['Classification de 70 000 images :', 'normalisation, SVM, KNN,', 'K-Means + réduction PCA.'], tags: ['PYTHON', 'SKLEARN'], vis: 'mnist' },
  { id: 'P/02', date: '02/2026', stat: null, txt: '€/m²', lab: 'PRÉDICTION · DONNÉES DVF', ti: 'ImmoPredict-DVF', d: ['Marché immobilier français :', 'EDA, Random Forest vs', 'régression linéaire, R² & RMSE.'], tags: ['PANDAS', 'SEABORN'], vis: 'dvf' },
  { id: 'P/03', date: '12/2025', stat: 40, fmt: v => `−${v}%`, lab: 'TEMPS DE CALCUL VS NAÏF', ti: 'Sac à dos multidim.', d: ['Glouton vs Hill Climbing,', 'architecture objet, benchmark,', '15+ tests unitaires JUnit.'], tags: ['JAVA', 'JUNIT'], vis: 'mkp' },
  { id: 'P/04', date: '02/2025', stat: 17, fmt: v => `${v}/20`, lab: 'NOTE · LANGAGE C', ti: 'Simulateur de CPU', d: ['Mémoire segmentée (First/Best/', 'Worst-fit), cycle Fetch/Execute,', 'tables de hachage.'], tags: ['C', 'MAKEFILE'], vis: 'cpu' },
];
const CW = 405, CH = 680, CY = 268, CXo = i => 120 + i * (CW + 25);

const SHIRT = (() => {
  const r = R(5), g = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const uu = Math.abs((x - 9.5) / 10), v = (y + .5) / 20;
    let on = uu < .5 && v > .14 && v < .95;                                        // body
    if (uu >= .5 && uu < .98) on = v > .14 + (uu - .5) * .4 && v < .44 + (uu - .5) * .12; // sleeves
    if (uu < .2 && v < .14 + .12 * Math.sqrt(1 - (uu / .2) ** 2)) on = false;      // neckline
    g.push(on ? .55 + r() * .45 : r() * .06);
  }
  return g;
})();
const DVF = (() => { const r = R(17); return Array.from({ length: 46 }, () => { const x = .05 + r() * .9; return [x, clamp(.18 + x * .62 + gauss(r) * .07, .02, .98)]; }); })();
const land = x => .55 * Math.exp(-(((x - .72) / .14) ** 2)) + .3 * Math.exp(-(((x - .3) / .1) ** 2)) + .12 * Math.sin(x * 18) * .3 + .1;

function visual(c, kind, vu, w, h) {
  if (kind === 'mnist') {
    const cs = 11, gx = 6, gy = 6;
    for (let y = 0; y < 20; y++) {
      const a = P(vu, .25 + y * .03, .35 + y * .03); if (a <= 0) continue;
      for (let x = 0; x < 20; x++) { const v = SHIRT[y * 20 + x]; c.fillStyle = `rgba(243,243,247,${v * a})`; c.fillRect(gx + x * cs, gy + y * cs, cs - 1.5, cs - 1.5); }
    }
    const sc = P(vu, .25, .9);
    if (sc > 0 && sc < 1) { const yy = gy + sc * 220; line(c, gx - 4, yy, gx + 224, yy, COL.cyan, 2); c.globalCompositeOperation = 'lighter'; glow(c, gx + 110, yy, 90, rgba(COL.cyan, .25)); c.globalCompositeOperation = 'source-over'; }
    const bx = 250, cls = [['T-SHIRT', .92], ['CHEMISE', .3], ['PULL', .18], ['ROBE', .08]];
    cls.forEach(([n, v], i) => {
      const a = E.outExpo(P(vu, .9 + i * .06, 1.5 + i * .06));
      txt(c, n, bx, 34 + i * 54, FM(500, 12), i === 0 ? COL.cyan : DIM, { alpha: a, ls: 1.5 });
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bx, 44 + i * 54, 100, 6);
      c.fillStyle = i === 0 ? COL.cyan : 'rgba(255,255,255,.45)'; c.fillRect(bx, 44 + i * 54, 100 * v * a, 6);
    });
    if (vu > 1.0) { const a = E.outExpo(P(vu, 1.0, 1.4)); c.strokeStyle = rgba(COL.cyan, a); c.lineWidth = 2; c.strokeRect(gx - 4, gy - 4, 228 * a, 228); }
  } else if (kind === 'dvf') {
    const ox = 10, oy = 10, pw = w - 20, ph = h - 30;
    line(c, ox, oy + ph, ox + pw, oy + ph, 'rgba(255,255,255,.35)', 1); line(c, ox, oy, ox, oy + ph, 'rgba(255,255,255,.35)', 1);
    const la = E.inOutCubic(P(vu, .75, 1.35));
    DVF.forEach(([x, y], i) => {
      const a = E.outBack(P(vu, .25 + i * .012, .5 + i * .012)); if (a <= 0) return;
      const sx = ox + x * pw, sy = oy + ph - y * ph, fy = oy + ph - (.18 + x * .62) * ph;
      if (la > 0 && (x - .05) / .9 < la) { c.globalAlpha = .5; line(c, sx, sy, sx, fy, COL.pink, 1); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(243,243,247,.85)'; c.beginPath(); c.arc(sx, sy, 3.6 * a, 0, TAU); c.fill();
    });
    if (la > 0) {
      const x1 = .02 + .96 * la;
      line(c, ox + .02 * pw, oy + ph - (.18 + .02 * .62) * ph, ox + x1 * pw, oy + ph - (.18 + x1 * .62) * ph, COL.lime, 3);
    }
    txt(c, 'SURFACE →', ox + pw - 84, oy + ph + 20, FM(500, 11), DIM, { ls: 1.5, alpha: P(vu, .3, .6) });
    txt(c, 'PRIX ↑', ox + 8, oy + 12, FM(500, 11), DIM, { ls: 1.5, alpha: P(vu, .3, .6) });
  } else if (kind === 'mkp') {
    const ox = 6, pw = w - 12, top = 8, ch = 150;
    c.beginPath();
    for (let i = 0; i <= 100; i++) { const x = i / 100, y = top + ch - land(x) * ch; i ? c.lineTo(ox + x * pw, y) : c.moveTo(ox + x * pw, y); }
    const lp = E.outCubic(P(vu, .2, .8));
    c.save(); c.beginPath(); c.rect(0, 0, w * lp, h); c.clip();
    c.beginPath(); for (let i = 0; i <= 100; i++) { const x = i / 100, y = top + ch - land(x) * ch; i ? c.lineTo(ox + x * pw, y) : c.moveTo(ox + x * pw, y); }
    c.strokeStyle = 'rgba(243,243,247,.7)'; c.lineWidth = 2; c.stroke();
    c.lineTo(ox + pw, top + ch); c.lineTo(ox, top + ch); c.fillStyle = rgba(COL.violet, .15); c.fill();
    c.restore();
    // hill-climbing walker, stepping
    const k = Math.floor(clamp((vu - .7) / .12, 0, 9)), f = E.inOutExpo(P((vu - .7) % .12, .0, .08));
    const xs = [.45, .5, .55, .6, .64, .67, .69, .705, .715, .72];
    const xw = vu < .7 ? .45 : lerp(xs[k], xs[Math.min(9, k + 1)], k >= 9 ? 0 : f);
    if (vu > .6) {
      for (let j = 0; j <= k; j++) { const y = top + ch - land(xs[j]) * ch; c.fillStyle = rgba(COL.lime, .35); c.beginPath(); c.arc(ox + xs[j] * pw, y, 3, 0, TAU); c.fill(); }
      const y = top + ch - land(xw) * ch;
      c.globalCompositeOperation = 'lighter'; glow(c, ox + xw * pw, y, 40, rgba(COL.lime, .5)); c.globalCompositeOperation = 'source-over';
      c.fillStyle = COL.lime; c.beginPath(); c.arc(ox + xw * pw, y, 6.5, 0, TAU); c.fill();
    }
    const ba = E.outExpo(P(vu, .5, 1.2)), bb = E.outExpo(P(vu, .9, 1.7));
    txt(c, 'NAÏF', ox, 194, FM(500, 11), DIM, { ls: 1.5 }); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(ox + 80, 186, (pw - 80) * ba, 8);
    txt(c, 'OPTIMISÉ', ox, 220, FM(500, 11), COL.lime, { ls: 1.5 }); c.fillStyle = COL.lime; c.fillRect(ox + 80, 212, (pw - 80) * lerp(1, .6, bb) * ba, 8);
  } else if (kind === 'cpu') {
    const rows = 7, cols = 16, fs = 15;
    const a = P(vu, .2, .5);
    const pc = Math.floor(Math.max(0, vu - .5) / .12) % rows;
    for (let r = 0; r < rows; r++) {
      const ra = P(vu, .2 + r * .04, .35 + r * .04); if (ra <= 0) continue;
      const y = 22 + r * 24;
      if (r === pc && vu > .5) { c.fillStyle = rgba(COL.cyan, .14); c.fillRect(0, y - 17, w, 22); txt(c, '▶', 2, y, FM(700, 13), COL.cyan); }
      txt(c, (0x40 + r * 4).toString(16).toUpperCase().padStart(4, '0'), 22, y, FM(500, 12), DIM, { alpha: ra });
      let s = '';
      for (let k = 0; k < cols; k++) { const h0 = Math.sin((r * 31 + k * 17) * 12.9898 + Math.floor(vu * 14) * (k % 3 === 0 ? 1 : 0)) * 43758.5; s += (h0 - Math.floor(h0)) > .5 ? '1' : '0'; if (k === 7) s += ' '; }
      txt(c, s, 80, y, FM(500, fs), r === pc ? COL.ink : 'rgba(243,243,247,.55)', { alpha: ra * a, ls: 1 });
    }
    const st = ['FETCH', 'DECODE', 'EXECUTE'], act = Math.floor(Math.max(0, vu - .5) / .2) % 3;
    let x = 0;
    st.forEach((s, i) => {
      const on = i === act && vu > .5, ap = E.outBack(P(vu, .4 + i * .08, .7 + i * .08));
      if (ap <= 0) return;
      c.save(); c.translate(x, 210); c.scale(1, ap);
      const ww = pill(c, s, 0, 0, 12, on ? COL.lime : 'rgba(255,255,255,.4)', { fill: on ? COL.lime : null, text: on ? COL.bg : COL.ink });
      c.restore();
      x += ww + 6; if (i < 2) { txt(c, '›', x, 215, FM(700, 16), DIM); x += 18; }
    });
  }
}

function S4(c, t) {
  bg(c, t, [COL.cyan, COL.pink]);
  const u = t - 9.0;
  const z = 1 + .025 * E.inOutSine(P(u, 0, 3.5));
  c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2);
  header(c, u - .1, '03 —', 'PROJETS', 'ML · OPTIMISATION · SYSTÈMES');
  PROJ.forEach((p, i) => {
    const s0 = .12 + i * .1, a = E.outExpo(P(u, s0, s0 + .75));
    if (a <= 0) return;
    const vu = u - s0, x = CXo(i), y = CY + (1 - a) * 220;
    const hl = Math.max(0, 1 - Math.abs(u - (1.5 + i * .5)) / .4);
    c.save(); c.translate(x + CW / 2, y + CH / 2); c.rotate((1 - a) * (i % 2 ? .08 : -.08)); c.scale(lerp(.86, 1, a), lerp(.86, 1, a)); c.translate(-CW / 2, -CH / 2);
    c.globalAlpha = clamp(a * 1.6);
    // card body
    const cg = c.createLinearGradient(0, 0, 0, CH); cg.addColorStop(0, 'rgba(255,255,255,.065)'); cg.addColorStop(1, 'rgba(255,255,255,.015)');
    rrect(c, 0, 0, CW, CH, 22); c.fillStyle = cg; c.fill();
    c.strokeStyle = hl > 0 ? rgba(COL.cyan, .25 + .75 * hl) : 'rgba(255,255,255,.13)'; c.lineWidth = 1.5 + hl * 1.5; c.stroke();
    if (hl > 0) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, CW / 2, 0, 320, rgba(COL.cyan, .12 * hl)); c.restore(); }
    // top bar
    txt(c, p.id, 24, 38, FM(700, 14), COL.lime, { ls: 2 });
    txt(c, p.date, CW - 24, 38, FM(500, 14), DIM, { ls: 2, align: 'right' });
    line(c, 24, 54, 24 + (CW - 48) * E.outExpo(P(vu, .2, .8)), 54, 'rgba(255,255,255,.12)', 1);
    // visual
    c.save(); c.translate(24, 72); c.beginPath(); c.rect(-4, -4, CW - 40, 250); c.clip(); visual(c, p.vis, vu, CW - 48, 240); c.restore();
    // stat
    const sv = p.stat !== null ? p.fmt(Math.round(p.stat * E.outExpo(P(vu, .35, 1.4)))) : null;
    c.save(); c.beginPath(); c.rect(0, 320, CW, 125); c.clip();
    const sy = 432 + (1 - E.outExpo(P(vu, .3, .9))) * 120;
    if (sv) txt(c, sv, 20, sy, FD(900, 112), COL.lime, { ls: -4 });
    else reveal(c, p.txt, 20, 432, 112, FD(900, 112), COL.lime, vu, .3, .06, .6, { ls: -4 });
    c.restore();
    decode(c, p.lab, 24, 468, 13, DIM, vu, .45, { ls: 2, speed: .008 });
    const tp = E.outExpo(P(vu, .45, 1.0));
    txt(c, p.ti, 24 + (1 - tp) * 30, 522, FD(800, 31), COL.ink, { alpha: tp, ls: -.5 });
    p.d.forEach((l, k) => { const dp = E.outExpo(P(vu, .55 + k * .05, 1.1 + k * .05)); txt(c, l, 24 + (1 - dp) * 30, 556 + k * 26, FT(400, 18), DIM, { alpha: dp }); });
    let tx = 24;
    p.tags.forEach((s, k) => { const ap = E.outBack(P(vu, .8 + k * .08, 1.1 + k * .08)); if (ap <= 0) return; c.save(); c.globalAlpha *= ap; tx += pill(c, s, tx, CH - 34, 13, COL.cyan) + 10; c.restore(); });
    c.restore();
  });
  c.restore();
}

/* =========================================================
   SCENE 5 — OUTRO / CONTACT (12.5 → 15)
   ========================================================= */
const CONTACT = [['⌘', 'github.com/hocinee99'], ['@', 'hocine.boukhemza@dauphine.eu'], ['◎', 'Saint-Ouen · Paris']];
function S5(c, t) {
  bg(c, t, [COL.violet, COL.cyan]);
  const u = t - 12.5, cx = 960, cy = 380;
  const zi = lerp(1.25, 1, E.outExpo(P(u, 0, .9)));
  c.save(); c.translate(cx, H / 2); c.scale(zi, zi); c.translate(-cx, -H / 2);
  const fin = Math.max(0, 1 - Math.abs(u - 1.5) / .5) * (u > 1.5 ? 1 : 0) + (u > 1.5 ? Math.exp(-(u - 1.5) * 4) : 0);

  c.globalCompositeOperation = 'lighter'; glow(c, cx, cy, 420, rgba(COL.violet, .25 + .25 * fin)); c.globalCompositeOperation = 'source-over';
  // ring
  const ra = E.inOutExpo(P(u, -.05, .7));
  c.strokeStyle = COL.ink; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 140, -Math.PI / 2, -Math.PI / 2 + TAU * ra); c.stroke();
  // ticks
  for (let i = 0; i < 72; i++) {
    const a = P(u, .1 + i * .006, .2 + i * .006); if (a <= 0) continue;
    const an = i / 72 * TAU + t * .25, big = i % 6 === 0, r0 = big ? 162 : 168, r1 = big ? 192 : 180;
    c.globalAlpha = a * (.5 + .5 * fin + (big ? .3 : 0));
    line(c, cx + Math.cos(an) * r0, cy + Math.sin(an) * r0, cx + Math.cos(an) * r1, cy + Math.sin(an) * r1, big ? COL.lime : COL.ink, big ? 2.5 : 1.2);
  }
  c.globalAlpha = 1;
  // orbiting arcs
  const oa = E.outExpo(P(u, .25, 1.0));
  if (oa > 0) {
    c.lineWidth = 4; c.lineCap = 'round';
    c.strokeStyle = COL.cyan; c.beginPath(); c.arc(cx, cy, 222, t * 1.6, t * 1.6 + 1.4 * oa); c.stroke();
    c.strokeStyle = COL.violet; c.beginPath(); c.arc(cx, cy, 222, -t * 1.2 + 3, -t * 1.2 + 3 + .9 * oa); c.stroke();
    c.strokeStyle = COL.pink; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 240, t * .8 + 1, t * .8 + 1 + .5 * oa); c.stroke();
    c.lineCap = 'butt';
  }
  // final pulse
  if (u > 1.5) { const pp = P(u, 1.5, 2.3); c.globalAlpha = 1 - pp; c.strokeStyle = COL.lime; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 140 + 520 * E.outExpo(pp), 0, TAU); c.stroke(); c.globalAlpha = 1; }
  // monogram
  const g = c.createLinearGradient(cx - 120, cy - 80, cx + 120, cy + 60); g.addColorStop(0, COL.cyan); g.addColorStop(1, COL.violet);
  reveal(c, 'HB', cx, cy + 54, 150, FD(900, 150), g, u, .15, .07, .7, { align: 'center', ls: -6 });

  // name with tracking animation
  const na = E.outExpo(P(u, .3, 1.3)), ls = lerp(46, 3, na);
  const nf = FD(800, 76), nw = measure(c, 'HOCINE BOUKHEMZA', nf, ls);
  txt(c, 'HOCINE BOUKHEMZA', cx - nw / 2 + ls / 2, 680, nf, COL.ink, { ls, alpha: P(u, .3, .75) });
  decode(c, 'RECHERCHE ALTERNANCE — DATA SCIENCE & IA · 2026/2027', cx, 736, 22, COL.cyan, u, .6, { ls: 4, align: 'center', speed: .01 });
  const dl = E.outExpo(P(u, .8, 1.5));
  line(c, cx - 460 * dl, 790, cx + 460 * dl, 790, 'rgba(255,255,255,.25)', 1);
  // contacts
  const fnt = FT(500, 24);
  const ws = CONTACT.map(([, s]) => measure(c, s, fnt) + 56), gap = 60, tot = ws.reduce((a, b) => a + b, 0) + gap * 2;
  let x = cx - tot / 2;
  CONTACT.forEach(([ic, s], i) => {
    const a = E.outExpo(P(u, .95 + i * .1, 1.6 + i * .1)), y = 858 + (1 - a) * 30;
    c.save(); c.globalAlpha = a;
    rrect(c, x, y - 30, 40, 40, 10); c.strokeStyle = i === 0 ? COL.lime : COL.cyan; c.lineWidth = 1.5; c.stroke();
    txt(c, ic, x + 20, y - 2, FM(700, 20), i === 0 ? COL.lime : COL.cyan, { align: 'center' });
    txt(c, s, x + 56, y, fnt, COL.ink);
    c.restore(); x += ws[i] + gap;
  });
  c.restore();
}

/* =========================================================
   TRANSITIONS + COMPOSITOR
   ========================================================= */
function slantPoly(c, x, s = 190) { c.beginPath(); c.moveTo(-60, -60); c.lineTo(x + s, -60); c.lineTo(x - s, H + 60); c.lineTo(-60, H + 60); c.closePath(); }
function speedLines(c, a, seed = 4) {
  if (a <= 0) return; const r = R(seed);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const an = r() * TAU, r0 = 250 + r() * 500, len = 300 + r() * 900 * a;
    c.globalAlpha = a * (.3 + r() * .7);
    line(c, W / 2 + Math.cos(an) * r0, H / 2 + Math.sin(an) * r0, W / 2 + Math.cos(an) * (r0 + len), H / 2 + Math.sin(an) * (r0 + len), i % 3 ? COL.ink : COL.cyan, 1 + r() * 2);
  }
  c.restore();
}

function compose(c, t) {
  if (t < 1.75) { S1(c, t); return; }
  if (t < 2.25) { // slanted panel wipe
    S1(c, t); S2(xb, t);
    const e = (a, b) => lerp(-320, W + 320, E.inOutExpo(P(t, a, b)));
    slantPoly(c, e(1.75, 2.08)); c.fillStyle = COL.cyan; c.fill();
    slantPoly(c, e(1.8, 2.14)); c.fillStyle = COL.violet; c.fill();
    c.save(); slantPoly(c, e(1.86, 2.22)); c.clip(); c.drawImage(BB, 0, 0); c.restore();
    return;
  }
  if (t < 4.72) { S2(c, t); return; }
  if (t < 5.25) { // double circle iris from the last node
    S2(c, t); S3(xb, t);
    const r1 = 2300 * E.inOutExpo(P(t, 4.72, 5.04)), r2 = 2300 * E.inOutExpo(P(t, 4.82, 5.22));
    c.fillStyle = COL.violet; c.beginPath(); c.arc(960, 600, r1, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(960, 600, r2, 0, TAU); c.clip(); c.drawImage(BB, 0, 0); c.restore();
    if (r2 > 0) { c.strokeStyle = COL.lime; c.lineWidth = 8; c.beginPath(); c.arc(960, 600, r2, 0, TAU); c.stroke(); }
    return;
  }
  if (t < 8.8) { S3(c, t); return; }
  if (t < 9.3) { // strip slice
    S4(c, t); S3(xb, t);
    const N = 12, sh = H / N;
    for (let k = 0; k < N; k++) {
      const p = E.inOutExpo(P(t, 8.8 + k * .014, 9.1 + k * .014)), dir = k % 2 ? 1 : -1, off = dir * p * (W + 260);
      const y = k * sh;
      c.drawImage(BB, 0, y, W, sh + 1, off, y, W, sh + 1);
      c.fillStyle = k % 3 === 0 ? COL.lime : k % 3 === 1 ? COL.cyan : COL.violet;
      if (p > 0 && p < 1) c.fillRect(dir > 0 ? off - 120 : off + W, y, 120, sh + 1);
    }
    return;
  }
  if (t < 12.3) { S4(c, t); return; }
  if (t < 12.5) { // zoom through
    S4(xb, t);
    const p = E.inExpo(P(t, 12.3, 12.5)), s = 1 + 3 * p;
    c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 1 - p * .6; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.drawImage(BB, 0, 0); c.restore();
    speedLines(c, p);
    return;
  }
  S5(c, t);
  speedLines(c, 1 - E.outCubic(P(t, 12.5, 12.85)), 6);
}

/* ---------- post: chroma, glitch, grain, vignette, HUD ---------- */
const GRAIN = Array.from({ length: 4 }, (_, k) => {
  const g = mk(512, 512), gc = g.getContext('2d'), id = gc.createImageData(512, 512), r = R(100 + k);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  gc.putImageData(id, 0, 0); return g;
});
const VIG = (() => { const v = mk(), vc = v.getContext('2d'); const g = vc.createRadialGradient(W / 2, H / 2, H * .55, W / 2, H / 2, H * 1.15); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); vc.fillStyle = g; vc.fillRect(0, 0, W, H); return v; })();

function chroma(dst, src, amt) {
  const ch = [[CR, '#f00', -amt, -amt * .25], [CG, '#0f0', 0, 0], [CB, '#00f', amt, amt * .25]];
  dst.fillStyle = '#000'; dst.fillRect(-40, -40, W + 80, H + 80);
  for (const [cv, col, dx, dy] of ch) {
    const k = cv.getContext('2d');
    k.globalCompositeOperation = 'copy'; k.drawImage(src, 0, 0);
    k.globalCompositeOperation = 'multiply'; k.fillStyle = col; k.fillRect(0, 0, W, H);
    dst.globalCompositeOperation = 'lighter'; dst.drawImage(cv, dx, dy);
  }
  dst.globalCompositeOperation = 'source-over';
}
function glitch(c, t, amt) {
  xc.globalCompositeOperation = 'copy'; xc.drawImage(BA, 0, 0); xc.globalCompositeOperation = 'source-over';
  const r = R(Math.floor(t * 60) * 13 + 1);
  for (let i = 0; i < 9; i++) {
    const y = r() * H, h = 8 + r() * 70, dx = (r() - .5) * 160 * amt;
    c.drawImage(BC, 0, y, W, h, dx, y, W, h);
    if (r() < .35) { c.fillStyle = rgba([COL.cyan, COL.pink, COL.lime][i % 3], .5 * amt); c.fillRect(r() * W, y, 60 + r() * 400, 3); }
  }
}

function hud(c, t) {
  const a = E.outCubic(P(t, .6, 1.3)); if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  const m = 40, L = 26, col = 'rgba(255,255,255,.55)';
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x + sx * L, y); c.lineTo(x, y); c.lineTo(x, y + sy * L); c.stroke();
  });
  const sec = t < 2 ? '00 / INTRO' : t < 5 ? '01 / FORMATION' : t < 9 ? '02 / COMPÉTENCES' : t < 12.5 ? '03 / PROJETS' : '04 / CONTACT';
  txt(c, 'HB — CV.MOTION', m + 40, m + 18, FM(500, 13), col, { ls: 3 });
  txt(c, sec, W - m - 40, m + 18, FM(700, 13), COL.lime, { ls: 3, align: 'right' });
  const f = Math.min(DUR * FPS - 1, Math.round(t * FPS)), ss = Math.floor(f / FPS), ff = f % FPS;
  txt(c, `TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, m + 40, H - m - 4, FM(500, 13), col, { ls: 3 });
  if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = COL.pink; c.beginPath(); c.arc(W - m - 56 - measure(c, 'REC · 60FPS', FM(500, 13), 3), H - m - 9, 5, 0, TAU); c.fill(); }
  txt(c, 'REC · 60FPS', W - m - 40, H - m - 4, FM(500, 13), col, { ls: 3, align: 'right' });
  // progress
  const x0 = 360, x1 = W - 360, y = H - m - 8;
  line(c, x0, y, x1, y, 'rgba(255,255,255,.12)', 2);
  line(c, x0, y, lerp(x0, x1, t / DUR), y, COL.cyan, 2);
  [2, 5, 9, 12.5].forEach(s => { const xx = lerp(x0, x1, s / DUR); line(c, xx, y - 5, xx, y + 5, t >= s ? COL.cyan : 'rgba(255,255,255,.3)', 2); });
  c.restore();
}

function render(t) {
  compose(xa, t);
  xa.globalAlpha = 1; xa.globalCompositeOperation = 'source-over';
  // impact envelopes
  let ca = 0, sh = 0, gl = 0;
  for (const [ht, s] of HITS) {
    const dt = t - ht;
    if (dt >= 0) { ca += s * 20 * Math.exp(-dt * 13); sh += s * Math.exp(-dt * 9); if (dt < .14 && s > 1) gl += 1 - dt / .14; }
    else if (dt > -.06) ca += s * 5 * (1 + dt / .06);
  }
  if (gl > 0) glitch(xa, t, gl);
  const r = R(Math.floor(t * 60) + 77);
  const sx = (r() - .5) * 26 * sh, sy = (r() - .5) * 26 * sh, rot = (r() - .5) * .006 * sh;
  X.save();
  X.fillStyle = '#000'; X.fillRect(0, 0, W, H);
  X.translate(W / 2 + sx, H / 2 + sy); X.rotate(rot); X.scale(1 + .012 * sh, 1 + .012 * sh); X.translate(-W / 2, -H / 2);
  if (ca > .6) chroma(X, BA, ca); else X.drawImage(BA, 0, 0);
  X.restore();
  // flashes
  const fl = Math.max((1 - P(t, .5, .8)) ** 3 * (t >= .5 ? .85 : 0), (1 - P(t, 12.5, 12.85)) ** 3 * (t >= 12.5 ? .8 : 0), (1 - P(t, 14, 14.25)) ** 3 * (t >= 14 ? .25 : 0));
  if (fl > 0) { X.fillStyle = `rgba(255,255,255,${fl})`; X.fillRect(0, 0, W, H); }
  X.drawImage(VIG, 0, 0);
  hud(X, t);
  // film grain
  X.save(); X.globalCompositeOperation = 'overlay'; X.globalAlpha = .07;
  const gi = Math.floor(t * 60) % 4, ox = -Math.floor(r() * 512), oy = -Math.floor(r() * 512);
  for (let y = oy; y < H; y += 512) for (let x = ox; x < W; x += 512) X.drawImage(GRAIN[gi], x, y);
  X.restore();
  // fade in from black / fade out
  const fo = Math.max(1 - P(t, 0, .08), P(t, 14.85, 15));
  if (fo > 0) { X.fillStyle = `rgba(0,0,0,${fo})`; X.fillRect(0, 0, W, H); }
}

window.render = render;
window.ready = Promise.all(['900 10px D', '800 10px D', '700 10px D', '400 10px T', '500 10px T', '500 10px M', '700 10px M'].map(f => document.fonts.load(f))).then(() => document.fonts.ready);
window.ready.then(() => {
  render(0);
  if (location.hash === '#play') {
    document.body.className = 'preview';
    const t0 = performance.now();
    const loop = now => { render(((now - t0) / 1000) % DUR); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
});
