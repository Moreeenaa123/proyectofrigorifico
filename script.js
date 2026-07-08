// ── FROST PARTICLES ──
const fw = document.getElementById('frostWrap');
for(let i=0;i<18;i++){
  const p = document.createElement('div');
  p.className = 'frost-particle';
  const size = 60 + Math.random()*140;
  p.style.cssText = `
    width:${size}px; height:${size}px;
    left:${Math.random()*100}%;
    bottom:${-size}px;
    animation-duration:${12+Math.random()*20}s;
    animation-delay:${Math.random()*15}s;
  `;
  fw.appendChild(p);
}

// ── SOUND ENGINE (Web Audio API) ──
// Genera cada sonido en tiempo real, sin archivos externos.
let audioCtx = null;
let soundOn = true;

function ensureAudio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration = 200, opts = {}){
  if(!soundOn) return;
  const { type = 'sine', vol = 0.18, delay = 0, glideTo = null } = opts;
  const ctx = ensureAudio();
  const t0 = ctx.currentTime + delay / 1000;
  const t1 = t0 + duration / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if(glideTo) osc.frequency.linearRampToValueAtTime(glideTo, t1);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.linearRampToValueAtTime(0, t1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1 + 0.03);
}

function sndTick(){ playTone(1500, 40, { type:'square', vol:0.07 }); }
function sndClear(){ playTone(650, 90, { type:'triangle', vol:0.12, glideTo:400 }); }
function sndGranted(){
  playTone(1000, 130, { type:'sine', vol:0.22 });
  playTone(1400, 240, { type:'sine', vol:0.2, delay:130 });
}
function sndDenied(){
  playTone(400, 480, { type:'sawtooth', vol:0.16 });
}
function sndLock(){
  playTone(500, 150, { type:'square', vol:0.16 });
  playTone(500, 150, { type:'square', vol:0.16, delay:220 });
  playTone(500, 150, { type:'square', vol:0.16, delay:440 });
}
function sndUnlock(){
  playTone(700, 90, { type:'triangle', vol:0.14 });
  playTone(1100, 140, { type:'triangle', vol:0.16, delay:100 });
}

let sirenTimer = null;
function sndSirenStart(){
  if(sirenTimer || !soundOn) return;
  let high = true;
  const fire = ()=>{ playTone(high ? 1000 : 700, 260, { type:'square', vol:0.16 }); high = !high; };
  fire();
  sirenTimer = setInterval(fire, 280);
}
function sndSirenStop(){
  clearInterval(sirenTimer);
  sirenTimer = null;
}

function toggleSound(){
  soundOn = !soundOn;
  const btn = document.getElementById('soundToggle');
  if(btn) btn.textContent = soundOn ? '🔊' : '🔇';
  if(soundOn) ensureAudio(); else sndSirenStop();
}

function setDeviceState(state){
  const el = document.querySelector('.sim-device');
  if(!el) return;
  el.classList.remove('st-ok','st-err','st-em');
  if(state) el.classList.add(state);
}

// ── HERO KEYPAD ──
const heroKp = document.getElementById('heroKp');
['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'].forEach(l=>{
  const b = document.createElement('button');
  b.className = 'kp-mini' + (l==='🚨'?' em':'');
  b.textContent = l;
  b.onclick = ()=>{ sndTick(); b.style.background='rgba(28,109,208,0.3)'; setTimeout(()=>b.style.background='',250); };
  heroKp.appendChild(b);
});

// ── SIMULATION ──
const CODE = '12345';
const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 8;
let input = '', busy = false, locked = false, attempts = 0, lockInterval = null, emergencyRunning = false;

// ── DATABASE (persiste con window.storage — sin límite de registros) ──
const DB_KEY = 'frigosec_registros';

let dbRecords = [];
let countOk   = 0;
let countFail = 0;
let countEm   = 0;
let rowCounter = 0;
let dbReady = false; // flag para no agregar hasta que cargue

async function loadDB() {
  try {
    const result = await window.storage.get(DB_KEY);
    if (result && result.value) {
      dbRecords = JSON.parse(result.value);
    } else {
      dbRecords = [];
    }
  } catch(e) {
    dbRecords = [];
  }
  countOk   = dbRecords.filter(r=>r.type==='ok').length;
  countFail = dbRecords.filter(r=>r.type==='fail').length;
  countEm   = dbRecords.filter(r=>r.type==='em').length;
  rowCounter = dbRecords.length > 0 ? Math.max(...dbRecords.map(r=>r.n||0)) : 0;
  dbReady = true;
  document.getElementById('countOk').textContent   = countOk;
  document.getElementById('countFail').textContent = countFail;
  document.getElementById('countEm').textContent   = countEm;
  renderDB();
}

async function saveDB(records) {
  try {
    await window.storage.set(DB_KEY, JSON.stringify(records));
  } catch(e) {
    console.warn('Error guardando registros:', e);
  }
}

function getNow() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2,'0');
  const mm   = String(now.getMonth()+1).padStart(2,'0');
  const yyyy = now.getFullYear();
  const hh   = String(now.getHours()).padStart(2,'0');
  const min  = String(now.getMinutes()).padStart(2,'0');
  const ss   = String(now.getSeconds()).padStart(2,'0');
  return { fecha: `${dd}/${mm}/${yyyy}`, hora: `${hh}:${min}:${ss}` };
}

async function addDBRecord(code, type, desc) {
  if (!dbReady) return;
  const { fecha, hora } = getNow();
  rowCounter++;
  const rec = { n: rowCounter, code, fecha, hora, type, desc };
  dbRecords.unshift(rec);          // agrega al principio (más reciente primero)
  await saveDB(dbRecords);         // guarda TODOS los registros persistentemente

  if (type === 'ok')   countOk++;
  if (type === 'fail') countFail++;
  if (type === 'em')   countEm++;

  document.getElementById('countOk').textContent   = countOk;
  document.getElementById('countFail').textContent = countFail;
  document.getElementById('countEm').textContent   = countEm;

  renderDB();
}

function renderDB() {
  const body  = document.getElementById('dbBody');
  const empty = document.getElementById('dbEmpty');
  if (dbRecords.length === 0) {
    body.innerHTML = '';
    body.appendChild(empty);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  // Muestra TODOS los registros sin límite
  body.innerHTML = dbRecords.map((r, i) => {
    let badgeClass = '', badgeLabel = '';
    if (r.type === 'ok')   { badgeClass = 'badge-ok';   badgeLabel = '✅ Autorizado'; }
    if (r.type === 'fail') { badgeClass = 'badge-fail'; badgeLabel = '❌ Denegado'; }
    if (r.type === 'em')   { badgeClass = 'badge-em';   badgeLabel = '🚨 Emergencia'; }
    const maskedCode = r.type === 'em' ? '— — — — —' : (r.code && r.code !== '——' ? r.code.split('').map(()=>'●').join(' ') : '— — — — —');
    return `
    <div class="db-row">
      <div class="db-td db-row-num">${r.n || (dbRecords.length - i)}</div>
      <div class="db-td"><span class="db-code-badge">${maskedCode}</span></div>
      <div class="db-td db-date">${r.fecha}</div>
      <div class="db-td db-time">${r.hora}</div>
      <div class="db-td"><span class="db-badge ${badgeClass}">${badgeLabel}</span> <span style="margin-left:0.5rem;font-size:0.78rem;color:rgba(11,19,43,0.5)">${r.desc}</span></div>
    </div>`;
  }).join('');
}

// Inicializar: carga todos los registros guardados
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
});

async function clearDB() {
  if (!confirm('¿Seguro que querés borrar todos los registros? Esta acción no se puede deshacer.')) return;
  dbRecords = []; rowCounter = 0; countOk = 0; countFail = 0; countEm = 0;
  await saveDB([]);
  document.getElementById('countOk').textContent = 0;
  document.getElementById('countFail').textContent = 0;
  document.getElementById('countEm').textContent = 0;
  const body = document.getElementById('dbBody');
  const empty = document.getElementById('dbEmpty');
  body.innerHTML = '';
  body.appendChild(empty);
  empty.style.display = 'block';
}

function log(msg){
  const el = document.getElementById('logBox');
  el.innerHTML += '<br>' + msg;
  el.scrollTop = el.scrollHeight;
}
function setLed(id, on){
  const cls = id==='lg'?'green':'red';
  document.getElementById(id).className = 'led' + (on?' '+cls:'');
}
function updateAttemptDots(){
  for(let i=1;i<=3;i++){
    const d = document.getElementById('adot'+i);
    if(d) d.classList.toggle('used', i <= attempts);
  }
}
// state: 'closed' | 'opening' | 'open' | 'locked'
function setDoorVisual(state){
  const curtain = document.getElementById('doorCurtain');
  const chamber = document.getElementById('doorChamber');
  const overlay = document.getElementById('lockOverlay');
  const st = document.getElementById('doorSt');
  if(!curtain) return;
  const isOpen = (state === 'open' || state === 'opening');
  curtain.classList.toggle('open', isOpen);
  chamber.classList.toggle('active', isOpen);
  overlay.classList.toggle('show', state === 'locked');
  st.className = (state === 'locked' ? 'locked' : (isOpen ? 'open' : 'closed'));
  if(state === 'locked') return; // el texto lo maneja lockSystem() con la cuenta regresiva
  st.textContent = isOpen ? '🔓 Puerta abierta' : '🚪 Puerta cerrada';
}
function setDoor(open){ setDoorVisual(open ? 'open' : 'closed'); }

function lockSystem(){
  locked = true; busy = true;
  document.querySelector('.sim-kp').classList.add('is-locked');
  setDoorVisual('locked');
  setDeviceState('st-err');
  sndLock();
  log('⛔ 3 intentos fallidos — sistema bloqueado ' + LOCK_SECONDS + 's.');
  const st = document.getElementById('doorSt');
  let t = LOCK_SECONDS;
  st.textContent = '⛔ Bloqueada · ' + t + 's';
  lockInterval = setInterval(()=>{
    t--;
    if(t <= 0){ unlockSystem(); }
    else { st.textContent = '⛔ Bloqueada · ' + t + 's'; }
  }, 1000);
}
function unlockSystem(){
  if(lockInterval){ clearInterval(lockInterval); lockInterval = null; }
  locked = false; attempts = 0; busy = false;
  updateAttemptDots();
  document.querySelector('.sim-kp').classList.remove('is-locked');
  setDoorVisual('closed');
  setDeviceState(null);
  sndUnlock();
  log('🔓 Bloqueo finalizado. Sistema en espera.');
}
function setBuzzer(on, label=''){
  const el = document.getElementById('bz');
  el.className = 'buzzer-row'+(on?' active':'');
  el.textContent = on ? '🔔 '+label : '🔇 Buzzer inactivo';
}
function updateScreen(){
  const shown = input.split('').map(()=>'●').join(' ');
  document.getElementById('simScreen').textContent = shown || '_ _ _ _ _';
}
async function granted(){
  log('✅ Código correcto — Acceso concedido.');
  sndGranted();
  setDeviceState('st-ok');
  attempts = 0; updateAttemptDots();
  await addDBRecord(input, 'ok', 'Empleado autorizado — Ingreso');
  setLed('lg',true); setDoor(true); setBuzzer(true,'Tono confirmación (1000 Hz)');
  setTimeout(()=>setBuzzer(false), 300);
  setTimeout(()=>{ setDoor(false); setLed('lg',false); setDeviceState(null); log('🔒 Puerta cerrada. Sistema en espera.'); busy=false; }, 3000);
}
async function denied(){
  log('❌ Código incorrecto — Acceso denegado.');
  sndDenied();
  setDeviceState('st-err');
  attempts++; updateAttemptDots();
  await addDBRecord(input, 'fail', 'Código incorrecto — Acceso denegado');
  setLed('lr',true); setBuzzer(true,'Alerta error (400 Hz)');
  setTimeout(()=>{
    setLed('lr',false); setBuzzer(false); setDeviceState(null);
    if(attempts >= MAX_ATTEMPTS){ lockSystem(); }
    else { log('↩ Reiniciando ingreso...'); busy=false; }
  }, 1500);
}
function sk(k){
  if(locked){ sndDenied(); log('⛔ Sistema bloqueado. Esperá la cuenta regresiva.'); return; }
  if(busy) return;
  if(k==='*'){ sndClear(); input=''; updateScreen(); log('🔄 Código borrado.'); return; }
  if(k==='#'){
    if(!input.length){ sndDenied(); log('⚠️ Ingresá el código primero.'); return; }
    sndTick();
    busy=true; log('🔍 Validando...');
    setTimeout(()=>{ input===CODE?granted():denied(); input=''; updateScreen(); }, 500);
    return;
  }
  sndTick();
  if(input.length<5){ input+=k; updateScreen(); if(input.length===5) log('✏️ 5 dígitos ingresados. Presioná # para confirmar.'); }
}
async function simEmergency(){
  if(emergencyRunning) return;
  emergencyRunning = true;
  if(locked){ // la emergencia siempre tiene prioridad y libera el bloqueo al instante
    if(lockInterval){ clearInterval(lockInterval); lockInterval = null; }
    locked = false; attempts = 0; updateAttemptDots();
    document.querySelector('.sim-kp').classList.remove('is-locked');
  }
  busy = true;
  log('🚨 ¡EMERGENCIA ACTIVADA! Abriendo puerta...');
  sndSirenStart();
  setDeviceState('st-em');
  await addDBRecord('——', 'em', 'Emergencia — Botón interno activado');
  setLed('lg',true); setDoor(true); setBuzzer(true,'🚨 ALARMA CONTINUA 1000 Hz');
  setTimeout(()=>{
    sndSirenStop();
    setBuzzer(false); setDoor(false); setLed('lg',false); setDeviceState(null);
    log('✅ Emergencia resuelta. Sistema reiniciado.'); busy=false; emergencyRunning=false;
  }, 5000);
}

// ── SCROLL REVEAL ──
const obs = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); });
},{ threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
