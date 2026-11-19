'use strict';
/* ============================================================
   GAME: save, sound, player, input, camera, HUD, missions, loop
   ============================================================ */
const SAVE_KEY = 'tlv-inspector-v1';
const DEFAULT_SAVE = () => ({ v: 1, gender: 'f', vehicle: 'scooter', owned: { scooter: true, ebike: false }, plate: false, up: { speed: 0, battery: 0, brakes: 0 }, money: 300, score: 0,
  stats: { fines: 0, warnings: 0, paid: 0, deliveries: 0, escapes: 0, earned: 0 }, ach: {}, mem: {}, sound: true, started: false });
let SAVE = DEFAULT_SAVE();
function loadGame() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.v === 1) SAVE = Object.assign(DEFAULT_SAVE(), s); } catch (e) { } }
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }

const VEH = {
  scooter: { name: 'קורקינט חשמלי', max: 9.2, boost: 13.5, acc: 6.5, turn: 2.7, price: 0 },
  ebike: { name: 'אופניים חשמליים', max: 10.4, boost: 15, acc: 6, turn: 2.3, price: 450 },
};
const UPG = {
  speed: { name: 'מנוע חזק יותר', desc: '+3 קמ״ש למהירות ולטורבו', prices: [120, 220, 360] },
  battery: { name: 'סוללה גדולה', desc: '+3 שניות טורבו', prices: [100, 180, 300] },
  brakes: { name: 'בלמים ואחיזה', desc: 'עצירה מהירה ופניות חדות', prices: [80, 160] },
};
const ACH = {
  firstFine: ['🧾', 'דוח ראשון', 'ברוכים הבאים לתל אביב'],
  talker: ['🗣️', 'דיבור זה כישרון', 'יצאת עם אזהרה בלבד'],
  escape: ['💨', 'בורח{{|ת}} מקצועי{{|ת}}', 'נעלמת לפקח מהעיניים'],
  sheriff: ['🤠', 'השריף של דיזנגוף', 'אמרת את זה. בקול.'],
  elephant: ['🐘', 'זיכרון של פיל', 'הפקח תפס אותך בסתירה'],
  courier: ['📦', 'שליח{{|ה}} מצטיין{{|ת}}', '5 משלוחים'],
  f1: ['🏎️', 'פורמולה 1', 'הגעת ל־45 קמ״ש'],
  ghost: ['👻', 'רוח רפאים', 'המשטרה איבדה אותך'],
  silent: ['🤐', 'זכות השתיקה', 'שוחררת מחוסר ראיות'],
  acquit: ['⚖️', 'זכאי{{|ת}}!', 'יצאת זכאי{{|ת}} בבית המשפט'],
  jail: ['🔒', 'בוגר{{|ת}} מעשיהו', 'ישבת בכלא (במשחק!)'],
  legal: ['🪪', 'אזרח{{|ית}} שומר{{|ת}} חוק', 'קנית לוחית זיהוי'],
  red: ['🚦', 'אדום זה רק המלצה', 'עברת באדום (במשחק בלבד!)'],
};

/* ---------------- sound (WebAudio, synthesized) ---------------- */
const SFX = (() => {
  let ac = null, motor = null, motorGain = null, master = null, sirenGain = null;
  const ok = () => ac && SAVE.sound;
  function init() {
    if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    { const so = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(); so.type = 'square'; so.frequency.value = 760; lfo.type = 'triangle'; lfo.frequency.value = 0.55; lg.gain.value = 180; lfo.connect(lg); lg.connect(so.frequency); const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800; sirenGain = ac.createGain(); sirenGain.gain.value = 0; so.connect(sf); sf.connect(sirenGain); sirenGain.connect(master); so.start(); lfo.start(); }
    motor = ac.createOscillator(); motor.type = 'sawtooth'; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    motorGain = ac.createGain(); motorGain.gain.value = 0; motor.connect(f); f.connect(motorGain); motorGain.connect(master); motor.start();
  }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!ok()) return; const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol) {
    if (!ok()) return; const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(master); s.start();
  }
  return {
    init, resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    motor(speed, on) { if (!ac) return; motor.frequency.setTargetAtTime(55 + speed * 16, ac.currentTime, 0.1); motorGain.gain.setTargetAtTime(SAVE.sound && on ? 0.05 + Math.min(speed, 10) * 0.006 : 0, ac.currentTime, 0.15); },
    whistle() { tone('sine', 2600, 2900, 0.18, 0.18); tone('sine', 2700, 3000, 0.35, 0.18, 0.22); },
    honk(pos) { if (pos && pos.distanceTo(PLAYER.pos) > 35) return; tone('square', 392, 0, 0.35, 0.06); tone('square', 494, 0, 0.35, 0.05); },
    bump() { noise(0.18, 0.4); tone('sine', 120, 50, 0.2, 0.3); },
    click() { tone('triangle', 900, 600, 0.06, 0.12); },
    blip(p) { tone('square', 440 * (p || 1), 520 * (p || 1), 0.05, 0.04); tone('square', 380 * (p || 1), 0, 0.05, 0.03, 0.07); },
    stamp() { noise(0.12, 0.6); tone('sine', 90, 40, 0.25, 0.4); },
    yay() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.12, i * 0.09)); },
    coin() { tone('square', 988, 0, 0.08, 0.08); tone('square', 1318, 0, 0.2, 0.08, 0.08); },
    alarm() { tone('sawtooth', 300, 600, 0.25, 0.06); },
    siren(v) { if (!ac) return; sirenGain.gain.setTargetAtTime(SAVE.sound ? v * 0.07 : 0, ac.currentTime, 0.2); },
  };
})();

/* ---------------- speech bubbles ---------------- */
const BUBBLES = [];
const _bv = new THREE.Vector3();
function say(obj, text, dur, cls, yOff) {
  if (!obj || !text) return;
  if (BUBBLES.length > 7) { const b = BUBBLES.shift(); b.el.remove(); }
  const el = document.createElement('div'); el.className = 'bubble ' + (cls || ''); el.textContent = text;
  $('#bubbles').appendChild(el);
  BUBBLES.push({ el, obj, t: dur || 2.5, y: yOff == null ? 0.45 : yOff });
}
function updateBubbles(dt) {
  const w = innerWidth, h = innerHeight;
  for (let i = BUBBLES.length - 1; i >= 0; i--) {
    const b = BUBBLES[i]; b.t -= dt;
    if (b.t <= 0) { b.el.remove(); BUBBLES.splice(i, 1); continue; }
    b.obj.getWorldPosition(_bv); _bv.y += b.y;
    const far = _bv.distanceTo(camera.position) > 55;
    _bv.project(camera);
    if (_bv.z > 1 || far) { b.el.style.display = 'none'; continue; }
    b.el.style.display = '';
    if (!b.bw) b.bw = b.el.offsetWidth;
    const sx = clamp((_bv.x * 0.5 + 0.5) * w, b.bw / 2 + 6, w - b.bw / 2 - 6), sy = Math.max(44, (-_bv.y * 0.5 + 0.5) * h);
    b.el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
    b.el.style.opacity = Math.min(1, b.t * 3);
  }
}

/* ---------------- player ---------------- */
const PLAYER = {
  pos: new THREE.Vector3(7.25, 0, 30), heading: Math.PI, speed: 0, steer: 0, battery: 1, active: false, crashed: 0, lean: 0,
  input: { x: 0, y: 0, boost: false, brake: false }, viol: { sidewalk: false, zone: false, plate: true, redT: 0, dangerT: 0 },
  inBox: null, root: null, tilt: null, veh: null, rider: null, chaseTopSpeed: 0, dangerCd: 0, edgeCd: 0,
};
function buildPlayerModel() {
  if (PLAYER.root) scene.remove(PLAYER.root);
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt); scene.add(root);
  const accent = SAVE.vehicle === 'ebike' ? 0xe2463b : 0x2b58c9;
  const veh = SAVE.vehicle === 'ebike' ? makeEbike(accent) : makeScooter(accent);
  tilt.add(veh.g);
  const f = SAVE.gender === 'f';
  const rider = makePerson({ female: f, skin: 0xd8a27c, shirt: f ? 0xf3c341 : 0xf3c341, pants: 0xf3f1ec, hair: 0x2a1d16, shoes: 0x1b1b1b, chain: !f, sleeves: 'short' });
  // helmet (be safe, kids)
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), MAT(0x1b1d2a)); helm.position.y = 0.03; helm.castShadow = true; rider.head.add(helm);
  const visor = bx(rider.head, 0.26, 0.05, 0.08, 0, 0.0, 0.16, 0xf3c341, { metalness: 0.4, roughness: 0.3 }); visor.rotation.x = 0.3;
  // delivery bag
  PLAYER.bag = bx(rider.chest, 0.46, 0.46, 0.32, 0, -0.05, -0.32, 0x1f9b6b); PLAYER.bag.visible = false;
  rider.root.position.set(0, veh.riderY, veh.riderZ); tilt.add(rider.root);
  veh.plate.visible = SAVE.plate;
  Object.assign(PLAYER, { root, tilt, veh, rider });
  root.position.copy(PLAYER.pos); root.rotation.y = PLAYER.heading;
  resetPose(rider);
}
function stats() {
  const v = VEH[SAVE.vehicle], u = SAVE.up;
  return { max: v.max + u.speed * 0.8, boost: v.boost + u.speed * 0.9, acc: v.acc + u.speed * 0.5, turn: v.turn + u.brakes * 0.2, brake: 9 + u.brakes * 4, boostDur: 6 + u.battery * 3 };
}

function updatePlayer(dt, t) {
  const P = PLAYER, S = stats(), I = P.input;
  const surf = surfaceAt(P.pos.x, P.pos.z);
  let throttle = I.y, steerIn = -I.x;
  if (GAME.mode !== 'play') { throttle = 0; steerIn = 0; }
  if (P.crashed > 0) { P.crashed -= dt; throttle = 0; steerIn = 0; P.speed *= Math.pow(0.02, dt); }
  P.steer += clamp(steerIn - P.steer, -dt * 7, dt * 7);
  let max = S.max, boosting = false;
  if (I.boost && throttle > 0 && P.battery > 0.01 && P.crashed <= 0) { max = S.boost; boosting = true; P.battery = Math.max(0, P.battery - dt / S.boostDur); }
  else P.battery = Math.min(1, P.battery + dt / (S.boostDur * 2.2));
  if (surf === 'sand') max = Math.min(max, 3.2);
  if (I.brake && GAME.mode === 'play') P.speed -= Math.sign(P.speed) * Math.min(Math.abs(P.speed), S.brake * dt);
  else if (throttle > 0) { if (P.speed < max) P.speed = Math.min(max, P.speed + S.acc * throttle * dt * (P.speed < 0 ? 3 : 1)); else P.speed = Math.max(max, P.speed - 3 * dt); }
  else if (throttle < 0) { if (P.speed > 0) P.speed = Math.max(0, P.speed - S.brake * 0.7 * dt); else P.speed = Math.max(-1.6, P.speed - 2 * dt); }
  else P.speed -= Math.sign(P.speed) * Math.min(Math.abs(P.speed), 0.9 * dt);
  const sp = Math.abs(P.speed);
  const turnK = (0.4 + 0.6 * clamp(sp / 2.5, 0, 1)) * (1 - 0.35 * clamp((sp - 8) / 6, 0, 1));
  P.heading += P.steer * S.turn * turnK * dt * (P.speed < 0 ? -1 : 1);
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  const ox = P.pos.x, oz = P.pos.z;
  P.pos.x += fx * P.speed * dt; P.pos.z += fz * P.speed * dt;
  const hit = collideStatic(P.pos, 0.42);
  if (hit) {
    if (sp > 7 && P.crashed <= 0) { crash('בום!'); P.speed *= -0.2; }
    else P.speed *= Math.pow(0.15, dt);
  }
  // cars
  for (const c of TRAFFIC.cars) {
    const [x0, z0, x1, z1] = c.aabb(), r = 0.45;
    if (P.pos.x > x0 - r && P.pos.x < x1 + r && P.pos.z > z0 - r && P.pos.z < z1 + r) {
      const pl = P.pos.x - (x0 - r), pr = (x1 + r) - P.pos.x, pt = P.pos.z - (z0 - r), pb = (z1 + r) - P.pos.z, m = Math.min(pl, pr, pt, pb);
      if (m === pl) P.pos.x = x0 - r; else if (m === pr) P.pos.x = x1 + r; else if (m === pt) P.pos.z = z0 - r; else P.pos.z = z1 + r;
      if ((c.v > 2.5 || sp > 4.5) && P.crashed <= 0) { crash(pick(['אאוץ׳!', 'וואי!', 'אמא\'לה!'])); say(c.mesh, pick(LINES.honk), 2, 'honk', 2.4); SFX.honk(c.mesh.position); }
    }
  }
  // pedestrians
  for (const p of TRAFFIC.peds) {
    const dx = p.root.position.x - P.pos.x, dz = p.root.position.z - P.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.75 * 0.75 && p.root.visible && p.state !== 'fallen' && p.state !== 'fly') {
      if (sp > 2.4) { if (p.hit({ x: fx, z: fz }, sp)) onRunOver(p, sp); P.viol.dangerT = 0.35; P.speed *= sp > 6 ? 0.8 : 0.45; SFX.bump(); GAME.shake = 0.3; }
      else { const d = Math.sqrt(d2) || 1; P.pos.x -= dx / d * (0.7 - d); P.pos.z -= dz / d * (0.7 - d); P.speed *= 0.8; }
    }
  }
  for (const ins of INSPECTORS) {
    if (ins.state === 'talk' || ins.knock > 0) continue;
    const dx = ins.pos.x - P.pos.x, dz = ins.pos.z - P.pos.z;
    if (dx * dx + dz * dz < 0.95 && sp > 5 && GAME.mode === 'play') { ins.knockDown(); POLICE.crimes.assault++; P.speed *= 0.5; SFX.bump(); GAME.shake = 0.4; }
  }
  for (const r of TRAFFIC.riders) { const dx = r.root.position.x - P.pos.x, dz = r.root.position.z - P.pos.z; if (dx * dx + dz * dz < 0.8) { const d = Math.hypot(dx, dz) || 1; P.pos.x -= dx / d * 0.3; P.pos.z -= dz / d * 0.3; P.speed *= 0.7; } }
  // map limits
  const cx = clamp(P.pos.x, MAPB.xMin, MAPB.xMax), cz = clamp(P.pos.z, MAPB.zMin, MAPB.zMax);
  if (cx !== P.pos.x || cz !== P.pos.z) { P.pos.x = cx; P.pos.z = cz; P.speed *= 0.5; P.edgeCd -= dt; if (P.edgeCd < 0) { P.edgeCd = 4; GAME.flash(P.pos.x <= MAPB.xMin ? 'מכאן זה כבר ים 🌊' : 'פה נגמרת המפה (בינתיים)'); } }
  const ty = SURF_H[surfaceAt(P.pos.x, P.pos.z)] || 0;
  P.pos.y += (ty - P.pos.y) * Math.min(1, dt * 14);
  P.speedReal = Math.hypot(P.pos.x - ox, P.pos.z - oz) / Math.max(dt, 1e-4);

  // ---- violations ----
  const V = P.viol, s2 = surfaceAt(P.pos.x, P.pos.z);
  V.sidewalk = s2 === 'sidewalk' && sp > 1.5;
  V.zone = s2 === 'plaza' && sp > 1;
  V.plate = !SAVE.plate;
  V.redT = Math.max(0, V.redT - dt); V.dangerT = Math.max(0, V.dangerT - dt); V.hitT = Math.max(0, (V.hitT || 0) - dt); P.dangerCd -= dt;
  if (sp > 11 && P.dangerCd <= 0) for (const p of TRAFFIC.peds) if (p.root.position.distanceToSquared(P.pos) < 25) { V.dangerT = 0.35; P.dangerCd = 2; break; }
  let box = null;
  for (const I2 of WORLD.intersections) if (P.pos.x > I2.x0 && P.pos.x < I2.x1 && P.pos.z > I2.z0 && P.pos.z < I2.z1) { box = I2; break; }
  if (box && box !== P.inBox && sp > 1.5 && GAME.mode === 'play') {
    const axis = Math.abs(fz) > Math.abs(fx) ? 'ns' : 'ew';
    if (lightState(box, axis) === 'red') { V.redT = 0.35; GAME.flash('🚦 עברת באדום!'); GAME.achieve('red'); }
  }
  P.inBox = box;
  if (GAME.chasing) P.chaseTopSpeed = Math.max(P.chaseTopSpeed, sp);
  if (sp * 3.6 >= 45) GAME.achieve('f1');

  // ---- visuals ----
  P.root.position.copy(P.pos); P.root.rotation.y = P.heading;
  P.lean += (-P.steer * clamp(sp / 7, 0, 1) * 0.32 - P.lean) * Math.min(1, dt * 6);
  P.tilt.rotation.z = P.crashed > 0 ? Math.min(1.3, (1.2 - P.crashed) * 4) : P.lean;
  P.tilt.rotation.x = P.crashed > 0 ? 0 : clamp((throttle > 0 ? -0.03 : 0) + (I.brake ? 0.04 : 0), -0.05, 0.05);
  for (const w of P.veh.wheels) w.rotation.x += P.speed * dt / P.veh.wheelR;
  P.cad = (P.cad || 0) + P.speed * dt * 2.2;
  if (P.veh.pose === 'bike') poseBike(P.rider, t, P.cad, sp, boosting); else poseScooter(P.rider, P.lean, t, sp, boosting);
  if (sp < 0.3 && GAME.mode === 'play' && P.veh.pose === 'scooter') { P.rider.legR.rotation.x = 0.1; P.rider.kneeR.rotation.x = 0.05; P.rider.legR.rotation.z = 0.25; }
  else P.rider.legR.rotation.z = 0;
  if (GAME.mode === 'dialogue') { P.rider.head.rotation.y = 0.6; if (D) { P.rider.armL.rotation.x = -0.6 - Math.abs(Math.sin(t * 3)) * 0.4; P.rider.elbowL.rotation.x = -1.1; } }
  P.boosting = boosting;
  SFX.motor(sp, GAME.mode === 'play' && P.active);
}
function onRunOver(p, sp) {
  const P = PLAYER;
  if (sp > 5) {
    P.viol.hitT = 0.4; POLICE.crimes.runover++;
    POLICE.add(sp > 9 ? 2 : 1, sp > 9 ? G('💥 {{דרסת|דרסת}} הולך רגל! המשטרה בדרך!') : G('{{פגעת|פגעת}} בהולך רגל! מישהו הזמין משטרה'));
  }
  let n = 0;
  for (const q of TRAFFIC.peds) {
    if (q === p || !q.root.visible || q.state === 'fallen' || q.state === 'fly') continue;
    if (q.root.position.distanceToSquared(P.pos) < 625) {
      if (n++ < 2) say(q.p.head, pick(LINES.witness), 2.2, 'angry');
      q.state = 'flee'; q.timer = 2.5; q.dir = ((q.path.axis === 'ns' ? q.root.position.z - P.pos.z : q.root.position.x - P.pos.x) > 0) ? 1 : -1;
    }
  }
}
function crash(text) {
  const P = PLAYER; P.crashed = 1.2; P.speed = 0; SFX.bump(); GAME.shake = 0.5;
  say(P.rider.head, text, 1.6, 'me');
}

/* ---------------- input ---------------- */
const KEYS = {};
addEventListener('keydown', (e) => {
  if (e.repeat && (e.code === 'KeyE' || e.code === 'Escape')) return;
  KEYS[e.code] = true; SFX.init(); SFX.resume();
  if (e.code === 'Escape') { if (GAME.mode === 'play') GAME.pause(); else if (GAME.mode === 'pause') GAME.resume(); else if (GAME.mode === 'shop') GAME.closeShop(); }
  if (e.code === 'KeyE' && GAME.mode === 'play') GAME.interact();
  if (GAME.mode === 'dialogue' && D && !D.busy && /^Digit[1-5]$/.test(e.code)) { const o = D.current && D.current[+e.code.slice(5) - 1]; if (o) choose(o); }
  if ((e.code === 'Enter' || e.code === 'Space') && !$('#result').hidden) { e.preventDefault(); GAME.onResult ? GAME.onResult() : resultContinue(); }
  if (GAME.mode === 'legal' && LEGAL.current && !LEGAL.busy && /^Digit[1-5]$/.test(e.code)) { const o = LEGAL.current[+e.code.slice(5) - 1]; if (o) { LEGAL.busy = true; SFX.click(); $('#dlg-opts').innerHTML = ''; meSay(o); LEGAL.pick(o); } }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && GAME.mode === 'play') e.preventDefault();
});
addEventListener('keyup', (e) => { KEYS[e.code] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
const TOUCH = { jx: 0, jy: 0, boost: false, brake: false, jid: null };
function readInput() {
  const I = PLAYER.input;
  const kx = (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0);
  const ky = (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0);
  I.x = clamp(kx + TOUCH.jx, -1, 1); I.y = clamp(ky + TOUCH.jy, -1, 1);
  I.boost = !!(KEYS.ShiftLeft || KEYS.ShiftRight || TOUCH.boost);
  I.brake = !!(KEYS.Space || TOUCH.brake);
}
function setupTouch() {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');
  const zone = $('#joy-zone'), base = $('#joy'), knob = $('#joy-knob');
  let cx = 0, cy = 0;
  zone.addEventListener('pointerdown', (e) => {
    SFX.init(); SFX.resume();
    TOUCH.jid = e.pointerId; zone.setPointerCapture(e.pointerId);
    cx = e.clientX; cy = e.clientY; base.style.left = cx + 'px'; base.style.top = cy + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== TOUCH.jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), R = 52;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    TOUCH.jx = Math.abs(dx) < 6 ? 0 : dx / R; TOUCH.jy = Math.abs(dy) < 8 ? 0 : -dy / R;
  });
  const end = (e) => { if (e.pointerId !== TOUCH.jid) return; TOUCH.jid = null; TOUCH.jx = 0; TOUCH.jy = 0; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  const hold = (el, key) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); TOUCH[key] = true; el.classList.add('on'); SFX.init(); SFX.resume(); });
    const up = () => { TOUCH[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  hold($('#b-boost'), 'boost'); hold($('#b-brake'), 'brake');
  $('#b-act').addEventListener('pointerdown', (e) => { e.preventDefault(); if (GAME.mode === 'play') GAME.interact(); });
}

/* ---------------- missions ---------------- */
const MIS = { offers: [], active: null, markers: [] };
const ringGeo = new THREE.TorusGeometry(1.6, 0.12, 6, 28);
function makeMarker(color, beam) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  const icon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })); icon.position.y = 2.2; g.add(icon);
  if (beam) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })); b.position.y = 20; g.add(b); }
  g.userData.icon = icon; scene.add(g); return g;
}
function refreshOffers() {
  for (const o of MIS.offers) scene.remove(o.marker);
  MIS.offers = [];
  if (MIS.active) return;
  const food = WORLD.shops.filter((s) => s.food);
  shuffle(food).slice(0, 3).forEach((s) => {
    const m = makeMarker(0xf2a81d, false); m.position.set(s.x, SURF_H.sidewalk, s.z);
    MIS.offers.push({ shop: s, marker: m });
  });
}
function startDelivery(offer) {
  const dests = WORLD.shops.filter((s) => s !== offer.shop && Math.hypot(s.x - offer.shop.x, s.z - offer.shop.z) > 55 && Math.hypot(s.x - offer.shop.x, s.z - offer.shop.z) < 170);
  const to = pick(dests);
  const dist = Math.hypot(to.x - offer.shop.x, to.z - offer.shop.z);
  const m = makeMarker(0x2bd96b, true); m.position.set(to.x, SURF_H.sidewalk, to.z);
  const names = ['רונית', 'דני', 'שירן', 'אבי', 'מאיה', 'גיא', 'נטע', 'עומר', 'ליה', 'יונתן'];
  const items = ['פלאפל', 'פיצה', 'סושי', 'חומוס', 'שווארמה', 'בורקס', 'גלידה (שנמסה)', 'קפה קר', 'סביח'];
  MIS.active = { from: offer.shop, to, marker: m, time: Math.round(dist / 5.2 + 18), max: Math.round(dist / 5.2 + 18), reward: Math.round(28 + dist * 0.32), who: pick(names), item: pick(items) };
  for (const o of MIS.offers) scene.remove(o.marker); MIS.offers = [];
  PLAYER.bag.visible = true; SFX.coin();
  GAME.flash(`📦 ${MIS.active.item} ל${MIS.active.who} — ${to.name}. יאללה!`);
}
function updateMissions(dt, t) {
  for (const o of MIS.offers) { o.marker.userData.icon.rotation.y = t * 2; o.marker.userData.icon.position.y = 2.2 + Math.sin(t * 3) * 0.15; }
  const A = MIS.active;
  if (A) {
    A.marker.userData.icon.rotation.y = t * 2;
    if (GAME.mode === 'play') A.time -= dt;
    if (Math.hypot(PLAYER.pos.x - A.to.x, PLAYER.pos.z - A.to.z) < 2.6 && GAME.mode === 'play') {
      const late = A.time < 0, tip = !late && A.time > A.max * 0.35 ? Math.round(A.reward * 0.3) : 0;
      const pay = late ? Math.round(A.reward / 2) : A.reward + tip;
      SAVE.money += pay; SAVE.stats.earned += pay; SAVE.stats.deliveries++; SAVE.score += pay * 5;
      say(PLAYER.rider.head, '', 0.1);
      const cust = new THREE.Object3D(); cust.position.set(A.to.x, 1.8, A.to.z); scene.add(cust);
      say(cust, late ? 'איחרת! הפלאפל קר!' : pick(LINES.customer), 2.5);
      setTimeout(() => scene.remove(cust), 2600);
      GAME.flash(late ? `איחור... קיבלת רק ₪${pay}` : `✅ משלוח הושלם! +₪${pay}${tip ? ` (כולל טיפ ₪${tip})` : ''}`);
      SFX.coin(); scene.remove(A.marker); MIS.active = null; PLAYER.bag.visible = false;
      if (SAVE.stats.deliveries >= 5) GAME.achieve('courier');
      saveGame(); GAME.refreshHud(); refreshOffers();
    }
  }
}

/* ---------------- shop ---------------- */
function renderShop() {
  const el = $('#shop-items'); el.innerHTML = '';
  const add = (title, desc, price, owned, act, label) => {
    const d = document.createElement('div'); d.className = 'shop-item';
    d.innerHTML = `<div><b></b><small></small></div><button class="btn small"></button>`;
    d.querySelector('b').textContent = title; d.querySelector('small').textContent = desc;
    const b = d.querySelector('button');
    if (owned) { b.textContent = label || 'יש לך ✓'; b.disabled = !act; }
    else { b.textContent = `₪${price}`; b.disabled = SAVE.money < price; }
    b.onclick = () => { if (act) act(); };
    el.appendChild(d);
  };
  for (const k of ['scooter', 'ebike']) {
    const v = VEH[k], own = SAVE.owned[k], cur = SAVE.vehicle === k;
    add(v.name, k === 'scooter' ? 'זריז בפניות, קליל, הכי תל אביבי שיש' : 'מהיר יותר בישורות, פחות זריז בסמטאות', v.price, own,
      cur ? null : () => { if (!own) { if (SAVE.money < v.price) return; SAVE.money -= v.price; SAVE.owned[k] = true; } SAVE.vehicle = k; buildPlayerModel(); SFX.coin(); saveGame(); renderShop(); GAME.refreshHud(); },
      cur ? 'בשימוש ✓' : own ? 'לבחור' : null);
  }
  add('לוחית זיהוי', 'הפקחים יפסיקו לעצור אותך בגלל לוחית', 120, SAVE.plate, !SAVE.plate ? () => { if (SAVE.money < 120) return; SAVE.money -= 120; SAVE.plate = true; PLAYER.veh.plate.visible = true; GAME.achieve('legal'); SFX.coin(); saveGame(); renderShop(); GAME.refreshHud(); } : null);
  for (const k in UPG) {
    const u = UPG[k], lvl = SAVE.up[k], maxed = lvl >= u.prices.length;
    add(`${u.name} · רמה ${lvl}/${u.prices.length}`, u.desc, maxed ? 0 : u.prices[lvl], maxed,
      maxed ? null : () => { const p = u.prices[SAVE.up[k]]; if (SAVE.money < p) return; SAVE.money -= p; SAVE.up[k]++; SFX.coin(); saveGame(); renderShop(); GAME.refreshHud(); }, maxed ? 'מקסימום ✓' : null);
  }
  $('#shop-money').textContent = '₪' + SAVE.money;
}

/* ---------------- minimap ---------------- */
const MM = { base: null, x0: -150, z0: -212, w: 325, h: 424 };
function buildMinimap() {
  const c = document.createElement('canvas'); c.width = MM.w; c.height = MM.h; const g = c.getContext('2d');
  const img = g.createImageData(MM.w, MM.h);
  const col = { road: [93, 87, 112], sidewalk: [207, 197, 187], bike: [194, 96, 78], yard: [230, 220, 203], plaza: [231, 198, 174], sand: [236, 211, 160], sea: [47, 159, 201] };
  for (let z = 0; z < MM.h; z++) for (let x = 0; x < MM.w; x++) {
    const c3 = col[surfaceAt(MM.x0 + x + 0.5, MM.z0 + z + 0.5)] || [200, 200, 200], i = (z * MM.w + x) * 4;
    img.data[i] = c3[0]; img.data[i + 1] = c3[1]; img.data[i + 2] = c3[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#8f88a8';
  for (const b of WORLD.buildings) if (b.kind !== 'low') g.fillRect(b.x0 - MM.x0, b.z0 - MM.z0, b.x1 - b.x0, b.z1 - b.z0);
  MM.base = c;
}
function drawMinimap() {
  const cv = $('#minimap'), g = cv.getContext('2d'), W = cv.width, H = cv.height, S = 1.7;
  g.clearRect(0, 0, W, H);
  g.save(); g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#2f9fc9'; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  const phi = Math.atan2(Math.cos(PLAYER.heading), Math.sin(PLAYER.heading)), rot = -Math.PI / 2 - phi;
  g.rotate(rot); g.scale(S, S);
  g.drawImage(MM.base, MM.x0 - PLAYER.pos.x, MM.z0 - PLAYER.pos.z);
  const R = (W / 2 - 8) / S;
  const dot = (x, z, color, r, label) => {
    let dx = x - PLAYER.pos.x, dz = z - PLAYER.pos.z; const d = Math.hypot(dx, dz);
    if (d > R) { dx = dx / d * R; dz = dz / d * R; }
    g.save(); g.translate(dx, dz); g.rotate(-rot);
    g.fillStyle = color; g.strokeStyle = '#1b1d2a'; g.lineWidth = 1.2 / S;
    g.beginPath(); g.arc(0, 0, r / S, 0, Math.PI * 2); g.fill(); g.stroke();
    if (label) { g.fillStyle = '#1b1d2a'; g.font = `${10 / S}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, 0.5 / S); }
    g.restore();
  };
  if (WORLD.bikeShop) dot(WORLD.bikeShop.x, WORLD.bikeShop.z, '#f2a81d', 6, '🔧');
  for (const o of MIS.offers) dot(o.shop.x, o.shop.z, '#f2a81d', 4.5);
  if (MIS.active) dot(MIS.active.to.x, MIS.active.to.z, '#2bd96b', 6.5, '★');
  for (const c of POLICE.cars) dot(c.pos.x, c.pos.z, Math.floor(performance.now() / 250) % 2 ? '#ff2a2a' : '#2a6bff', 5.5);
  for (const i of INSPECTORS) dot(i.pos.x, i.pos.z, i.state === 'chase' || i.state === 'call' ? '#ff3b30' : i.state === 'search' ? '#ff9f1a' : '#3d7bff', 4.5);
  g.restore();
  g.save(); g.translate(W / 2, H / 2); g.fillStyle = '#f3c341'; g.strokeStyle = '#1b1d2a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
}

/* ---------------- camera ---------------- */
const CAM = { pos: new THREE.Vector3(30, 20, 60), look: new THREE.Vector3(), heading: Math.PI, orbit: 0 };
const _ct = new THREE.Vector3(), _cl = new THREE.Vector3();
function camBlocked(x, y, z) {
  return buildingAt(x, y, z);
}
function updateCamera(dt, t) {
  const P = PLAYER, portrait = innerHeight > innerWidth;
  camera.fov = lerp(camera.fov, (portrait ? 72 : 60) + (P.boosting ? 9 : 0) + Math.min(6, Math.abs(P.speed) * 0.35), Math.min(1, dt * 3)); camera.updateProjectionMatrix();
  document.body.classList.toggle('boost', !!P.boosting && GAME.mode === 'play');
  if (GAME.mode === 'title') {
    CAM.orbit += dt * 0.06;
    const cx = 36, cz = 34;
    _ct.set(cx + Math.cos(CAM.orbit) * 34, 14 + Math.sin(CAM.orbit * 0.7) * 3, cz + Math.sin(CAM.orbit) * 34);
    CAM.pos.lerp(_ct, Math.min(1, dt * 2)); camera.position.copy(CAM.pos); camera.lookAt(cx, 2, cz);
    return;
  }
  if (GAME.mode === 'dialogue' || (GAME.mode === 'result')) {
    const I = D ? D.insp : null;
    const mid = _cl.copy(P.pos); if (I) mid.lerp(I.pos, 0.5);
    const dx = I ? I.pos.x - P.pos.x : 1, dz = I ? I.pos.z - P.pos.z : 0, d = Math.hypot(dx, dz) || 1;
    let nx = -dz / d, nz = dx / d;
    // pick the side that faces the camera's current position
    if ((CAM.pos.x - mid.x) * nx + (CAM.pos.z - mid.z) * nz < 0) { nx = -nx; nz = -nz; }
    const portraitK = portrait ? 1.6 : 1;
    _ct.set(mid.x + nx * 4.2 * portraitK, mid.y + 1.7, mid.z + nz * 4.2 * portraitK);
    for (let k = 0; k < 6 && camBlocked(_ct.x, _ct.y, _ct.z); k++) { _ct.lerp(mid, 0.25); _ct.y += 0.3; }
    CAM.pos.lerp(_ct, Math.min(1, dt * 3));
    camera.position.copy(CAM.pos);
    CAM.look.lerp(_cl.set(mid.x, mid.y + 1.0, mid.z), Math.min(1, dt * 4));
    camera.lookAt(CAM.look);
    return;
  }
  CAM.heading += angDiff(CAM.heading, P.heading + (P.speed < -0.2 ? 0 : 0)) * Math.min(1, dt * 3.2);
  const sp = Math.abs(P.speed);
  const dist = (portrait ? 6.6 : 5.6) + sp * 0.14, hgt = (portrait ? 3.3 : 2.8) + sp * 0.06;
  const fx = Math.sin(CAM.heading), fz = Math.cos(CAM.heading);
  const tgt = _cl.set(P.pos.x + fx * 2.5, P.pos.y + 1.3, P.pos.z + fz * 2.5);
  _ct.set(P.pos.x - fx * dist, P.pos.y + hgt, P.pos.z - fz * dist);
  // keep the camera out of buildings
  for (let k = 1; k <= 8; k++) {
    const f = k / 8, x = lerp(P.pos.x, _ct.x, f), y = lerp(P.pos.y + 1.5, _ct.y, f), z = lerp(P.pos.z, _ct.z, f);
    if (camBlocked(x, y, z)) { const ff = Math.max(0.2, (k - 1) / 8); _ct.set(lerp(P.pos.x, _ct.x, ff), lerp(P.pos.y + 1.5, _ct.y, ff) + 0.8, lerp(P.pos.z, _ct.z, ff)); break; }
  }
  CAM.pos.lerp(_ct, 1 - Math.exp(-dt * 7));
  camera.position.copy(CAM.pos);
  if (GAME.shake > 0) { GAME.shake -= dt; camera.position.x += (Math.random() - 0.5) * GAME.shake * 0.4; camera.position.y += (Math.random() - 0.5) * GAME.shake * 0.4; }
  CAM.look.lerp(tgt, 1 - Math.exp(-dt * 10));
  camera.lookAt(CAM.look);
}

/* ---------------- GAME ---------------- */
const GAME = {
  mode: 'loading', time: 0, shake: 0, chasing: false, chaseT: 0, dlgAnger: 0, area: '', flashT: 0,
  flash(msg) { const el = $('#flash'); el.textContent = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(this._ft); this._ft = setTimeout(() => el.classList.remove('show'), 2600); },
  achieve(k) {
    if (SAVE.ach[k]) return; SAVE.ach[k] = Date.now(); saveGame();
    const a = ACH[k], el = document.createElement('div'); el.className = 'ach';
    el.innerHTML = `<span class="i">${a[0]}</span><div><small>הישג חדש!</small><b></b><em></em></div>`;
    el.querySelector('b').textContent = G(a[1]); el.querySelector('em').textContent = G(a[2]);
    $('#achs').appendChild(el); SFX.yay(); setTimeout(() => el.remove(), 4200);
  },
  refreshHud() {
    $('#money').textContent = (SAVE.money < 0 ? '-₪' : '₪') + Math.abs(SAVE.money);
    $('#money').parentElement.classList.toggle('debt', SAVE.money < 0);
    $('#score').textContent = SAVE.score.toLocaleString('he-IL');
    $('#plate-ind').hidden = SAVE.plate;
    const st = $('#stars'); st.hidden = POLICE.wanted <= 0; st.textContent = '★'.repeat(POLICE.wanted) + '☆'.repeat(5 - POLICE.wanted);
  },
  onChaseStart(insp) {
    if (!this.chasing) { this.chasing = true; this.chaseT = 0; PLAYER.chaseTopSpeed = 0; SFX.alarm(); }
  },
  onChaseCheck() {
    if (!INSPECTORS.some((i) => i.state === 'chase' || i.state === 'search' || i.state === 'call' || i.state === 'approach')) {
      if (this.chasing && GAME.mode === 'play') {
        const prize = Math.round(20 + this.chaseT * 2);
        SAVE.money += prize; SAVE.stats.escapes++; SAVE.score += prize * 8; saveGame(); this.refreshHud();
        GAME.flash(G(`💨 ברחת! +₪${prize} פרס "אגדה של דיזנגוף"`)); GAME.achieve('escape'); SFX.yay();
      }
      this.chasing = false;
    }
  },
  interact() {
    const P = PLAYER;
    if (WORLD.bikeShop && Math.hypot(P.pos.x - WORLD.bikeShop.x, P.pos.z - WORLD.bikeShop.z) < 4) return this.openShop();
    for (const o of MIS.offers) if (Math.hypot(P.pos.x - o.shop.x, P.pos.z - o.shop.z) < 3) return startDelivery(o);
  },
  openShop() { if (this.chasing) { this.flash('אי אפשר להיכנס למוסך באמצע מרדף!'); return; } this.mode = 'shop'; $('#shop').hidden = false; renderShop(); SFX.click(); },
  closeShop() { this.mode = 'play'; $('#shop').hidden = true; SFX.click(); },
  pause() { this.mode = 'pause'; $('#pause').hidden = false; $('#snd').textContent = SAVE.sound ? 'צליל: פועל' : 'צליל: כבוי'; renderStats(); },
  resume() { this.mode = 'play'; $('#pause').hidden = true; $('#reset-confirm').hidden = true; },
};
function renderStats() {
  const s = SAVE.stats;
  $('#stats').innerHTML = `<div><b>${s.deliveries}</b><span>משלוחים</span></div><div><b>${s.fines}</b><span>דוחות</span></div><div><b>${s.warnings}</b><span>אזהרות</span></div><div><b>${s.escapes + (s.copEscapes || 0)}</b><span>בריחות</span></div><div><b>${s.arrests || 0}</b><span>מעצרים</span></div>`;
  $('#ach-list').innerHTML = Object.keys(ACH).map((k) => `<span class="${SAVE.ach[k] ? 'got' : ''}" title="${G(ACH[k][2])}">${ACH[k][0]} ${G(ACH[k][1])}</span>`).join('');
}

function updateHud(dt) {
  const P = PLAYER;
  $('#speed').textContent = Math.round(Math.abs(P.speed) * 3.6);
  $('#batt').style.width = (P.battery * 100).toFixed(0) + '%';
  $('#batt').classList.toggle('low', P.battery < 0.2);
  // suspicion
  let sus = 0, who = null; for (const i of INSPECTORS) if (i.sus > sus && i.state !== 'talk') { sus = i.sus; who = i; }
  const chaser = INSPECTORS.find((i) => i.state === 'chase');
  const searcher = INSPECTORS.find((i) => i.state === 'search');
  const sm = $('#sus');
  if (POLICE.wanted > 0) {
    sm.hidden = false; sm.className = 'meter cops';
    $('#sus-label').textContent = (POLICE.cars.some((c) => c.sees) ? '🚓 המשטרה רודפת אחריך! ' : '🚓 המשטרה מחפשת אותך… ') + '★'.repeat(POLICE.wanted);
    $('#sus-fill').style.width = Math.round(clamp(GAME.policeLost || 0, 0, 1) * 100) + '%';
  } else if (chaser || searcher) {
    sm.hidden = false; sm.className = 'meter chase';
    const lost = chaser ? chaser.lostT / 4.2 : 1;
    $('#sus-label').textContent = chaser ? (lost > 0.05 ? 'מרדף! הפקח איבד קשר עין…' : `מרדף! ${chaser.name} על הזנב שלך`) : 'הפקח מחפש אותך באזור…';
    $('#sus-fill').style.width = (chaser ? Math.round(lost * 100) : 100) + '%';
    GAME.chaseT += dt;
  } else if (sus > 2 && who) {
    sm.hidden = false; sm.className = 'meter' + (who.state === 'call' ? ' call' : '');
    let best = null, bv = 0; for (const k in who.susBy) if (who.susBy[k] > bv) { bv = who.susBy[k]; best = k; }
    $('#sus-label').textContent = who.state === 'call' ? `${who.name} קורא לך לעצור!` : `חשד: ${best ? VIOL[best].short : '...'} · ${who.name}`;
    $('#sus-fill').style.width = Math.min(100, sus) + '%';
  } else sm.hidden = true;
  // prompt
  let prompt = '';
  if (GAME.mode === 'play') {
    if (WORLD.bikeShop && Math.hypot(P.pos.x - WORLD.bikeShop.x, P.pos.z - WORLD.bikeShop.z) < 4) prompt = 'מוסך "אופני העיר" — שדרוגים';
    else for (const o of MIS.offers) if (Math.hypot(P.pos.x - o.shop.x, P.pos.z - o.shop.z) < 3) { prompt = `לקחת משלוח מ"${o.shop.name}"`; break; }
  }
  const pe = $('#prompt'); pe.hidden = !prompt; if (prompt) $('#prompt-t').textContent = prompt;
  $('#b-act').classList.toggle('ready', !!prompt);
  // mission card
  const A = MIS.active, mc = $('#mission');
  if (A) {
    const d = Math.round(Math.hypot(P.pos.x - A.to.x, P.pos.z - A.to.z));
    mc.innerHTML = `<b>📦 ${A.item} ל${A.who}</b><span>${A.to.name} · ${d} מ׳</span><span class="${A.time < 10 ? 'late' : ''}">${A.time > 0 ? '⏱ ' + Math.ceil(A.time) + ' שנ׳ · ₪' + A.reward : 'איחור! חצי תשלום'}</span>`;
  } else mc.innerHTML = `<b>משלוחים</b><span>סע לטבעת כתומה ליד מסעדה ולחץ ${IS_TOUCH ? '✋' : 'E'}</span>`;
  // area name
  const a = areaName(P.pos.x, P.pos.z);
  if (a !== GAME.area) { GAME.area = a; const el = $('#area'); el.textContent = a; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
}

/* ---------------- title ---------------- */
function setupUI() {
  const pickG = (g) => { SAVE.gender = g; window.PLAYER_G = g; document.querySelectorAll('.g-btn').forEach((b) => b.classList.toggle('sel', b.dataset.g === g)); };
  document.querySelectorAll('.g-btn').forEach((b) => (b.onclick = () => { pickG(b.dataset.g); SFX.init(); SFX.click(); }));
  pickG(SAVE.gender);
  $('#start').onclick = () => { SFX.init(); SFX.resume(); startGame(); };
  $('#start').textContent = SAVE.started ? 'להמשיך לרכוב' : 'יאללה, לרכוב!';
  $('#b-pause').onclick = () => { if (GAME.mode === 'play') GAME.pause(); };
  $('#resume').onclick = () => GAME.resume();
  $('#snd').onclick = () => { SAVE.sound = !SAVE.sound; saveGame(); $('#snd').textContent = SAVE.sound ? 'צליל: פועל' : 'צליל: כבוי'; };
  $('#reset').onclick = () => { $('#reset-confirm').hidden = false; };
  $('#reset-no').onclick = () => { $('#reset-confirm').hidden = true; };
  $('#reset-yes').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); };
  $('#shop-close').onclick = () => GAME.closeShop();
  $('#result-btn').onclick = () => (GAME.onResult ? GAME.onResult() : resultContinue());
  $('#refuse').onclick = () => refuseFine();
  $('#pay').onclick = () => payNow();
  $('#run').onclick = () => tryRun();
  $('#help-keys').hidden = IS_TOUCH; $('#help-touch').hidden = !IS_TOUCH;
}
function startGame() {
  window.PLAYER_G = SAVE.gender;
  SAVE.started = true; saveGame();
  buildPlayerModel();
  PLAYER.active = true;
  $('#title').hidden = true; $('#hud').hidden = false;
  if (IS_TOUCH) $('#touch').hidden = false;
  GAME.mode = 'play'; GAME.refreshHud();
  CAM.pos.set(PLAYER.pos.x, PLAYER.pos.y + 3, PLAYER.pos.z + 6);
  refreshOffers();
  setTimeout(() => GAME.flash(G('ברוכים הבאים לדיזנגוף! {{קח|קחי}} משלוח, ו{{תיזהר|תיזהרי}} מהפקחים 👀')), 600);
}

/* ---------------- main loop ---------------- */
let _last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - _last) / 1000); _last = now;
  if (GAME.mode === 'loading') return;
  const t = now / 1000;
  const running = GAME.mode === 'play' || GAME.mode === 'dialogue' || GAME.mode === 'title';
  if (running) {
    GAME.time += dt;
    readInput();
    updateLights();
    updateTraffic(dt, t);
    updateExtras(dt, t);
    for (const i of INSPECTORS) i.update(dt, t);
    if (GAME.mode === 'play') POLICE.update(dt, t); else SFX.siren(0);
    if (PLAYER.root) updatePlayer(dt, t);
    updateMissions(dt, t);
    for (const f of WORLD.animated) f(t);
  }
  // when the argument sheet covers the bottom of the screen, shift the 3D view up
  const sheet = !$('#dlg').hidden ? $('#dlg .sheet') : null;
  const off = sheet ? Math.min(sheet.offsetHeight * 0.42, innerHeight * 0.3) : 0;
  if (Math.abs((GAME._vo || 0) - off) > 0.5) { GAME._vo = lerp(GAME._vo || 0, off, Math.min(1, dt * 6)); if (GAME._vo < 1 && !off) { GAME._vo = 0; camera.clearViewOffset(); } else camera.setViewOffset(innerWidth, innerHeight, 0, GAME._vo, innerWidth, innerHeight); }
  if (GAME.mode === 'legal') { GAME.time += dt; updateLegal(dt, t); }
  else if (PLAYER.root || GAME.mode === 'title') updateCamera(dt, t);
  const fp = PLAYER.root ? PLAYER.pos : CAM.look;
  sun.position.set(Math.round(fp.x) + SUN_OFF.x, SUN_OFF.y, Math.round(fp.z) + SUN_OFF.z); sun.target.position.set(Math.round(fp.x), 0, Math.round(fp.z));
  if (GAME.mode !== 'title' && GAME.mode !== 'legal') { updateHud(dt); drawMinimap(); }
  updateBubbles(running ? dt : 0);
  renderer.render(scene, camera);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const mm = $('#minimap'), s = Math.round((w < 600 ? 104 : 150) * Math.min(2, devicePixelRatio || 1));
  mm.width = s; mm.height = s;
}
addEventListener('resize', resize);

async function boot() {
  loadGame(); window.PLAYER_G = SAVE.gender;
  try { await Promise.race([Promise.all([document.fonts.load('800 64px Rubik'), document.fonts.load('400 20px "Secular One"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { }
  buildWorld();
  spawnTraffic(); spawnExtras(); spawnInspectors();
  buildMinimap();
  setupUI(); setupTouch(); resize();
  // a preview rider in the title scene
  PLAYER.pos.set(7.25, 0, 30);
  $('#loading').hidden = true; $('#title').hidden = false;
  GAME.mode = 'title';
  requestAnimationFrame(frame);
}
boot();
