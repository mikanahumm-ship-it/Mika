'use strict';
/* ============================================================
   LEGAL: arrest → interrogation room → court → (maybe) jail
   Two small 3D sets are built far outside the map.
   ============================================================ */
const IROOM = new THREE.Vector3(2000, 0, 0), CROOM = new THREE.Vector3(2100, 0, 0);
const LEGAL = { built: false, cast: {}, cam: { pos: new THREE.Vector3(), look: new THREE.Vector3() }, look: new THREE.Vector3(), speaker: null, timers: [] };

const LCATS = {
  silent: ['שתיקה', '#6d6a7c'], lawyer: ['עורך דין', '#2f6fe4'], lie: ['שקר', '#e2463b'], truth: ['אמת', '#1f9b6b'], funny: ['חוצפה ישראלית', '#a24fd6'],
  innocent: ['הגנה', '#2f6fe4'], sorry: ['חרטה', '#1f9b6b'], rage: ['התפרצות', '#e2463b'], deal: ['הסדר', '#f2a81d'],
};

function buildLegalRooms() {
  if (LEGAL.built) return; LEGAL.built = true;
  // ---- interrogation room ----
  const I = new THREE.Group(); I.position.copy(IROOM); scene.add(I);
  bx(I, 8, 0.2, 8, 0, -0.1, 0, 0x4f535c);
  bx(I, 8, 3.4, 0.2, 0, 1.7, -4, 0x55665f); bx(I, 0.2, 3.4, 8, -4, 1.7, 0, 0x5c6d66); bx(I, 0.2, 3.4, 8, 4, 1.7, 0, 0x5c6d66); bx(I, 8, 3.4, 0.2, 0, 1.7, 4, 0x55665f);
  bx(I, 0.06, 1.3, 2.8, 3.86, 1.75, -0.4, 0x1a2230, { metalness: 0.7, roughness: 0.1 });
  bx(I, 8.2, 0.2, 8.2, 0, 3.45, 0, 0x3d4441);
  bx(I, 1.9, 0.08, 1.0, 0, 0.78, 0, 0x9aa0a8, { metalness: 0.5, roughness: 0.4 });
  for (const [x, z] of [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]]) bx(I, 0.06, 0.78, 0.06, x, 0.39, z, 0x777c85);
  bx(I, 0.42, 0.04, 0.3, 0.35, 0.84, 0.05, 0xf2a81d); bx(I, 0.4, 0.02, 0.28, 0.35, 0.87, 0.05, 0xffffff);
  const cup = new THREE.Mesh(GEO.cyl(8), MAT(0xffffff)); cup.scale.set(0.09, 0.12, 0.09); cup.position.set(-0.5, 0.88, -0.1); I.add(cup);
  bx(I, 0.02, 1.2, 0.02, 0, 2.8, 0, 0x222222);
  const shade = new THREE.Mesh(GEO.cone(10), MAT(0x2f3a36)); shade.scale.set(0.7, 0.35, 0.7); shade.position.set(0, 2.15, 0); I.add(shade);
  const bulb = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xfff1b8, toneMapped: false })); bulb.scale.setScalar(0.18); bulb.position.set(0, 2.0, 0); I.add(bulb);
  const s1 = signMesh('חדר חקירות 3', 1.6, 0.4, { w: 384, h: 96, bg: '#2a2f2d', fg: '#e8e4dc', size: 52 }); s1.position.set(-1.8, 2.6, -3.88); I.add(s1);
  const s2 = signMesh('אסור לעשן', 0.9, 0.3, { w: 256, h: 84, bg: '#ffffff', fg: '#c62828', size: 48 }); s2.position.set(1.8, 2.2, -3.88); I.add(s2);
  for (const z of [0.95, -0.95]) { const c = new THREE.Group(); c.position.set(0, 0, z); I.add(c); bx(c, 0.5, 0.06, 0.5, 0, 0.46, 0, 0x30343c); bx(c, 0.5, 0.6, 0.06, 0, 0.78, z > 0 ? 0.24 : -0.24, 0x30343c); for (const [x, zz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) bx(c, 0.04, 0.46, 0.04, x, 0.23, zz, 0x30343c); }

  // ---- courtroom ----
  const C = new THREE.Group(); C.position.copy(CROOM); scene.add(C);
  bx(C, 12, 0.2, 13, 0, -0.1, 0, 0xa8794a);
  bx(C, 12, 4.5, 0.2, 0, 2.25, -6, 0xefe6d6); bx(C, 0.2, 4.5, 13, -6, 2.25, 0, 0xefe6d6); bx(C, 0.2, 4.5, 13, 6, 2.25, 0, 0xefe6d6); bx(C, 12, 4.5, 0.2, 0, 2.25, 6.5, 0xefe6d6);
  bx(C, 12.2, 0.2, 13.2, 0, 4.55, 0, 0xe6dccb);
  for (const z of [-3, 1, 5]) bx(C, 3, 0.05, 0.6, 0, 4.43, z, 0xfff6d8, { emissive: 0xfff2c0, emissiveIntensity: 0.8 });
  bx(C, 11.8, 1.2, 0.1, 0, 0.6, -5.88, 0x7a4a26); bx(C, 0.1, 1.2, 12.8, -5.88, 0.6, 0, 0x7a4a26); bx(C, 0.1, 1.2, 12.8, 5.88, 0.6, 0, 0x7a4a26);
  bx(C, 5.4, 0.35, 2.6, 0, 0.17, -4.4, 0x6b3f1f);
  bx(C, 4.6, 1.35, 0.9, 0, 1.0, -3.4, 0x6b3f1f); bx(C, 4.7, 0.08, 1.0, 0, 1.7, -3.4, 0x5a3418);
  bx(C, 1.0, 2.0, 0.2, 0, 1.4, -5.1, 0x6d1f2a);
  const sc = signMesh('בית משפט השלום · תל־אביב־יופי', 5.4, 0.62, { w: 900, h: 104, bg: '#6b3f1f', fg: '#f3d68a', size: 60 }); sc.position.set(0, 3.7, -5.88); C.add(sc);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.85), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide })); fl.position.set(-4.2, 2.8, -5.86); C.add(fl);
  bx(C, 0.06, 3.3, 0.06, -4.85, 1.65, -5.8, 0xc9a33a);
  for (const x of [-2.6, 2.6]) { bx(C, 1.8, 0.85, 0.8, x, 0.43, -1.2, 0x7a4a26); bx(C, 1.9, 0.06, 0.9, x, 0.88, -1.2, 0x5a3418); }
  const ps = signMesh('התביעה', 0.9, 0.25, { w: 256, h: 72, bg: '#f4efe6', fg: '#1b1d2a', size: 46 }); ps.position.set(-2.6, 0.6, -0.79); C.add(ps);
  const ds = signMesh('ההגנה', 0.9, 0.25, { w: 256, h: 72, bg: '#f4efe6', fg: '#1b1d2a', size: 46 }); ds.position.set(2.6, 0.6, -0.79); C.add(ds);
  bx(C, 1.8, 1.05, 0.1, 0, 0.53, 1.0, 0x7a4a26); bx(C, 0.1, 1.05, 1.6, -0.9, 0.53, 1.8, 0x7a4a26); bx(C, 0.1, 1.05, 1.6, 0.9, 0.53, 1.8, 0x7a4a26);
  for (const z of [3.8, 5.2]) { bx(C, 7, 0.08, 0.6, 0, 0.48, z, 0x7a4a26); bx(C, 7, 0.6, 0.08, 0, 0.8, z + 0.3, 0x7a4a26); bx(C, 6.6, 0.45, 0.4, 0, 0.22, z, 0x5a3418); }
  const gavel = new THREE.Group(); gavel.position.set(0.9, 1.78, -3.3); C.add(gavel); bx(gavel, 0.09, 0.09, 0.3, 0, 0, 0, 0x4a2a12); bx(gavel, 0.03, 0.03, 0.35, 0.12, 0, 0.1, 0x4a2a12); LEGAL.gavel = gavel;
}

function legalPerson(o, room, x, z, ry, pose) {
  const p = makePerson(o); p.root.position.set(room.x + x, 0, room.z + z); p.root.rotation.y = ry; scene.add(p.root);
  resetPose(p); p.pose = pose; return p;
}
function clearCast() { for (const k in LEGAL.cast) if (LEGAL.cast[k].p) scene.remove(LEGAL.cast[k].p.root); LEGAL.cast = {}; }
function playerWalker(room, x, z, ry, pose) {
  const f = SAVE.gender === 'f';
  return legalPerson({ female: f, skin: 0xd8a27c, shirt: 0xf3c341, pants: 0xf3f1ec, hair: 0x2a1d16, shoes: 0x1b1b1b, chain: !f }, room, x, z, ry, pose);
}
function legalTimeout(fn, ms) { LEGAL.timers.push(setTimeout(fn, ms)); }

/* -------- shared sheet helpers (uses the dialogue sheet DOM) -------- */
function setCam(px, py, pz, lx, ly, lz) { LEGAL.cam.pos.set(px, py, pz); LEGAL.cam.look.set(lx, ly, lz); }
function legalSay(key, text, done) {
  const c = LEGAL.cast[key]; LEGAL.speaker = key;
  $('#dlg-name').textContent = c.name; $('#dlg-pers').textContent = c.role; $('#dlg-face').textContent = c.face;
  if (c.cam) setCam(...c.cam);
  const el = $('#dlg-insp'); clearInterval(_typeTimer); el.textContent = ''; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  el.style.borderRightColor = c.color || 'var(--blue)';
  text = GI(G(text), LEGAL.jg || c.g || 'm');
  SFX.blip(c.g === 'f' ? 1.25 : 0.85);
  let fin = false; const t0 = performance.now();
  const finish = () => { if (fin) return; fin = true; clearInterval(_typeTimer); el.textContent = text; el.onclick = null; if (done) legalTimeout(done, 350); };
  el.onclick = finish;
  _typeTimer = setInterval(() => { const i = Math.floor((performance.now() - t0) / 16); el.textContent = text.slice(0, i); if (i >= text.length) finish(); }, 30);
}
function legalOptions(list, onPick) {
  const box = $('#dlg-opts'); box.innerHTML = '';
  list.forEach((o, i) => {
    const cat = LCATS[o.cat] || ['', '#888'];
    const b = document.createElement('button'); b.className = 'opt'; b.style.setProperty('--cat', cat[1]);
    b.innerHTML = `<span class="tag">${cat[0]}</span><span class="txt"></span><span class="key">${i + 1}</span>`;
    b.querySelector('.txt').textContent = o.raw ? GI(G(o.t), LEGAL.jg || 'f') : '"' + GI(G(o.t), LEGAL.jg || 'f') + '"';
    b.onclick = () => { if (LEGAL.busy) return; LEGAL.busy = true; SFX.click(); box.innerHTML = ''; meSay(o); onPick(o); };
    box.appendChild(b);
  });
  LEGAL.current = list; LEGAL.busy = false; LEGAL.pick = onPick;
}
function meSay(o) {
  if (o.raw) { $('#dlg-player').hidden = true; return; }
  const line = GI(G(o.t), LEGAL.jg || 'f');
  $('#dlg-player').hidden = false; $('#dlg-player').textContent = line;
  if (LEGAL.cast.me) say(LEGAL.cast.me.p.head, line.length > 46 ? line.slice(0, 44) + '…' : line, 2.4, 'me');
}
function legalMeters(aLbl, a, tLbl, t, pat) {
  $('#m-a-lbl').textContent = aLbl; $('#m-t-lbl').textContent = tLbl;
  $('#m-anger').style.width = clamp(a, 0, 100) + '%'; $('#m-trust').style.width = clamp(t, 0, 100) + '%';
  $('#m-anger-v').textContent = Math.round(clamp(a, 0, 100)); $('#m-trust-v').textContent = Math.round(clamp(t, 0, 100));
  $('#dlg-pat').textContent = pat;
}
function chargesList() {
  const c = POLICE.crimes, out = [];
  if (c.runover) out.push(c.runover > 1 ? `פגיעה ב־${c.runover} הולכי רגל` : 'פגיעה בהולך רגל');
  if (c.assault) out.push('תקיפת עובד ציבור (פקח)');
  if (c.refuse) out.push('סירוב לשלם דוח והפרעה לפקח');
  if (c.insult) out.push('העלבת עובד ציבור');
  if (LEGAL.wantedAt >= 2 || LEGAL.reason === 'police') out.push('בריחה מניידת משטרה');
  if (!out.length) out.push('הפרעה לסדר הציבורי');
  return out;
}

/* ================= ARREST ================= */
function startArrest(reason) {
  if (GAME.mode === 'legal') return;
  buildLegalRooms();
  clearInterval(_typeTimer);
  LEGAL.reason = reason; LEGAL.wantedAt = POLICE.wanted;
  for (const i of INSPECTORS) if (i.state !== 'patrol') { i.state = 'return'; i.cool = 30; i.sus = 0; i.susBy = {}; i.fled = false; i.grab = 0; }
  D = null;
  POLICE.clear(true);
  GAME.mode = 'legal'; GAME.chasing = false;
  SAVE.stats.arrests = (SAVE.stats.arrests || 0) + 1; saveGame();
  for (const id of ['#hud', '#touch', '#dlg', '#result', '#shop']) $(id).hidden = true;
  const A = $('#arrest'); A.hidden = false;
  $('#arrest-sub').textContent = G({ police: 'השוטרים הורידו אותך מהקורקינט ושמו אזיקים.', refuse: 'הפקח הזמין ניידת. {{סירבת|סירבת}} לשלם, אז עכשיו זה עניין של משטרה.', insult: 'הפקח איבד את זה והזמין ניידת.', held: 'הפקח החזיק אותך עד שהניידת הגיעה.' }[reason] || 'נעצרת.');
  SFX.siren(1); legalTimeout(() => SFX.siren(0), 1800);
  legalTimeout(() => { A.hidden = true; enterInterrogation(); }, 2600);
}

/* ================= INTERROGATION ================= */
const IQ = [
  { q: 'טוב. {{ספר|ספרי}} לי מה קרה היום ב{AREA}.', opts: [
    { id: 'quiet', cat: 'lie', t: 'לא קרה כלום, רכבתי בשקט לגמרי.', ev: 9, pat: -5, r: 'בשקט? יש לנו סרטון מהמצלמה של הפיצוצייה. זה לא היה בשקט.' },
    { cat: 'silent', t: 'אני שומר{{|ת}} על זכות השתיקה.', ev: 0, pat: -10, r: 'זכותך. אבל השתיקה שלך צועקת.' },
    { id: 'lawyer', cat: 'lawyer', t: 'אני רוצה עורך דין!', ev: -8, pat: -12, r: 'עורך דין... בסדר. הסנגוריה בדרך. הם תקועים בפקק באיילון.' },
    { cat: 'truth', t: 'טוב... אני מודה. נסעתי מהר מדי.', ev: 16, pat: 15, confess: true, r: 'סוף סוף מישהו כן. זה ייזכר לטובתך.' },
    { cat: 'funny', t: 'הווייז הביא אותי לשם, תחקרו אותו!', ev: 2, pat: -8, r: 'אם הייתי יכול, הייתי עוצר את הווייז מזמן.' },
  ] },
  { q: 'יש לנו עדה. סבתא עם עגלת שוק. היא אומרת {{שטסת|שטסת}} כמו טיל. מה {{תגיד|תגידי}} על זה?', opts: [
    { cat: 'lie', t: 'היא מבלבלת אותי עם מישהו אחר.', ev: 7, pat: -5, r: 'עם קסדה שחורה, חולצה צהובה ואותו קורקינט? איזה צירוף מקרים.' },
    { cat: 'funny', t: 'הסבתא הזאת רודפת אחריי מאז הגן!', ev: 1, pat: -6, r: 'היא בת 84. היא בקושי רודפת אחרי האוטובוס.' },
    { id: 'admit2', cat: 'truth', t: 'אולי באמת נסעתי קצת מהר... סליחה.', ev: 10, pat: 12, confess: true, r: 'יפה. אני רושם: "החשוד{{|ה}} מביע{{|ה}} חרטה".' },
    { cat: 'silent', t: '(שתיקה ארוכה ומבט בקיר)', ev: 0, pat: -12, raw: true, r: 'אני יכול לחכות. יש לי קפה. לך אין.' },
    { cat: 'lawyer', t: 'בלי עורך דין אני לא עונה על זה.', ev: -4, pat: -8, r: 'הוא עדיין בפקק. אבל בסדר.' },
  ] },
  { q: 'איפה {{היית|היית}} היום בין שתיים לשלוש בצהריים?', opts: [
    { cat: 'truth', t: 'במשלוחים! אני עובד{{|ת}} קשה, תבדוק באפליקציה.', ev: 3, pat: 6, r: 'בדקתי. 4 משלוחים, דירוג 4.2. ראיתי טובים יותר.' },
    { id: 'mom', cat: 'lie', t: 'אצל אמא שלי. היא תאשר הכל.', ev: 6, pat: -4, r: 'אמא שלך כבר התקשרה. היא אמרה שלא ביקרת אותה חודש.' },
    { cat: 'funny', t: 'בים. אני לא זוכר{{|ת}} כלום, היה חם.', ev: 2, pat: -7, r: 'החום זה לא הגנה משפטית. ניסו.' },
    { cat: 'silent', t: 'לא זוכר{{|ת}}.', ev: 2, pat: -8, r: 'נוח מאוד, הזיכרון הזה.' },
  ] },
  { q: 'אז מה, נסגור את זה יפה? הודאה תעזור לך בבית המשפט.', opts: [
    { cat: 'truth', t: 'אני חותם{{|ת}} על ההודאה.', ev: 14, pat: 20, confess: true, r: 'החלטה בוגרת. נמליץ להתחשב.' },
    { cat: 'lawyer', t: 'אני לא חותם{{|ת}} על כלום בלי עורך דין.', ev: -5, pat: -6, r: 'כמו שאת/ה רוצה. נראה מה יגיד השופט.' },
    { cat: 'funny', t: 'אתם לא תשברו אותי! ...אפשר קפה?', ev: 3, pat: -12, r: 'קפה מגיע רק למי שמשתף פעולה.' },
    { cat: 'lie', t: 'אני בכלל לא {{הייתי|הייתי}} שם. זה התאום שלי.', ev: 10, pat: -15, r: 'התאום שלך. עם אותה תעודת זהות. מבריק.' },
  ] },
];

function enterInterrogation() {
  clearCast();
  const good = Math.random() < 0.5, R = IROOM;
  LEGAL.cast.me = { p: playerWalker(R, 0, 0.95, Math.PI, 'sitCuffed'), name: 'את/ה', face: '🙍', role: '' };
  LEGAL.cast.det = good
    ? { p: legalPerson({ female: true, shirt: 0xffffff, pants: 0x1b1b1b, hair: 0x3b2a1e, sleeves: 'long' }, R, 0, -0.95, 0, 'sit'), name: 'רס״ר שירלי', role: 'חוקרת · "השוטרת הטובה"', face: '🕵️‍♀️', g: 'f', color: '#1f9b6b', good: true }
    : { p: legalPerson({ shirt: 0x9fd3e8, pants: 0x2b3a5c, hair: 0x14100e, beard: true, belly: true }, R, 0, -0.95, 0, 'sit'), name: 'פקד בני', role: 'חוקר · "השוטר הרע"', face: '🕵️', g: 'm', color: '#e2463b', good: false };
  LEGAL.cast.det.cam = [R.x + 1.2, 1.75, R.z + 2.7, R.x, 1.2, R.z - 0.9];
  LEGAL.cast.me.cam = [R.x - 1.1, 1.75, R.z - 2.7, R.x, 1.15, R.z + 0.9];
  const c = POLICE.crimes;
  LEGAL.ev = clamp(30 + c.runover * 12 + c.assault * 15 + c.refuse * 6 + c.insult * 5 + LEGAL.wantedAt * 4, 20, 80);
  LEGAL.pat = 100; LEGAL.q = 0; LEGAL.flags = {}; LEGAL.area = areaName(PLAYER.pos.x, PLAYER.pos.z); LEGAL.jg = LEGAL.cast.det.g;
  camera.position.set(R.x + 2.6, 2.4, R.z + 2.6); setCam(R.x + 2.6, 2.4, R.z + 2.6, R.x, 1, R.z);
  $('#dlg').hidden = false; $('#dlg-actions').hidden = true; $('#dlg-player').hidden = true;
  $('#dlg-viol').textContent = 'חשד: ' + chargesList().join(' · ');
  $('#dlg-meet').textContent = 'חדר חקירות 3';
  legalMeters('🔎 ראיות', LEGAL.ev, '⏳ סבלנות', LEGAL.pat, 'שאלה 1/4');
  const open = LEGAL.cast.det.good ? 'שבי... שב{{|י}}. רוצה מים? יופי. אני רק רוצה להבין מה קרה, בסדר?' : 'שב{{|י}}. אל תגיד{{|י}} כלום עדיין. רק תקשיב{{|י}}. יש לך בעיה גדולה.';
  legalSay('det', open, () => askQ());
}
function askQ() {
  const Q = IQ[LEGAL.q];
  legalMeters('🔎 ראיות', LEGAL.ev, '⏳ סבלנות', LEGAL.pat, `שאלה ${LEGAL.q + 1}/4`);
  legalSay('det', Q.q.replace('{AREA}', LEGAL.area), () => legalOptions(Q.opts, (o) => answerQ(o)));
}
function answerQ(o) {
  const det = LEGAL.cast.det;
  let ev = o.ev, pat = o.pat;
  if (!det.good && pat < 0) pat *= 1.5;
  if (det.good && o.cat === 'lie') ev *= 0.75;
  if (o.cat === 'lawyer') { if (LEGAL.flags.lawyer) { ev = 2; pat = -12; } LEGAL.flags.lawyer = true; }
  let r = o.r;
  if (o.confess && LEGAL.flags.quiet) { r = 'רגע. קודם אמרת שרכבת "בשקט לגמרי"? אני רושם: סתירה.'; ev += 8; }
  if (o.id) LEGAL.flags[o.id] = true;
  if (o.confess) LEGAL.flags.confessed = true;
  LEGAL.ev = clamp(LEGAL.ev + ev, 0, 100); LEGAL.pat = clamp(LEGAL.pat + pat, 0, 100);
  legalTimeout(() => legalSay('det', r.replace('את/ה', G('{{אתה|את}}')), () => {
    legalMeters('🔎 ראיות', LEGAL.ev, '⏳ סבלנות', LEGAL.pat, '');
    if (LEGAL.pat <= 0) return legalSay('det', 'נגמרה לי הסבלנות. מאריכים לך מעצר, ונתראה בבית המשפט.', () => { LEGAL.ev += 10; toCourt(); });
    LEGAL.q++;
    if (LEGAL.q < IQ.length) askQ(); else endInterrogation();
  }), 700);
}
function endInterrogation() {
  const c = POLICE.crimes, minor = !c.runover && !c.assault;
  if (LEGAL.ev < 40) return legalSay('det', 'אין לי מספיק ראיות. את/ה משוחרר{{|ת}}. אבל אני עוד אראה אותך.'.replace('את/ה', G('{{אתה|את}}')), () => legalResult('free'));
  if (minor || LEGAL.ev < 62) return legalSay('det', 'בסדר. משחררים אותך בערבות ובתנאים מגבילים. {{תחתום|תחתמי}} פה, ופה, ופה.', () => legalResult('bail'));
  legalSay('det', 'יש מספיק ראיות לכתב אישום. נתראה בבית המשפט.', () => toCourt());
}

/* ================= COURT ================= */
function toCourt() {
  $('#dlg').hidden = true;
  const A = $('#arrest'); A.hidden = false; $('#arrest-t').textContent = '⚖️ בית המשפט'; $('#arrest-sub').textContent = 'שלושה שבועות אחרי. אולם 4, קומה שנייה. המזגן לא עובד.';
  legalTimeout(() => { A.hidden = true; $('#arrest-t').textContent = '🚔 נעצרת!'; enterCourt(); }, 2600);
}
function enterCourt() {
  clearCast();
  const C = CROOM, lenient = Math.random() < 0.5, jf = Math.random() < 0.6;
  LEGAL.jg = jf ? 'f' : 'm'; LEGAL.lenient = lenient;
  LEGAL.cast.judge = { p: legalPerson({ female: jf, shirt: 0x161616, pants: 0x161616, hair: jf ? 0x6b4a2b : 0x8c8c8c, sleeves: 'long', dress: true }, C, 0, -4.6, 0, 'sit'), name: jf ? 'כבוד השופטת אורנה שמש' : 'כבוד השופט יגאל טל', role: lenient ? (jf ? 'שופטת · ידועה כרחמנית' : 'שופט · ידוע כרחמן') : (jf ? 'שופטת · ידועה כקשוחה' : 'שופט · ידוע כקשוח'), face: '⚖️', g: LEGAL.jg, color: '#6b3f1f', cam: [C.x + 0.6, 1.9, C.z - 0.4, C.x, 2.05, C.z - 4.5] };
  LEGAL.cast.judge.p.root.position.y = 0.95;
  LEGAL.cast.pros = { p: legalPerson({ shirt: 0x2e2f3a, pants: 0x2e2f3a, sleeves: 'long', hair: 0x14100e }, C, -2.6, -1.9, 0.5, 'stand'), name: 'עו״ד אלון קשת', role: 'התביעה', face: '👔', g: 'm', color: '#e2463b', cam: [C.x - 0.4, 1.6, C.z + 1.0, C.x - 2.6, 1.45, C.z - 1.9] };
  LEGAL.cast.def = { p: legalPerson({ female: true, shirt: 0x161616, pants: 0x161616, sleeves: 'long', hair: 0x2a1d16 }, C, 2.6, -1.9, -0.5, 'stand'), name: 'עו״ד מיכל רון', role: 'הסנגוריה הציבורית', face: '👩‍💼', g: 'f', color: '#2f6fe4', cam: [C.x + 0.4, 1.6, C.z + 1.0, C.x + 2.6, 1.45, C.z - 1.9] };
  LEGAL.cast.me = { p: playerWalker(C, 0, 1.8, Math.PI, 'standCuffed'), name: 'את/ה', face: '🙍', role: '', cam: [C.x + 0.3, 1.8, C.z - 1.6, C.x, 1.35, C.z + 1.8] };
  LEGAL.cast.mom = { p: legalPerson({ female: true, hair: 0xc8c8c8, shirt: 0x7a4fd6, dress: true, belly: true }, C, -1.5, 3.9, Math.PI, 'sit'), name: 'אמא', role: 'בקהל', face: '👵', g: 'f' };
  legalPerson({ chain: true, shirtless: false, shirt: 0xf3c341 }, C, 1.8, 3.9, Math.PI, 'sit');
  LEGAL.lean = clamp(48 - LEGAL.ev * 0.3 + (LEGAL.flags.confessed ? 8 : 0) + (lenient ? 10 : 0), 10, 70); LEGAL.jpat = 100; LEGAL.court = 0;
  camera.position.set(C.x + 4.5, 4, C.z + 5.5); setCam(C.x + 4.5, 4, C.z + 5.5, C.x, 1, C.z - 1);
  $('#dlg').hidden = false; $('#dlg-player').hidden = true;
  $('#dlg-viol').textContent = 'אישום: ' + chargesList().join(' · ');
  $('#dlg-meet').textContent = 'תיק פלילי 4471-26';
  courtMeters();
  const charges = chargesList().join(', ');
  legalSay('judge', 'הדיון נפתח. מדינת ישראל נגד {{הנאשם|הנאשמת}}. התביעה, בבקשה.', () =>
    legalSay('pros', `כבוד [[השופט|השופטת]], {{הנאשם|הנאשמת}} מואשם{{|ת}} ב: ${charges}. הרחובות של תל אביב אינם מסלול מרוצים! אנו מבקשים עונש מרתיע.`, () =>
      legalSay('judge', 'מה יש ל{{נאשם|נאשמת}} לומר?', () => legalOptions(COURT_R1, (o) => courtAnswer(o, 1)))));
}
function courtMeters() { legalMeters('⏳ סבלנות ' + (LEGAL.jg === 'f' ? 'השופטת' : 'השופט'), LEGAL.jpat, '⚖️ סיכוי לזיכוי', LEGAL.lean, ['פתיחה', 'הסדר', 'מילה אחרונה', 'גזר דין'][LEGAL.court] || ''); }
const COURT_R1 = [
  { cat: 'innocent', t: 'אני חף{{|ה}} מפשע, כבוד [[השופט|השופטת]]!', lean: 'ev', jpat: -5, r: 'נבחן את הראיות. לא את הצעקות.' },
  { cat: 'sorry', t: 'אני מתחרט{{|ת}} מכל הלב. זה לא יחזור.', lean: 12, jpat: 5, r: 'רשמתי את החרטה. היא תעמוד לזכותך.' },
  { cat: 'funny', t: 'כבוד [[השופט|השופטת]], הווייז...', lean: 'waze', jpat: -12, r: 'אל {{תגיד|תגידי}} לי "ווייז" באולם שלי.' },
  { cat: 'lawyer', t: 'אני מעדיף{{|ה}} שעורכת הדין שלי תדבר.', lean: 9, jpat: 3, def: 'כבוד [[השופט|השופטת]], {{מרשי|מרשתי}} עובד{{|ת}} בפרנסה קשה, בלי עבר פלילי, והקסדה הייתה על הראש כל הזמן!', r: 'טיעון מנומק. ממשיכים.' },
  { cat: 'rage', t: 'זה הכל קונספירציה של העירייה!', lean: -12, jpat: -25, r: 'עוד התפרצות אחת ואני [[מוסיף|מוסיפה]] ביזיון בית משפט!' },
];
const COURT_R2 = [
  { cat: 'deal', t: 'אני מסכים{{|ה}} לעסקת הטיעון.', plea: true },
  { cat: 'innocent', t: 'לא! אני הולך{{|ת}} עד הסוף. זיכוי או כלום!', lean: -2, r: 'זכותך. נמשיך.' },
  { cat: 'innocent', t: 'אני רוצה להעיד. יש לי מה להגיד.', lean: 'testify', r: null },
];
const COURT_R3 = [
  { cat: 'sorry', t: 'סליחה. מהיום אני אזרח{{|ית}} שומר{{|ת}} חוק.', lean: 8, r: 'נשמע יפה. נראה.' },
  { cat: 'sorry', t: 'אמא שלי יושבת פה באולם. [[תסתכל|תסתכלי]] עליה.', lean: 10, mom: true, r: 'גברתי, {{הבן|הבת}} שלך בידיים טובות. בערך.' },
  { cat: 'rage', t: 'אני דורש{{|ת}} זיכוי מלא ופיצויים!', lean: -8, jpat: -10, r: 'פיצויים. מעניין. נרשם.' },
  { cat: 'innocent', t: '(לשתוק ולהסתכל על הרצפה)', raw: true, lean: 3, r: 'שתיקה מכובדת. בסדר.' },
];
function courtAnswer(o, round) {
  let lean = o.lean;
  if (lean === 'ev') lean = LEGAL.ev < 50 ? 8 : -6;
  if (lean === 'waze') lean = LEGAL.lenient && Math.random() < 0.45 ? 6 : -4;
  if (lean === 'testify') lean = Math.round(rand(-8, 14));
  LEGAL.lean = clamp(LEGAL.lean + (lean || 0), 0, 100); LEGAL.jpat = clamp(LEGAL.jpat + (o.jpat || 0), 0, 100);
  const next = () => {
    courtMeters();
    if (LEGAL.jpat <= 0) { LEGAL.lean = clamp(LEGAL.lean - 15, 0, 100); return legalSay('judge', 'די! ביזיון בית משפט! אני [[גוזר|גוזרת]] את הדין עכשיו.', () => verdict(false)); }
    if (round === 1) {
      LEGAL.court = 1; courtMeters();
      legalSay('def', 'כבוד [[השופט|השופטת]], אולי נגיע להסדר? {{מרשי|מרשתי}} מוכנ{{|ה}} לעסקת טיעון: עבודות שירות וקנס.', () =>
        legalSay('judge', 'אני [[מוכן|מוכנה]] לשמוע. מה {{הנאשם|הנאשמת}} אומר{{|ת}}?', () => legalOptions(COURT_R2, (x) => courtAnswer(x, 2))));
    } else if (round === 2) {
      if (o.plea) return legalSay('pros', 'התביעה מסכימה להסדר.', () => verdict(true));
      if (o.lean === 'testify') {
        const good = lean > 2;
        return legalSay('judge', good ? 'העדות שלך הייתה... משכנעת באופן מפתיע.' : 'העדות שלך סתרה את עצמה שלוש פעמים. אבל נמשיך.', () => r3());
      }
      r3();
    } else verdict(false);
  };
  const r3 = () => { LEGAL.court = 2; courtMeters(); legalSay('judge', 'מילה אחרונה לפני גזר הדין?', () => legalOptions(COURT_R3, (x) => courtAnswer(x, 3))); };
  legalTimeout(() => {
    if (o.mom) say(LEGAL.cast.mom.p.head, G('זה {{הילד|הילדה}} שלי! {{הוא|היא}} טוב{{|ה}}!'), 2.6, 'angry');
    if (o.def) return legalSay('def', o.def, () => (o.r ? legalSay('judge', o.r, next) : next()));
    if (o.r) legalSay('judge', o.r, next); else next();
  }, 700);
}
function verdict(plea) {
  LEGAL.court = 3; courtMeters();
  if (LEGAL.gavel) { LEGAL.gavelT = 1.2; }
  SFX.stamp();
  const score = LEGAL.lean + rand(-8, 8);
  let res;
  if (plea) res = 'service';
  else if (score >= 62) res = 'acquit';
  else if (score >= 48) res = 'service';
  else if (score >= 34) res = 'probation';
  else res = 'jail';
  const lines = {
    acquit: '{{הנאשם|הנאשמת}} זוכה מחמת הספק. ו{{תקנה|תקני}} קסדה חדשה. הדיון נעול.',
    service: 'אני [[גוזר|גוזרת]] קנס ו־40 שעות עבודות שירות בניקוי חוף גורדון.',
    probation: 'מאסר על תנאי וקנס. עוד עבירה אחת ואת/ה בפנים.',
    jail: 'מאסר בפועל. ימים ספורים במעשיהו יעשו לך טוב.',
  };
  legalSay('judge', lines[res].replace('את/ה', G('{{אתה|את}}')), () => legalTimeout(() => legalResult(res), 900));
}

/* ================= OUTCOMES ================= */
function legalResult(res) {
  $('#dlg').hidden = true;
  const c = POLICE.crimes, card = $('#result-card'), R = $('#result');
  let html = '', fine = 0, btn = 'חזרה לרחוב';
  const days = clamp(2 + c.runover * 2 + c.assault * 3, 2, 14);
  const row = (a, b) => `<div class="t-row"><span>${a}</span><b>${b}</b></div>`;
  if (res === 'free') { html = `<div class="t-head"><div><b>שוחררת מחוסר ראיות</b><small>יצאת מהחקירה בלי כלום</small></div><div class="t-no">ראיות<br><b>${Math.round(LEGAL.ev)}%</b></div></div>${row('החוקר', LEGAL.cast.det.name)}<div class="t-notes"><span>הערות</span><ul><li>${G('יצאת בזכות זכות השתיקה ועצבים של ברזל.')}</li><li>החוקר מבטיח: "עוד נפגש".</li></ul></div><div class="stamp ok">חופשי</div>`; card.className = 'ticket warn'; GAME.achieve('silent'); }
  else if (res === 'bail') { fine = 100 + 40 * (c.runover + c.assault + c.refuse + c.insult); html = `<div class="t-head"><div><b>שחרור בערבות</b><small>בתנאים מגבילים (לא באמת)</small></div><div class="t-no">ערבות<br><b>₪${fine}</b></div></div>${row('תנאי', 'הרחקה מדיזנגוף ל־30 יום')}${row('תנאי', 'חתימה בתחנה פעם בשבוע')}<div class="t-notes"><span>הערות</span><ul><li>${G('{{חתמת|חתמת}} על 14 טפסים. 3 מהם היו באמת קשורים.')}</li></ul></div><div class="stamp">ערבות</div>`; card.className = 'ticket'; }
  else if (res === 'acquit') { html = `<div class="t-head"><div><b>זיכוי!</b><small>בית משפט השלום · תל־אביב־יופי</small></div><div class="t-no">תיק<br><b>4471-26</b></div></div>${row('שופט/ת', LEGAL.cast.judge.name)}${row('סיכוי לזיכוי בסוף', Math.round(LEGAL.lean) + '%')}<div class="t-notes"><span>מה קרה פה</span><ul><li>${G('יצאת זכאי{{|ת}}. אמא שלך בוכה מאושר בקהל.')}</li><li>הסנגורית מבקשת שתשאיר/י ביקורת חיובית.</li></ul></div><div class="stamp ok">זכאי</div>`.replace('תשאיר/י', G('{{תשאיר|תשאירי}}')); card.className = 'ticket warn'; GAME.achieve('acquit'); }
  else if (res === 'service') { fine = 150; html = `<div class="t-head"><div><b>עבודות שירות</b><small>גזר דין</small></div><div class="t-no">קנס<br><b>₪${fine}</b></div></div>${row('עונש', '40 שעות ניקוי חוף גורדון')}${row('שופט/ת', LEGAL.cast.judge.name)}<div class="t-notes"><span>הערות</span><ul><li>תביא/י כובע. ותיזהר/י מהמטקות.</li></ul></div><div class="stamp">אשמה</div>`.replace('תביא/י', G('{{תביא|תביאי}}')).replace('ותיזהר/י', G('{{ותיזהר|ותיזהרי}}')); card.className = 'ticket'; }
  else if (res === 'probation') { fine = 300; html = `<div class="t-head"><div><b>מאסר על תנאי</b><small>גזר דין</small></div><div class="t-no">קנס<br><b>₪${fine}</b></div></div>${row('תנאי', '6 חודשים על תנאי')}${row('שופט/ת', LEGAL.cast.judge.name)}<div class="t-notes"><span>הערות</span><ul><li>עוד עבירה אחת, ו{{אתה|את}} בפנים.</li></ul></div><div class="stamp">אשמה</div>`.replace('{{אתה|את}}', G('{{אתה|את}}')); card.className = 'ticket'; }
  else { btn = 'להיכנס לתא…'; html = `<div class="t-head"><div><b>מאסר בפועל</b><small>גזר דין</small></div><div class="t-no">ימים<br><b>${days}</b></div></div>${row('מקום', 'כלא מעשיהו (בערך)')}${row('שופט/ת', LEGAL.cast.judge.name)}<div class="t-notes"><span>הערות</span><ul><li>הקורקינט מחכה לך במגרש הגרירה.</li></ul></div><div class="stamp">אסיר</div>`; card.className = 'ticket'; }
  card.innerHTML = html;
  SAVE.money -= fine; if (fine) SAVE.stats.paid += fine;
  saveGame();
  R.hidden = false; $('#result-btn').textContent = btn;
  GAME.onResult = () => { $('#result-btn').textContent = 'חזרה לרכיבה'; GAME.onResult = null; R.hidden = true; if (res === 'jail') startJail(days); else legalRelease(); };
}
const JAIL_DAYS = [
  'השותף לתא מספר לך על הגרוש שלו. כבר שלוש שעות.', 'ארוחת צהריים: שניצל. לא רע בכלל, האמת.', 'למדת לשחק שש־בש. הפסדת 40 סיגריות שאין לך.',
  'מישהו שר זוהר ארגוב כל הלילה.', 'הסוהר אמר שהוא מכיר את הפקח שלך. הוא צחק.', 'כתבת מכתב לאמא. היא ענתה: "אמרתי לך!"',
  'השותף לתא פותח סטארטאפ. הוא מחפש משקיעים.', 'עשית 200 שכיבות סמיכה. בערך 12.', 'חלמת על שביל אופניים אינסופי.',
];
function startJail(days) {
  const J = $('#jail'); J.hidden = false; $('#jail-btn').hidden = true;
  let d = 0; const lost = days * 40;
  const tick = () => {
    d++; $('#jail-day').textContent = `יום ${d} מתוך ${days}`; $('#jail-line').textContent = JAIL_DAYS[(d - 1) % JAIL_DAYS.length];
    if (d < days) legalTimeout(tick, 1100);
    else { $('#jail-line').textContent = `שוחררת! הפסדת ${days} ימי עבודה (₪${lost}).`; SAVE.money -= lost; saveGame(); $('#jail-btn').hidden = false; $('#jail-btn').focus(); }
  };
  tick();
  $('#jail-btn').onclick = () => { J.hidden = true; GAME.achieve('jail'); legalRelease(); };
}
function legalRelease() {
  for (const t of LEGAL.timers) clearTimeout(t); LEGAL.timers = [];
  clearCast(); POLICE.clear(false);
  $('#dlg').hidden = true; $('#result').hidden = true; $('#arrest').hidden = true; $('#jail').hidden = true;
  $('#m-a-lbl').textContent = '😡 עצבים'; $('#m-t-lbl').textContent = '🤝 אמון'; $('#dlg-insp').style.borderRightColor = '';
  $('#hud').hidden = false; $('#hud').classList.remove('dim'); if (IS_TOUCH) $('#touch').hidden = false;
  const ps = WORLD.police || { x: 100, z: 8 };
  PLAYER.pos.set(ps.x, 0.16, ps.z - 1); PLAYER.heading = Math.PI; PLAYER.speed = 0; PLAYER.crashed = 0; PLAYER.battery = 1;
  CAM.pos.set(PLAYER.pos.x, 3, PLAYER.pos.z + 6); CAM.heading = Math.PI;
  for (const i of INSPECTORS) { i.state = 'return'; i.cool = 25; i.sus = 0; i.susBy = {}; }
  for (const c of TRAFFIC.cars) c.recycle();
  for (const p of TRAFFIC.peds) p.respawnNear();
  GAME.mode = 'play'; GAME.refreshHud();
  GAME.flash(G('{{יצאת|יצאת}} מהתחנה. הקורקינט חיכה לך בחוץ. יאללה, מתחילים מחדש.'));
}

function updateLegal(dt, t) {
  camera.position.lerp(LEGAL.cam.pos, 1 - Math.exp(-dt * 5));
  LEGAL.look.lerp(LEGAL.cam.look, 1 - Math.exp(-dt * 7)); camera.lookAt(LEGAL.look);
  for (const k in LEGAL.cast) {
    const c = LEGAL.cast[k], p = c.p; if (!p) continue;
    resetPose(p);
    if (p.pose === 'sit' || p.pose === 'sitCuffed') poseSit(p, t);
    else poseIdle(p, t);
    if (p.pose === 'sitCuffed' || p.pose === 'standCuffed') poseCuffed(p);
    if (LEGAL.speaker === k && k !== 'me') poseTalk(p, t, k === 'det' && !c.good ? 1.2 : 0.6);
    if (p.pose === 'sit') p.head.rotation.y = 0;
  }
  if (LEGAL.gavelT > 0 && LEGAL.gavel) { LEGAL.gavelT -= dt; LEGAL.gavel.rotation.z = Math.abs(Math.sin(LEGAL.gavelT * 14)) * 0.9; }
}
