"""Synthesised 15 s soundtrack, 120 BPM, locked to the cuts in anim.js.
Writes out/audio.wav (48 kHz, 16-bit stereo). numpy only."""
import os, wave
import numpy as np

SR, D = 48000, 15.0
N = int(SR * D)
mix = np.zeros((N, 2))
rv_send = np.zeros((N, 2))
rng = np.random.default_rng(7)
HITS = [0.5, 2.0, 5.0, 9.0, 12.5, 14.0]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def place(buf, sig, t0, gain=1.0, pan=0.0, send=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * np.sqrt(2)
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n] * gain
    if send:
        rv_send[i:i + n] += sig[:n] * gain * send


def add(sig, t0, gain=1.0, pan=0.0, send=0.0):
    place(mix, sig, t0, gain, pan, send)


def fft_filter(x, lo=None, hi=None, order=2):
    """Butterworth-shaped magnitude response applied in the frequency domain."""
    n = len(x)
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-9
    g = np.ones_like(f)
    if hi:
        g /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g /= np.sqrt(1 + (lo / f) ** (2 * order))
    if x.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n, axis=0)


def sweep_lp(x, f0, f1, curve=2.0):
    """One-pole low-pass with exponentially sweeping cutoff (short signals only)."""
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.linspace(0, 1, n) ** curve)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty(n); s = 0.0
    for i in range(n):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def saw(freq, dur, detune=0.0, phase=0.0):
    t = tt(dur)
    ph = (freq * (1 + detune) * t + phase) % 1.0
    return 2 * ph - 1


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.1):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na + nd] = np.linspace(1, s, nd)
    nr = min(nr, n); e[n - nr:] *= np.linspace(1, 0, nr)
    return e


NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------- drums ----------
def kick(big=False):
    t = tt(1.2 if big else 0.45)
    f = (42 if big else 48) + ((210 if big else 170) - (42 if big else 48)) * np.exp(-t * (22 if big else 32))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (3.2 if big else 7.5))
    click = rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.35
    return np.tanh((body + click) * (1.6 if big else 1.3))


def clap():
    t = tt(0.35)
    env = np.zeros(len(t))
    for k, d in enumerate([0, .011, .022, .031]):
        i = int(d * SR); env[i:] += np.exp(-(t[:len(t) - i]) * (90 if k < 3 else 16))
    return fft_filter(rng.standard_normal(len(t)), 900, 4200) * env * 0.9


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    return fft_filter(rng.standard_normal(len(t)), 7000, None) * np.exp(-t * (14 if open_ else 70))


def crash(dur=2.4):
    t = tt(dur)
    n = np.stack([rng.standard_normal(len(t)), rng.standard_normal(len(t))], 1)
    return fft_filter(n, 4500, 14000) * (np.exp(-t * 2.2) ** 1)[:, None] * 0.55


def boom(dur=1.6):
    t = tt(dur)
    n = fft_filter(rng.standard_normal(len(t)), None, 220, 3)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 50 * np.exp(-t * 6)) / SR)
    return (n * 2.5 + sub) * np.exp(-t * 2.4)


def riser(dur, f0=300, f1=9000):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    y = sweep_lp(n, f0, f1, 1.6) * (t / dur) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(NOTE(57) * 2 ** (2 * (t / dur) ** 2)) / SR) * (t / dur) ** 3 * 0.25
    return y * 1.4 + tone


def whoosh(dur=0.32):
    t = tt(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2 * (t / dur) ** .6
    l = sweep_lp(rng.standard_normal(len(t)), 400, 11000, 1.2) * env
    r = sweep_lp(rng.standard_normal(len(t)), 400, 11000, 1.2) * env
    pan = np.linspace(-1, 1, len(t))
    return np.stack([l * (1 - pan) / 2 * 2, r * (1 + pan) / 2 * 2], 1) * 1.3


def blip(freq, dur=0.12, kind='sine'):
    t = tt(dur)
    if kind == 'sine':
        s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    else:
        s = np.sign(np.sin(2 * np.pi * freq * t)) * 0.5
    return s * np.exp(-t * 38)


def tick():
    t = tt(0.012)
    return rng.standard_normal(len(t)) * np.exp(-t * 600) * 0.4


# ---------- harmony ----------
CHORDS = [(0.0, [57, 60, 64, 71]), (2.0, [57, 60, 64, 67]), (4.0, [53, 57, 60, 64]), (6.0, [48, 55, 60, 64]),
          (8.0, [55, 59, 62, 67]), (10.0, [57, 60, 64, 67]), (12.0, [53, 57, 60, 64]), (14.0, [57, 60, 64, 71])]
BASS = {0: 33, 2: 33, 4: 29, 6: 36, 8: 31, 10: 33, 12: 29, 14: 33}


def chord_at(t):
    c = CHORDS[0][1]
    for s, n in CHORDS:
        if t >= s: c = n
    return c


def bass_at(t):
    k = max(b for b in BASS if b <= t)
    return BASS[k]


# sidechain envelope from the kick grid
kick_times = [h for h in HITS] + [2.0 + .5 * i for i in range(24) if 2.0 + .5 * i not in HITS and 2.0 + .5 * i < 12.5] + [13.0, 13.5]
kick_times = sorted(set(round(k, 3) for k in kick_times))
T = np.arange(N) / SR
duck = np.ones(N)
for k in kick_times:
    i = int(k * SR)
    d = np.arange(N - i) / SR
    duck[i:] = np.minimum(duck[i:], 1 - 0.72 * np.exp(-d / 0.11))

# pad
pad = np.zeros((N, 2))
for idx, (s, notes) in enumerate(CHORDS):
    e = CHORDS[idx + 1][0] if idx + 1 < len(CHORDS) else D
    s0 = max(s, 0.45); dur = e - s0 + 0.25
    if dur <= 0: continue
    n = int(dur * SR)
    env = adsr(n, 0.25 if idx == 0 else 0.04, 0.3, 0.8, 0.25)
    for m in notes:
        for j, dt in enumerate([-0.006, 0.0, 0.007]):
            v = saw(NOTE(m), dur, dt, phase=rng.random()) * env * 0.05
            pan = [-.7, 0, .7][j]
            place(pad, v, s0, 1.0, pan)
pad = fft_filter(pad, 120, 2600, 2)
pad *= (0.45 + 0.55 * duck)[:, None]
mix += pad * 0.9
rv_send += pad * 0.5

# bass: 8th notes 2.0 → 14.0 (half-time feel after 12.5)
for i in range(24):
    t0 = 2.0 + i * 0.5
    for off in (0.0, 0.25):
        tb = t0 + off
        if tb >= 14.0: continue
        if tb >= 12.5 and off: continue
        m = bass_at(tb) + (12 if (i % 4 == 3 and off) else 0)
        dur = 0.22
        n = int(dur * SR); tb_ = tt(dur)
        v = (saw(NOTE(m), dur) * .6 + np.sin(2 * np.pi * NOTE(m) * tb_)) * adsr(n, .003, .08, .6, .05)
        v = sweep_lp(v, 2200, 260, 0.6)
        add(v * 0.55, tb)
# bass gets ducked too
# (applied by re-ducking the low band at the end via a simple sidechain on the whole mix's low end)

# arp: 16ths 5.0 → 12.5, chord tones up two octaves, with ping-pong delay
arp = np.zeros((N, 2))
pat = [0, 1, 2, 3, 2, 1, 3, 2]
for i in range(int((12.5 - 5.0) / 0.125)):
    ta = 5.0 + i * 0.125
    notes = chord_at(ta)
    m = notes[pat[i % 8] % len(notes)] + 12 + (12 if (i // 8) % 2 else 0)
    dur = 0.18; n = int(dur * SR)
    v = (saw(NOTE(m), dur) * 0.5 + np.sin(2 * np.pi * NOTE(m) * tt(dur))) * np.exp(-tt(dur) * 22)
    v = fft_filter(v, None, 3800, 1)
    vel = 0.5 + 0.5 * (i % 4 == 0)
    place(arp, v * 0.11 * vel, ta, 1.0, (-.35, .35)[i % 2])
dly = np.zeros_like(arp); dl = int(0.375 * SR)
for k, g in enumerate([0.45, 0.25, 0.12]):
    sh = dl * (k + 1)
    src = arp[:-sh] if sh < N else arp[:0]
    if k % 2 == 0: dly[sh:, 0] += src[:, 1] * g; dly[sh:, 1] += src[:, 0] * g
    else: dly[sh:] += src * g
arp_all = (arp + dly) * (0.5 + 0.5 * duck)[:, None]
mix += arp_all
rv_send += arp_all * 0.4

# drums
for k in kick_times:
    big = k in (0.5, 12.5, 14.0)
    add(kick(big), k, 0.95 if big else 0.8)
for i in range(24):
    tb = 2.0 + i * 0.5
    if tb >= 12.5: break
    if i % 2 == 1: add(clap(), tb, 0.55, 0.05, send=0.35)
    add(hat(), tb + 0.25, 0.32, 0.3)
    if i % 4 == 3: add(hat(True), tb + 0.25, 0.18, -0.3)
    for s16 in (0.125, 0.375):
        add(hat(), tb + s16, 0.12, -0.25)
add(clap(), 13.25, 0.5, send=0.5)
add(clap(), 13.75, 0.35, send=0.5)
# ticking 16ths in the intro (anticipation)
for i in range(12):
    add(hat(), 0.5 + 0.125 * i + 0.75, 0.09 + 0.012 * i, 0.4 * (-1) ** i)

# impacts & transitions
add(riser(0.5, 200, 12000), 0.0, 0.45, send=0.2)
for h in HITS:
    big = h in (0.5, 12.5, 14.0)
    add(boom(1.8 if big else 1.0), h, 0.9 if big else 0.55)
    add(crash(2.6 if big else 1.6), h, 0.7 if big else 0.4, send=0.4)
for w0 in (1.7, 4.7, 8.72):
    add(whoosh(0.32), w0, 0.55, send=0.3)
add(riser(0.22, 800, 14000), 12.28, 0.55)
add(whoosh(0.24), 12.27, 0.5)
# reverse swell into the final hit
sw = riser(0.6, 300, 6000); add(sw, 13.4, 0.35, send=0.4)

# UI blips (scale tones), synced to on-screen events
PENTA = [69, 72, 74, 76, 79, 81, 84]
for i, tn in enumerate([2.4, 2.85, 3.3, 3.75, 4.2]):           # timeline nodes
    add(blip(NOTE(PENTA[i] + 12)), tn, 0.22, (-.6 + .3 * i), send=0.4)
for i, tn in enumerate([6.0, 6.5, 7.0]):                         # k-means iterations
    add(blip(NOTE(76 + 12), 0.08, 'sq'), tn, 0.12, 0.4, send=0.3)
for i, tn in enumerate([9.12, 9.22, 9.32, 9.42]):                # cards in
    add(whoosh(0.18), tn - 0.05, 0.12)
    add(blip(NOTE(PENTA[i + 1] + 12), 0.1), tn + 0.05, 0.16, (-.6 + .4 * i), send=0.4)
for i, tn in enumerate([10.5, 11.0, 11.5, 12.0]):                # card highlights
    add(blip(NOTE(PENTA[i + 2] + 24), 0.09), tn, 0.12, (-.6 + .4 * i), send=0.5)
for i, tn in enumerate([7.0, 7.5, 8.0, 8.5]):                    # skill highlights
    add(blip(NOTE(PENTA[i] + 12), 0.07, 'sq'), tn + .2, 0.07, .2, send=0.3)
for i in range(40):                                               # decode clicks
    add(tick(), 1.0 + i * 0.016, 0.5, rng.uniform(-.5, .5))
for i in range(16):
    add(tick(), 13.1 + i * 0.022, 0.35, rng.uniform(-.5, .5))

# final chord bloom after the last hit
for m in [45, 57, 64, 67, 71, 76]:
    dur = 1.1
    v = np.sin(2 * np.pi * NOTE(m) * tt(dur)) * adsr(int(dur * SR), 0.01, 0.4, 0.5, 0.6) * 0.09
    add(v, 14.0, 1.0, rng.uniform(-.5, .5), send=0.9)

# ---------- reverb (FFT convolution) ----------
L = int(2.4 * SR)
ti = np.arange(L) / SR
ir = np.stack([rng.standard_normal(L), rng.standard_normal(L)], 1) * np.exp(-ti * 2.6)[:, None]
ir = fft_filter(ir, 200, 7000)
ir /= np.sqrt((ir ** 2).sum(0))
nfft = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(rv_send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in (0, 1)], 1)
mix += wet * 0.33

# low-end sidechain on the whole mix so kick punches through bass
low = fft_filter(mix, None, 160, 2)
mix = mix - low + low * (0.35 + 0.65 * duck)[:, None]
for k in kick_times:
    big = k in (0.5, 12.5, 14.0)
    add(kick(big) * 0.35, k)

# ---------- master ----------
mix = fft_filter(mix, 28, None, 2)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.8) / np.tanh(1.8)
fade = np.ones(N); nf = int(0.35 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 2
fin = int(0.02 * SR); fade[:fin] = np.linspace(0, 1, fin)
mix *= fade[:, None]
mix *= 0.8 / np.max(np.abs(mix))

os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
with wave.open(os.path.join(os.path.dirname(__file__), 'out', 'audio.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', mix.shape, float(np.sqrt((mix ** 2).mean())))
