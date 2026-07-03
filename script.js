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

// ── HERO KEYPAD ──
const heroKp = document.getElementById('heroKp');
['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'].forEach(l=>{
  const b = document.createElement('button');
  b.className = 'kp-mini' + (l==='🚨'?' em':'');
  b.textContent = l;
  b.onclick = ()=>{ b.style.background='rgba(28,109,208,0.3)'; setTimeout(()=>b.style.background='',250); };
  heroKp.appendChild(b);
});

// ── SIMULATION ──
const CODE = '12345';
let input = '', busy = false;

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
function setDoor(open){
  const el = document.getElementById('doorSt');
  el.className = 'door-state '+(open?'open':'closed');
  el.textContent = open ? '🔓 PUERTA ABIERTA' : '🚪 PUERTA CERRADA';
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
  await addDBRecord(input, 'ok', 'Empleado autorizado — Ingreso');
  setLed('lg',true); setDoor(true); setBuzzer(true,'Tono confirmación (1000 Hz)');
  setTimeout(()=>setBuzzer(false), 300);
  setTimeout(()=>{ setDoor(false); setLed('lg',false); log('🔒 Puerta cerrada. Sistema en espera.'); busy=false; }, 3000);
}
async function denied(){
  log('❌ Código incorrecto — Acceso denegado.');
  await addDBRecord(input, 'fail', 'Código incorrecto — Acceso denegado');
  setLed('lr',true); setBuzzer(true,'Alerta error (400 Hz)');
  setTimeout(()=>{ setLed('lr',false); setBuzzer(false); log('↩ Reiniciando ingreso...'); busy=false; }, 1500);
}
function sk(k){
  if(busy) return;
  if(k==='*'){ input=''; updateScreen(); log('🔄 Código borrado.'); return; }
  if(k==='#'){
    if(!input.length){ log('⚠️ Ingresá el código primero.'); return; }
    busy=true; log('🔍 Validando...');
    setTimeout(()=>{ input===CODE?granted():denied(); input=''; updateScreen(); }, 500);
    return;
  }
  if(input.length<5){ input+=k; updateScreen(); if(input.length===5) log('✏️ 5 dígitos ingresados. Presioná # para confirmar.'); }
}
async function simEmergency(){
  if(busy) return; busy=true;
  log('🚨 ¡EMERGENCIA ACTIVADA! Abriendo puerta...');
  await addDBRecord('——', 'em', 'Emergencia — Botón interno activado');
  setLed('lg',true); setDoor(true); setBuzzer(true,'🚨 ALARMA CONTINUA 1000 Hz');
  setTimeout(()=>{ setBuzzer(false); setDoor(false); setLed('lg',false); log('✅ Emergencia resuelta. Sistema reiniciado.'); busy=false; }, 5000);
}

// ── SCROLL REVEAL ──
const obs = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); });
},{ threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
