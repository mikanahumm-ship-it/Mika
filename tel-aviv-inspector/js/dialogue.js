'use strict';
/* ============================================================
   DIALOGUE: branching argument with anger / trust meters,
   personalities and memory of previous encounters
   ============================================================ */
let D = null;
const $ = (s) => document.querySelector(s);

function memOf(name) {
  if (!SAVE.mem[name]) SAVE.mem[name] = { meet: 0, claims: [], fines: 0, warns: 0 };
  return SAVE.mem[name];
}

function startDialogue(insp, viol, ctx) {
  const mem = memOf(insp.name), P = PERS[insp.pers];
  GAME.mode = 'dialogue';
  PLAYER.speed = 0; PLAYER.input.boost = false;
  // stage the scene: inspector stands next to the player, facing them
  const h = PLAYER.heading, rx = Math.cos(h), rz = -Math.sin(h);
  insp.pos.set(PLAYER.pos.x + rx * 1.7 + Math.sin(h) * 0.9, insp.pos.y, PLAYER.pos.z + rz * 1.7 + Math.cos(h) * 0.9);
  collideStatic(insp.pos, 0.45);
  insp.heading = Math.atan2(PLAYER.pos.x - insp.pos.x, PLAYER.pos.z - insp.pos.z);
  insp.root.rotation.y = insp.heading;
  D = {
    insp, pers: insp.pers, viol, mem, fled: !!ctx.fled,
    trust: clamp(P.trust - mem.meet * 4 - (ctx.fled ? 15 : 0) + (ctx.fled ? 0 : 10), 5, 90),
    anger: clamp(P.anger + (ctx.fled ? 25 : 0) + (mem.meet ? 5 : 0), 0, 95),
    round: 0, used: new Set(), catsUsed: {}, claims: [], node: null, argues: 0, fluster: 0, flags: {}, busy: false,
    topSpeed: PLAYER.chaseTopSpeed || 0, area: areaName(PLAYER.pos.x, PLAYER.pos.z),
  };
  GAME.dlgAnger = D.anger;
  let open = '';
  if (mem.meet > 0) open += GI(AGAIN[insp.pers], insp.g) + ' ';
  open += GI(VIOL[viol].open[insp.pers], insp.g);
  if (D.fled) open += ' ' + GI(FLED[insp.pers], insp.g);
  $('#dlg').hidden = false; $('#hud').classList.add('dim');
  $('#dlg-name').textContent = insp.name;
  $('#dlg-pers').textContent = PERS[insp.pers].label;
  $('#dlg-viol').textContent = VIOL[viol].name + (D.fled ? ' + בריחה מפקח' : '');
  $('#dlg-meet').textContent = mem.meet ? `נפגשתם כבר ${mem.meet === 1 ? 'פעם אחת' : mem.meet + ' פעמים'}` : 'מפגש ראשון';
  $('#dlg-player').textContent = ''; $('#dlg-player').hidden = true;
  updateMeters(true);
  inspSay(open, () => showOptions());
  SFX.whistle();
}

function updateMeters(instant) {
  $('#m-anger').style.width = D.anger + '%';
  $('#m-trust').style.width = D.trust + '%';
  $('#m-anger-v').textContent = Math.round(D.anger);
  $('#m-trust-v').textContent = Math.round(D.trust);
  const P = PERS[D.pers];
  const left = Math.max(0, P.patience - D.round);
  $('#dlg-pat').textContent = '●'.repeat(left) + '○'.repeat(Math.max(0, P.patience - left));
  GAME.dlgAnger = D.anger;
  const face = D.anger > 75 ? '🤬' : D.anger > 50 ? '😠' : D.trust > 65 ? '🙂' : D.trust < 25 ? '🤨' : '😐';
  $('#dlg-face').textContent = face;
}

let _typeTimer = null;
function inspSay(text, done) {
  const el = $('#dlg-insp');
  clearInterval(_typeTimer);
  el.textContent = ''; let i = 0;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  say(D.insp.p.head, text.length > 60 ? text.slice(0, 58) + '…' : text, 3, 'insp');
  SFX.blip(D.insp.g === 'f' ? 1.25 : 0.85);
  const finish = () => { clearInterval(_typeTimer); el.textContent = text; _typeTimer = null; el.onclick = null; if (done) setTimeout(done, 180); done = null; };
  el.onclick = finish;
  const t0 = performance.now();
  _typeTimer = setInterval(() => { i = Math.floor((performance.now() - t0) / 16); el.textContent = text.slice(0, i); if (i >= text.length) finish(); }, 30);
}

function buildOptions() {
  if (D.node) return NODES[D.node].opts.map((o) => Object.assign({ fromNode: true }, o));
  const out = [];
  for (const cat of ['excuse', 'drama', 'argue', 'sorry']) {
    const spec = OPTS.filter((o) => o.cat === cat && o.v && o.v.includes(D.viol) && !D.used.has(o.id));
    const gen = OPTS.filter((o) => o.cat === cat && !o.v && !D.used.has(o.id));
    let c = null;
    if (spec.length && (Math.random() < 0.75 || !gen.length)) c = pick(spec); else if (gen.length) c = pick(gen);
    if (c) out.push(c);
  }
  const extra = OPTS.filter((o) => o.v && o.v.includes(D.viol) && !D.used.has(o.id) && !out.includes(o));
  if (extra.length && out.length < 5) out.splice(randi(0, out.length), 0, pick(extra));
  return out;
}

function showOptions() {
  const box = $('#dlg-opts'); box.innerHTML = '';
  const opts = buildOptions();
  opts.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'opt'; b.style.setProperty('--cat', CATS[o.cat].color);
    b.innerHTML = `<span class="tag">${CATS[o.cat].label}</span><span class="txt"></span><span class="key">${i + 1}</span>`;
    b.querySelector('.txt').textContent = '"' + G(o.t) + '"';
    b.onclick = () => choose(o);
    box.appendChild(b);
  });
  $('#dlg-actions').hidden = false;
  D.busy = false; D.current = opts;
}

function choose(o) {
  if (!D || D.busy) return;
  D.busy = true; SFX.click();
  $('#dlg-opts').innerHTML = ''; $('#dlg-actions').hidden = true;
  const line = G(o.t);
  $('#dlg-player').hidden = false; $('#dlg-player').textContent = line;
  say(PLAYER.rider.head, line.length > 50 ? line.slice(0, 48) + '…' : line, 2.6, 'me');
  D.round++; D.used.add(o.id);
  const P = PERS[D.pers], m = P.mult[o.cat];
  let dt = o.fx[0] > 0 ? o.fx[0] * m.t : o.fx[0];
  let da = o.fx[1] > 0 ? o.fx[1] * m.a : o.fx[1];
  const rep = D.catsUsed[o.cat] || 0; D.catsUsed[o.cat] = rep + 1;
  if (dt > 0) dt *= Math.pow(0.72, rep);
  if (o.cat === 'argue') D.argues++;
  let special = null, type = null;
  // memory: contradictions and repeated stories
  if (o.claim) {
    for (const rule of CONTRA) {
      if (!rule.b.includes(o.claim)) continue;
      if (D.claims.some((c) => rule.a.includes(c))) { special = rule.now; break; }
      if (D.mem.claims.some((c) => rule.a.includes(c))) { special = rule.past; break; }
    }
    if (special) { dt = -30; da = 15; type = 'contra'; D.flags.contra = true; GAME.achieve('elephant'); }
    else if (D.mem.claims.includes(o.claim)) { special = REPEAT[o.claim] || REPEAT._; dt = Math.min(dt * 0.3, 0) - 10; da += 6; type = 'repeat'; D.flags.repeat = true; }
    D.claims.push(o.claim);
    D.flags[o.claim] = true;
    if (o.claim === 'sheriff') GAME.achieve('sheriff');
  }
  let laughed = false;
  if (!type && o.funny && Math.random() < P.laugh) { laughed = true; dt += 10; da -= 14; type = 'laugh'; D.flags.laugh = true; }
  if (!type && P.fluster && o.cat === 'argue' && da >= 8 && Math.random() < 0.5) { D.fluster++; type = 'fluster'; da = 2; }
  if (!type) type = da >= 14 ? 'angry' : dt >= 9 ? 'believe' : dt <= 0 ? 'doubt' : 'neutral';
  if (D.pers === 'veteran' && o.cat === 'excuse' && type !== 'laugh' && !special && Math.random() < 0.4) type = 'doubt';

  let text;
  const spec = o.r && (o.r[D.pers] || o.r.any);
  if (special) text = G(special);
  else if (o.next) text = G(NODES[o.next].q);
  else if (type === 'fluster') text = G(pick(REACT.fluster));
  else if (spec && (Math.random() < 0.8 || type === 'laugh')) text = G(Array.isArray(spec) ? pick(spec) : spec);
  else text = G(pick(REACT[type][D.pers]));
  if (laughed) text = G(pick(REACT.laugh[D.pers])) + ' ' + (spec && !o.next ? '' : text);
  text = GI(text, D.insp.g);

  D.trust = clamp(D.trust + dt, 0, 100);
  D.anger = clamp(D.anger + da, 0, 100);
  D.node = o.next || null;

  setTimeout(() => {
    inspSay(text, () => {
      updateMeters();
      floatDelta(dt, da);
      setTimeout(checkEnd, 450);
    });
  }, 650);
}

function floatDelta(dt, da) {
  const f = (el, v, good) => { if (Math.abs(v) < 0.5) return; const s = document.createElement('span'); s.className = 'delta ' + (good ? 'good' : 'bad'); s.textContent = (v > 0 ? '+' : '') + Math.round(v); el.appendChild(s); setTimeout(() => s.remove(), 1300); };
  f($('#m-trust-box'), dt, dt > 0); f($('#m-anger-box'), da, da < 0);
}

function checkEnd() {
  const P = PERS[D.pers];
  if (D.anger >= 100) return endDialogue('fine', END.rage, { rage: true });
  if (D.fluster >= 2) return endDialogue('warning', END.flusterWarn);
  if (D.trust >= 85 && D.anger < 70) return endDialogue('warning');
  if (D.round >= P.patience && !D.node) {
    const score = D.trust - D.anger * 0.7 + P.lenient + 15;
    const p = clamp(score / 100, 0.05, 0.92);
    const ok = Math.random() < p;
    return inspSay(GI(G(END.enough), D.insp.g), () => setTimeout(() => endDialogue(ok ? 'warning' : 'fine'), 500));
  }
  showOptions();
}

function payNow() {
  if (!D || D.busy) return; D.busy = true; SFX.click();
  $('#dlg-opts').innerHTML = ''; $('#dlg-actions').hidden = true;
  $('#dlg-player').hidden = false; $('#dlg-player').textContent = G('טוב, יאללה, {{תן|תן}} את הדוח. אני משלם{{|ת}}.');
  setTimeout(() => endDialogue('fine', END.pay, { discount: true }), 600);
}
function tryRun() {
  if (!D || D.busy) return; D.busy = true; SFX.click();
  $('#dlg-opts').innerHTML = ''; $('#dlg-actions').hidden = true;
  const chance = { rookie: 0.55, nice: 0.45, cynic: 0.35, angry: 0.3, veteran: 0.2 }[D.pers];
  if (Math.random() < chance) {
    const insp = D.insp;
    closeDialogue();
    insp.state = 'chase'; insp.fled = true; insp.stun = 1.6; insp.lostT = 0; insp.last.copy(PLAYER.pos); GAME.onChaseStart(insp);
    insp.shout('היי!!! חזור{{|י}} לפה!', 'insp big');
    PLAYER.speed = 4; GAME.flash(G('ברחת! עכשיו {{תעלם|תיעלמי}} לו מהעיניים!'));
    D = null;
  } else {
    D.anger = 100; D.flags.ranFail = true; updateMeters();
    endDialogue('fine', END.runFail, { rage: true });
  }
}

function endDialogue(outcome, line, o) {
  o = o || {}; D.busy = true;
  $('#dlg-opts').innerHTML = ''; $('#dlg-actions').hidden = true;
  const text = GI(G(line ? line : END[outcome][D.pers]), D.insp.g);
  inspSay(text, () => setTimeout(() => showResult(outcome, o), 1200));
}

function satireNotes(o) {
  const n = [], F = D.flags;
  if (D.topSpeed > 8.4) n.push(G('חשבת {{שאתה|שאת}} בפורמולה 1 בדיזנגוף.'));
  if (F.broken_light) n.push('ניסית לשכנע את הפקח שהרמזור מקולקל.');
  if (F.waze) n.push('האשמת את הווייז. הווייז מסרב להגיב.');
  if (F.contra) n.push('שכחת מה סיפרת לפקח בפעם שעברה. לפקח יש זיכרון של פיל.');
  if (F.repeat) n.push('סיפרת את אותו סיפור פעמיים. הפקח מבקש חומר חדש.');
  if (F.sheriff) n.push('קראת לפקח "השריף של דיזנגוף". הוא שוקל להדפיס חולצה.');
  if (F.mom) n.push(G('איימת שאמא שלך תהרוג {{אותך|אותך}}. זה עוד יכול לקרות.'));
  if (F.coffee_bribe) n.push('ניסית לשחד עובד ציבור בהפוך על שיבולת שועל.');
  if (F.mayor) n.push('טענת שאת/ה מכיר/ה את ראש העירייה. הוא לא מכיר אותך.'.replace('את/ה מכיר/ה', G('{{אתה מכיר|את מכירה}}')));
  if (F.ranFail) n.push('ניסית לברוח באמצע השיחה. הפקח עדיין מחזיק את הכידון.');
  if (D.fled) n.push('ברחת מפקח על סגוויי וחשבת שזה מרדף הוליוודי.');
  if (D.round >= 4) n.push(`התעקשת להתווכח במשך ${D.round * 2 - 1} דקות.`);
  if (D.argues >= 2) n.push('הרמת את הקול על עובד ציבור באמצע היום.');
  if (o.rage) n.push('הפקח נאלץ לנשום עמוק שלוש פעמים.');
  if (!n.length) n.push(pick(['הפקח רשם בצד: "תירוץ חלש, ביצוע חזק".', 'הפקח רשם בצד: "לפחות היה מנומס".', 'הפקח מבקש להזכיר: יש שביל אופניים. אדום. גדול.']));
  return shuffle(n).slice(0, 3);
}

function showResult(outcome, o) {
  const insp = D.insp, mem = D.mem;
  mem.meet++; mem.claims = Array.from(new Set(mem.claims.concat(D.claims))).slice(-12);
  const R = $('#result'); R.hidden = false; $('#dlg').hidden = true;
  const card = $('#result-card');
  if (outcome === 'fine') {
    let amt = VIOL[D.viol].fine + (D.fled ? 100 : 0);
    if (o.rage) amt = Math.round(amt * 1.5);
    if (o.discount) amt = Math.round(amt * 0.9);
    SAVE.money -= amt; SAVE.stats.fines++; SAVE.stats.paid += amt; mem.fines++;
    GAME.achieve('firstFine');
    const no = '2026-' + String(Math.floor(Math.random() * 90000) + 10000);
    card.className = 'ticket';
    card.innerHTML = `
      <div class="t-head"><div><b>עיריית תל־אביב־יופי</b><small>מחלקת פיקוח עירוני · דוח בדיוני</small></div><div class="t-no">דוח מס׳<br><b>${no}</b></div></div>
      <div class="t-row"><span>עבירה</span><b>${VIOL[D.viol].name}${D.fled ? ' + התחמקות מפקח' : ''}</b></div>
      <div class="t-row"><span>מקום</span><b>${D.area}</b></div>
      <div class="t-row"><span>פקח</span><b>${insp.name} (${PERS[insp.pers].label})</b></div>
      <div class="t-sum"><span>לתשלום</span><b>₪${amt}</b>${o.rage ? '<em>כולל תוספת חוצפה</em>' : o.discount ? '<em>כולל הנחת אדם הגיוני</em>' : ''}</div>
      <div class="t-notes"><span>הערות הפקח</span><ul>${satireNotes(o).map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="stamp">קנס</div>`;
    SFX.stamp();
  } else {
    SAVE.stats.warnings++; mem.warns++; GAME.achieve('talker');
    const bonus = 15 + Math.round(D.trust / 5);
    SAVE.money += 0; SAVE.score += bonus * 10;
    card.className = 'ticket warn';
    card.innerHTML = `
      <div class="t-head"><div><b>אזהרה בלבד</b><small>השתחררת בלי קנס</small></div><div class="t-no">שכנוע<br><b>+${bonus * 10} נק׳</b></div></div>
      <div class="t-row"><span>פקח</span><b>${insp.name} (${PERS[insp.pers].label})</b></div>
      <div class="t-row"><span>אמון בסוף השיחה</span><b>${Math.round(D.trust)}%</b></div>
      <div class="t-row"><span>עצבים בסוף השיחה</span><b>${Math.round(D.anger)}%</b></div>
      <div class="t-notes"><span>מה קרה פה</span><ul>${(D.flags.laugh ? ['הצחקת את הפקח. זה עבד.'] : []).concat(D.flags.contra ? ['למרות שנתפסת בשקר. מזל.'] : [], [G(pick(['הפקח ויתר. הפעם. הוא כבר רשם את הפנים שלך.', 'יצאת מזה בזכות כישרון דיבור נדיר.', 'אל {{תתרגל|תתרגלי}} לזה.']))]).slice(0, 3).map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="stamp ok">אזהרה</div>`;
    SFX.yay();
  }
  saveGame(); GAME.refreshHud();
  $('#result-btn').focus();
}

function closeDialogue() {
  $('#dlg').hidden = true; $('#result').hidden = true; $('#hud').classList.remove('dim');
  clearInterval(_typeTimer);
  GAME.mode = 'play';
}
function resultContinue() {
  if (!D) { closeDialogue(); return; }
  const insp = D.insp; insp.release();
  D = null; closeDialogue();
  PLAYER.viol.redT = 0; PLAYER.viol.dangerT = 0; PLAYER.chaseTopSpeed = 0;
  GAME.flash(G('יאללה, {{תמשיך|תמשיכי}} לרכוב. בזהירות הפעם 😉'));
}
