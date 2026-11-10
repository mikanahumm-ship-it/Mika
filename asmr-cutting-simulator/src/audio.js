// Procedural ASMR audio. No samples: every sound is synthesised from filtered
// noise grains + short tonal bodies, shaped per material. While the blade is
// inside a material, grains are emitted at a rate driven by blade speed, so the
// sound follows your finger rather than playing a canned clip.

const PROFILES = {
  //        band-pass freq, Q, grain dur, grains/s, gain, extra
  meat:   { f: 650, q: 0.9, d: 0.07, rate: 38, g: 0.5, wet: 1, low: 180 },
  fish:   { f: 900, q: 1.0, d: 0.06, rate: 40, g: 0.45, wet: 0.8, low: 220 },
  soap:   { f: 3800, q: 1.4, d: 0.025, rate: 110, g: 0.32, crisp: 0.4 },
  jelly:  { f: 500, q: 1.2, d: 0.09, rate: 18, g: 0.35, wet: 1.4, bloop: 1 },
  crunch: { f: 2600, q: 0.8, d: 0.014, rate: 34, g: 0.75, crisp: 1, low: 140 },
  crisp:  { f: 3000, q: 0.9, d: 0.012, rate: 40, g: 0.7, crisp: 1.2, wet: 0.3 },
  fruit:  { f: 1400, q: 0.9, d: 0.04, rate: 50, g: 0.45, wet: 0.9 },
  bread:  { f: 2300, q: 0.7, d: 0.03, rate: 70, g: 0.42, crisp: 0.5, saw: 1 },
  cake:   { f: 1500, q: 0.8, d: 0.04, rate: 50, g: 0.3 },
  cheese: { f: 1100, q: 1.1, d: 0.05, rate: 45, g: 0.32 },
  sand:   { f: 6000, q: 0.6, d: 0.018, rate: 240, g: 0.22, crisp: 0.2 },
  clay:   { f: 700, q: 1.3, d: 0.08, rate: 30, g: 0.32, wet: 0.5 },
  slime:  { f: 420, q: 1.4, d: 0.1, rate: 22, g: 0.32, wet: 1.6, bloop: 0.6 },
  foam:   { f: 1800, q: 0.6, d: 0.04, rate: 90, g: 0.22 },
  wax:    { f: 2200, q: 2.2, d: 0.05, rate: 60, g: 0.3 },
  ice:    { f: 5200, q: 2.5, d: 0.01, rate: 30, g: 0.55, crisp: 1.5, ice: 1 },
  choc:   { f: 3200, q: 1.6, d: 0.012, rate: 26, g: 0.6, crisp: 1, snap: 1 },
  soft:   { f: 1500, q: 0.8, d: 0.04, rate: 50, g: 0.3 },
  wood:   { f: 2300, q: 1.7, d: 0.022, rate: 85, g: 0.42, crisp: 0.7, low: 170 },
  glass:  { f: 6800, q: 3.0, d: 0.008, rate: 34, g: 0.5, crisp: 1.6, ice: 1, glass: 1 },
};

export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.volume = 0.9; this.slow = 1;
    this.grainClock = 0;
    this.objPitch = 1;   // set per object: smaller things sound higher
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // pink-ish noise for wet sounds
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const p = this.pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; p[i] = (b0 + b1 + b2) * 2.2; }
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    // soft room
    const conv = ctx.createConvolver(); conv.buffer = this.makeIR(0.9);
    const wet = ctx.createGain(); wet.gain.value = 0.16;
    this.master.connect(comp); this.master.connect(conv); conv.connect(wet); wet.connect(comp);
    comp.connect(ctx.destination);
    // iOS unlock blip
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
  }
  makeIR(sec) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    return b;
  }
  get ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  grain(prof, intensity, t, tool) {
    const ctx = this.ctx, P = PROFILES[prof] || PROFILES.soft, sl = this.slow;
    const src = ctx.createBufferSource();
    src.buffer = P.wet ? this.pink : this.noise;
    src.playbackRate.value = (0.85 + Math.random() * 0.3) * (sl < 1 ? 0.7 : 1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = P.f * (0.75 + Math.random() * 0.5) * (tool.pitch || 1) * this.objPitch * (sl < 1 ? 0.7 : 1);
    bp.Q.value = P.q;
    const g = ctx.createGain();
    const dur = P.d * (0.7 + Math.random() * 0.6) / Math.max(sl, 0.4);
    let amp = P.g * intensity * (0.55 + Math.random() * 0.45);
    if (P.crisp && Math.random() < 0.25 * P.crisp) amp *= 1.8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + Math.min(0.004, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.02);
    if (P.wet && Math.random() < 0.18 * P.wet) this.squelch(t, intensity * P.g, P.bloop);
    if (P.low && Math.random() < 0.12) this.thump(t, P.low, intensity * 0.25);
  }
  squelch(t, amp, bloop) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.pink;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    const f0 = bloop ? 300 : 900;
    lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f0 * (bloop ? 3.5 : 2.2), t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.9, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12 / Math.max(this.slow, 0.4));
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t, Math.random(), 0.2);
  }
  thump(t, f, amp) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.12);
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.18 / Math.max(this.slow, 0.4));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3 / Math.max(this.slow, 0.4));
  }
  // Called every frame while blade is moving through material
  scrape(prof, speed, dt, tool) {
    if (!this.ok || !prof) return;
    const P = PROFILES[prof] || PROFILES.soft;
    const intensity = Math.min(1, 0.25 + speed * 0.9);
    const rate = Math.min(140, P.rate * (0.35 + Math.min(1.6, speed))) * (tool.saw ? (0.6 + 0.4 * Math.sin(performance.now() / 70) ** 2) : 1) * Math.max(this.slow, 0.35);
    this.grainClock += dt * rate;
    const now = this.ctx.currentTime;
    let n = 0;
    this.grainClock = Math.min(this.grainClock, 4);
    while (this.grainClock >= 1 && n < 4) { this.grainClock -= 1; this.grain(prof, intensity, now + Math.random() * dt, tool); n++; }
    if (tool.whistle && Math.random() < dt * 8) this.tone(now, 2400 + speed * 800, 0.04, 0.05);
  }
  tone(t, f, amp, dur) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  // blade reaches board / cut completed
  finish(prof, tool, pieces) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, P = PROFILES[prof] || PROFILES.soft;
    const w = tool.weight || 1;
    // wooden board knock
    this.thump(t, 110 * (tool.knock || 1), 0.35 * w);
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.25 * w, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t, Math.random(), 0.1);
    if (P.snap) for (let i = 0; i < 3; i++) this.grain(prof, 1, t + i * 0.012, tool);
    if (P.ice) { for (let i = 0; i < 6; i++) this.tone(t + i * 0.02 + Math.random() * 0.03, 3000 + Math.random() * 4000, 0.03, 0.08); }
    if (P.bloop) for (let i = 0; i < 3; i++) this.squelch(t + 0.05 + i * 0.09, 0.25 / (i + 1), 1);
    if (pieces > 0 && P.wet) this.squelch(t + 0.02, 0.2, 0);
  }
  // little landing tick when a piece settles / shavings land
  tick(amp = 0.1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.thump(t, 180 + Math.random() * 80, amp);
  }
  // dicing: knife tapping the board + a crisp burst whose size follows the cube count
  chop(prof, cubes) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.thump(t, 150 + Math.random() * 30, 0.12);
    const n = Math.min(6, 1 + Math.floor(cubes / 25));
    for (let i = 0; i < n; i++) this.grain(prof, 0.7, t + i * 0.008 + Math.random() * 0.01, { pitch: 1.1 });
  }
  // something brittle gives way under the finger
  crack(prof) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.thump(t, 95, 0.4);
    if (prof === 'glass' || prof === 'ice') { this.shatter(); if (prof === 'glass') return; }
    for (let i = 0; i < 9; i++) this.grain(prof === 'soap' ? 'soap' : 'choc', 1, t + i * 0.006 + Math.random() * 0.02, { pitch: 0.9 + Math.random() * 0.4 });
    for (let i = 0; i < 5; i++) this.grain('crunch', 0.8, t + 0.03 + i * 0.03 + Math.random() * 0.02, { pitch: 1 });
  }
  // ---- extra layers for variety -------------------------------------------
  noiseBurst(t, f0, f1, q, amp, dur, type = 'bandpass', pink = false) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = pink ? this.pink : this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = type; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  // air whoosh when the blade moves fast above the board
  swish(speed) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, a = Math.min(0.18, 0.05 + speed * 0.04);
    this.noiseBurst(t, 900, 3800 + Math.random() * 1500, 0.8, a, 0.22, 'bandpass');
  }
  // a piece lands on the board: weight sets the pitch/volume
  land(mass, prof) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, P = PROFILES[prof] || PROFILES.soft;
    const m = Math.min(1, mass);
    this.thump(t, 120 + (1 - m) * 160 + Math.random() * 30, 0.08 + m * 0.22);
    this.noiseBurst(t, 2400 + Math.random() * 800, 1200, 1.4, 0.05 + m * 0.08, 0.05);
    if (P.wet) this.squelch(t + 0.01, 0.08 + m * 0.1, 0);
    if (P.glass || P.ice) this.tone(t, 3000 + Math.random() * 3000, 0.02, 0.12);
  }
  // diced cubes pattering onto the board / pile
  pitter(n, prof) {
    if (!this.ok || n <= 0) return;
    const t = this.ctx.currentTime, P = PROFILES[prof] || PROFILES.soft;
    const k = Math.min(6, Math.ceil(n / 6));
    for (let i = 0; i < k; i++) {
      const tt = t + Math.random() * 0.03;
      this.noiseBurst(tt, 2200 + Math.random() * 2200, 1500, 2.5, 0.05 + Math.random() * 0.05, 0.03);
      if (Math.random() < 0.35) this.tone(tt, 700 + Math.random() * 500, 0.025, 0.04);
      if (P.wet && Math.random() < 0.3) this.squelch(tt, 0.05, 0);
    }
  }
  // a wood chip breaking off the gouge
  chip() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 3200 + Math.random() * 1200, 2000, 3, 0.18, 0.025);
    this.tone(t, 520 + Math.random() * 200, 0.05, 0.05);
  }
  // cubes landing / colliding: list = [prof, speed, prof, speed, ...]
  cubeHits(list) {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    if (now - (this._hitT || 0) < 0.012) return;
    this._hitT = now;
    const n = Math.min(7, list.length / 2);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * (list.length / 2)) * 2, prof = list[i], sp = Math.min(5, list[i + 1]);
      const t = now + Math.random() * 0.025, a = Math.min(0.16, 0.025 + sp * 0.022);
      const P = PROFILES[prof] || PROFILES.soft;
      if (P.glass || P.ice) { this.tone(t, 2600 + Math.random() * 4200, a * 0.6, 0.06 + Math.random() * 0.08); this.noiseBurst(t, 7000, 4000, 2, a * 0.5, 0.02); }
      else if (P.wet || prof === 'jelly' || prof === 'slime') { this.squelch(t, a * 0.9, P.bloop); this.noiseBurst(t, 900, 500, 1.5, a * 0.5, 0.03, 'bandpass', true); }
      else if (prof === 'sand') this.noiseBurst(t, 5500, 3000, 0.7, a * 0.7, 0.05);
      else if (prof === 'soap' || prof === 'wax') { this.noiseBurst(t, 1800 + Math.random() * 600, 1200, 2, a, 0.035); this.thump(t, 260 + Math.random() * 90, a * 0.5); }
      else if (P.crisp || prof === 'choc') { this.noiseBurst(t, 3200 + Math.random() * 1500, 2000, 2.5, a, 0.02); this.tone(t, 900 + Math.random() * 600, a * 0.25, 0.035); }
      else { this.noiseBurst(t, 2000 + Math.random() * 1600, 1300, 2.2, a, 0.03); this.thump(t, 200 + Math.random() * 120, a * 0.6); }
    }
  }
  // continuous wet/crumbly squish while pressing
  squishStart(prof) {
    if (!this.ok) return;
    this.squishStop();
    const ctx = this.ctx, P = PROFILES[prof] || PROFILES.soft;
    const src = ctx.createBufferSource(); src.buffer = P.wet || prof === 'clay' || prof === 'jelly' ? this.pink : this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.value = P.f * 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    this.sq = { src, bp, g, P, prof, base: P.f * 0.6 };
  }
  squishSet(rate, depth) {
    const q = this.sq; if (!q || !this.ok) return;
    const t = this.ctx.currentTime;
    q.g.gain.setTargetAtTime(Math.min(0.5, rate * 2.2) * (q.P.g + 0.15), t, 0.03);
    q.bp.frequency.setTargetAtTime(q.base * (0.7 + depth * 1.6) * (0.9 + Math.random() * 0.2), t, 0.05);
    if (q.P.wet && Math.random() < rate * 0.6) this.squelch(t, 0.12 * Math.min(1, rate * 3), q.P.bloop);
    if ((q.P.crisp || q.prof === 'sand' || q.prof === 'foam') && Math.random() < rate * 0.8) this.grain(q.prof, 0.6, t, { pitch: 0.9 });
  }
  squishStop() {
    const q = this.sq; if (!q) return; this.sq = null;
    try { q.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04); q.src.stop(this.ctx.currentTime + 0.3); } catch { /* ignore */ }
  }
  // big squash: wet splat or crumbly burst
  splat(prof) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, P = PROFILES[prof] || PROFILES.soft;
    this.thump(t, 70, 0.5);
    if (P.wet || prof === 'clay' || prof === 'slime' || prof === 'jelly' || prof === 'fruit') {
      this.noiseBurst(t, 1800, 180, 2, 0.5, 0.35, 'lowpass', true);
      for (let i = 0; i < 6; i++) this.squelch(t + 0.03 + i * 0.05 + Math.random() * 0.03, 0.22 / (1 + i * 0.4), 1);
    } else {
      this.noiseBurst(t, 5000, 900, 0.7, 0.35, 0.4, 'bandpass');
      for (let i = 0; i < 10; i++) this.grain(prof, 0.9, t + i * 0.015 + Math.random() * 0.02, { pitch: 1 });
    }
  }
  // glass breaking: a bright crash and a shower of tinkles
  shatter() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 9000, 3000, 0.6, 0.45, 0.25, 'highpass');
    this.thump(t, 140, 0.25);
    for (let i = 0; i < 22; i++) this.tone(t + 0.02 + Math.random() * 0.6 * Math.random(), 2500 + Math.random() * 6500, 0.03 + Math.random() * 0.03, 0.08 + Math.random() * 0.25);
  }
  ui() { if (this.ok) this.tone(this.ctx.currentTime, 1400, 0.025, 0.05); }
}
