const SUPABASE_URL = 'https://[your-project-id].supabase.co';
const SUPABASE_KEY = 'sb_publishable_...your key here...';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PRINTERS = ['Printer 1','Printer 2','Printer 3','Printer 4','Printer 5','Printer 6','Printer 7','Printer 8','Printer 9'];

let materials = [];
let rolls = [];
let slots = {};

PRINTERS.forEach(p => { slots[p] = Array(8).fill(null); });

async function init() {
  await loadMaterials();
  await loadRolls();
  renderApp();
}

async function loadMaterials() {
  const { data, error } = await db.from('materials').select('*').order('num');
  if (!error) materials = data;
}

async function loadRolls() {
  const { data, error } = await db.from('rolls').select('*').order('received_at', { ascending: false });
  if (!error) {
    rolls = data;
    PRINTERS.forEach(p => { slots[p] = Array(8).fill(null); });
    rolls.filter(r => r.status === 'hold').forEach(r => {
      if (r.location && r.slot_index !== null) slots[r.location][r.slot_index] = r.id;
    });
  }
}

function renderApp() {
  document.getElementById('app').innerHTML = `
    <div class="header">
      <h1>Press Floor Inventory</h1>
      <p>Roll receiving · printer hold grids · scan to run</p>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="showTab('dashboard',this)">Dashboard</button>
      <button class="tab" onclick="showTab('receive',this)">Receive rolls</button>
      <button class="tab" onclick="showTab('allocate',this)">Allocate</button>
      <button class="tab" onclick="showTab('grids',this)">Printer grids</button>
      <button class="tab" onclick="showTab('scan',this)">Scan / run</button>
      <button class="tab" onclick="showTab('log',this)">Log</button>
    </div>
    <div id="tab-dashboard" class="section active"></div>
    <div id="tab-receive" class="section"></div>
    <div id="tab-allocate" class="section"></div>
    <div id="tab-grids" class="section"></div>
    <div id="tab-scan" class="section"></div>
    <div id="tab-log" class="section"></div>
  `;
  renderDashboard();
}

function showTab(t, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + t).classList.add('active');
  const renders = { dashboard: renderDashboard, receive: renderReceive, allocate: renderAllocate, grids: renderGrids, scan: renderScan, log: renderLog };
  renders[t]();
}

function renderDashboard() {
  const el = document.getElementById('tab-dashboard');
  const inStock = rolls.filter(r => r.status === 'in-stock').length;
  const inHold = rolls.filter(r => r.status === 'hold').length;
  const running = rolls.filter(r => r.status === 'running').length;
  el.innerHTML = `
    <div class="grid4">
      <div class="metric"><div class="metric-label">Total rolls</div><div class="metric-value">${rolls.length}</div></div>
      <div class="metric"><div class="metric-label">In stock</div><div class="metric-value">${inStock}</div></div>
      <div class="metric"><div class="metric-label">In hold grid</div><div class="metric-value" style="color:#1565c0">${inHold}</div></div>
      <div class="metric"><div class="metric-label">On machine</div><div class="metric-value" style="color:#1b5e20">${running}</div></div>
    </div>
    <div class="card">
      <div class="card-title">All rolls</div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Roll ID</th><th>Material #</th><th>Description</th><th>Weight</th><th>Status</th><th>Location</th></tr></thead>
          <tbody>${rolls.length ? rolls.map(r => `
            <tr>
              <td style="font-family:monospace">${r.id}</td>
              <td>${r.mat_num}</td>
              <td>${r.mat_desc}</td>
              <td>${r.weight}lb</td>
              <td>${statusBadge(r.status)}</td>
              <td style="color:#888;font-size:12px">${r.location || '—'}${r.slot_index !== null && r.status === 'hold' ? ' · Slot ' + (r.slot_index + 1) : ''}</td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="no-data">No rolls yet.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function statusBadge(s) {
  if (s === 'in-stock') return '<span class="badge badge-ok">In stock</span>';
  if (s === 'hold') return '<span class="badge badge-hold">In hold grid</span>';
  if (s === 'running') return '<span class="badge badge-run">On machine</span>';
  return '<span class="badge">—</span>';
}

function renderReceive() {
  const el = document.getElementById('tab-receive');
  const matOpts = materials.map(m => `<option value="${m.num}">${m.num} — ${m.description}</option>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-title">Receive a new roll</div>
      <div class="form-row">
        <div class="fg"><label>Material #</label><select id="rx-mat">${matOpts || '<option>No materials yet</option>'}</select></div>
        <div class="fg"><label>Weight (lb)</label><input type="number" id="rx-wt" min="1" placeholder="e.g. 850"></div>
        <div class="fg" style="justify-content:flex-end"><button class="btn btn-primary" onclick="receiveRoll()">Receive roll</button></div>
      </div>
      <div class="msg" id="rx-msg"></div>
    </div>
    <div class="card">
      <div class="card-title">Material types</div>
      <div class="form-row">
        <div class="fg"><label>Material #</label><input type="text" id="mt-num" placeholder="e.g. M-1006"></div>
        <div class="fg"><label>Description</label><input type="text" id="mt-desc" placeholder="e.g. 90lb Gloss Text"></div>
        <div class="fg"><label>Size</label><input type="text" id="mt-size" placeholder='e.g. 8.5x11"'></div>
        <div class="fg" style="justify-content:flex-end"><button class="btn btn-primary" onclick="addMaterial()">Add material</button></div>
      </div>
      <div class="msg" id="mt-msg"></div>
      <table style="margin-top:10px">
        <thead><tr><th>Material #</th><th>Description</th><th>Size</th><th>Rolls in stock</th><th></th></tr></thead>
        <tbody id="mt-table"></tbody>
      </table>
    </div>`;
  renderMaterialTable();
}

function renderMaterialTable() {
  const tb = document.getElementById('mt-table');
  if (!tb) return;
  tb.innerHTML = materials.map(m => {
    const cnt = rolls.filter(r => r.mat_num === m.num && r.status === 'in-stock').length;
    return `<tr><td>${m.num}</td><td>${m.description}</td><td>${m.size || '—'}</td><td>${cnt}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteMaterial('${m.num}')">Remove</button></td></tr>`;
  }).join('') || '<tr><td colspan="5"><div class="no-data">No materials yet.</div></td></tr>';
}

async function addMaterial() {
  const num = document.getElementById('mt-num').value.trim();
  const description = document.getElementById('mt-desc').value.trim();
  const size = document.getElementById('mt-size').value.trim();
  const msg = document.getElementById('mt-msg');
  if (!num || !description) { msg.textContent = 'Material # and description required.'; msg.className = 'msg err'; return; }
  const { error } = await db.from('materials').insert({ num, description, size });
  if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
  msg.textContent = `Added ${num}.`; msg.className = 'msg';
  await loadMaterials();
  renderMaterialTable();
  ['mt-num','mt-desc','mt-size'].forEach(id => document.getElementById(id).value = '');
  setTimeout(() => msg.textContent = '', 3000);
}

async function deleteMaterial(num) {
  if (!confirm(`Remove material type ${num}?`)) return;
  await db.from('materials').delete().eq('num', num);
  await loadMaterials();
  renderMaterialTable();
}async function receiveRoll() {
  const matNum = document.getElementById('rx-mat').value;
  const wt = parseFloat(document.getElementById('rx-wt').value);
  const msg = document.getElementById('rx-msg');
  if (!matNum || !wt || wt <= 0) { msg.textContent = 'Select a material and enter a valid weight.'; msg.className = 'msg err'; return; }
  const mat = materials.find(m => m.num === matNum);
  const { data: existing } = await db.from('rolls').select('id').order('id', { ascending: false }).limit(1);
  let nextNum = 1;
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].id.replace('R-', ''));
    nextNum = lastNum + 1;
  }
  const id = 'R-' + String(nextNum).padStart(4, '0');
  const { error } = await db.from('rolls').insert({ id, mat_num: matNum, mat_desc: mat.description, weight: wt, status: 'in-stock', location: 'Warehouse' });
  if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
  await db.from('event_log').insert({ event: 'Received', roll_id: id, mat_num: matNum, weight: wt, notes: `Received into stock at ${wt}lb` });
  msg.textContent = `Roll ${id} received (${matNum} · ${wt}lb).`; msg.className = 'msg';
  document.getElementById('rx-wt').value = '';
  await loadRolls();
  renderMaterialTable();
  setTimeout(() => msg.textContent = '', 3000);
}

function renderAllocate() {
  const el = document.getElementById('tab-allocate');
  const inStock = rolls.filter(r => r.status === 'in-stock');
  const rollOpts = inStock.map(r => `<option value="${r.id}">${r.id} — ${r.mat_num} · ${r.weight}lb</option>`).join('');
  const printOpts = PRINTERS.map(p => `<option value="${p}">${p} (${slots[p].filter(s => s !== null).length}/8 used)</option>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-title">Move roll to printer hold grid</div>
      ${inStock.length === 0 ? '<div class="no-data">No rolls in stock. Receive rolls first.</div>' : ''}
      <div class="form-row">
        <div class="fg"><label>Roll</label><select id="al-roll">${rollOpts || '<option>No rolls in stock</option>'}</select></div>
        <div class="fg"><label>Printer</label><select id="al-printer">${printOpts}</select></div>
        <div class="fg"><label>Job # (optional)</label><input type="text" id="al-job" placeholder="e.g. JOB-5521"></div>
        <div class="fg" style="justify-content:flex-end"><button class="btn btn-primary" onclick="allocateRoll()">Place in hold</button></div>
      </div>
      <div class="msg" id="al-msg"></div>
    </div>
    <div class="card">
      <div class="card-title">Currently in hold grids</div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Roll ID</th><th>Material</th><th>Weight</th><th>Printer</th><th>Slot</th><th>Job #</th></tr></thead>
          <tbody>${rolls.filter(r => r.status === 'hold').map(r => `
            <tr>
              <td style="font-family:monospace">${r.id}</td>
              <td>${r.mat_num}</td><td>${r.weight}lb</td>
              <td>${r.location}</td><td>Slot ${r.slot_index + 1}</td>
              <td style="color:#888">${r.job_num || '—'}</td>
            </tr>`).join('') || '<tr><td colspan="6"><div class="no-data">No rolls in hold.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function allocateRoll() {
  const rollId = document.getElementById('al-roll').value;
  const printer = document.getElementById('al-printer').value;
  const jobNum = document.getElementById('al-job').value.trim();
  const msg = document.getElementById('al-msg');
  if (!rollId) { msg.textContent = 'Select a roll.'; msg.className = 'msg err'; return; }
  const freeSlot = slots[printer].findIndex(s => s === null);
  if (freeSlot === -1) { msg.textContent = `${printer} is full (8/8 slots).`; msg.className = 'msg err'; return; }
  const { error } = await db.from('rolls').update({ status: 'hold', location: printer, slot_index: freeSlot, job_num: jobNum || null }).eq('id', rollId);
  if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
  await db.from('event_log').insert({ event: 'To hold grid', roll_id: rollId, mat_num: rolls.find(r => r.id === rollId)?.mat_num, weight: rolls.find(r => r.id === rollId)?.weight, notes: `Placed in ${printer} slot ${freeSlot + 1}${jobNum ? ' for job ' + jobNum : ''}` });
  msg.textContent = `${rollId} placed in ${printer} slot ${freeSlot + 1}.`; msg.className = 'msg';
  await loadRolls();
  setTimeout(() => { msg.textContent = ''; renderAllocate(); }, 2500);
}

function renderGrids() {
  const el = document.getElementById('tab-grids');
  el.innerHTML = `
    <div class="printer-grid-wrap">${PRINTERS.map(p => printerCardHTML(p)).join('')}</div>
    <div class="legend" style="margin-top:14px;">
      <span><span class="legend-dot" style="background:#fafafa;border:1px solid #e8e8e8;"></span>Empty</span>
      <span><span class="legend-dot" style="background:#e3f2fd;border:1px solid #90caf9;"></span>Roll in hold</span>
      <span><span class="legend-dot" style="background:#e8f5e9;border:1px solid #a5d6a7;"></span>On machine</span>
    </div>`;
}

function printerCardHTML(printer) {
  const used = slots[printer].filter(s => s !== null).length;
  const slotsHTML = slots[printer].map((rid, i) => {
    if (!rid) return `<div class="slot empty"><span class="slot-num">${i + 1}</span><span class="slot-empty-label">Empty</span></div>`;
    const roll = rolls.find(r => r.id === rid);
    if (!roll) return `<div class="slot empty"><span class="slot-num">${i + 1}</span><span class="slot-empty-label">Empty</span></div>`;
    const cls = roll.status === 'running' ? 'running' : 'occupied';
    return `<div class="slot ${cls}" onclick="goToScan('${rid}')">
      <span class="slot-num">${i + 1}</span>
      <span class="slot-mat">${roll.mat_num}</span>
      <span class="slot-wt">${roll.weight}lb</span>
      ${roll.job_num ? `<span class="slot-job">${roll.job_num}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="printer-card">
    <div class="printer-name">${printer} <span style="font-weight:400;color:#888;font-size:12px;">${used}/8 slots</span></div>
    <div class="slot-grid">${slotsHTML}</div>
  </div>`;
}

function goToScan(rid) {
  const btn = document.querySelectorAll('.tab')[4];
  showTab('scan', btn);
  setTimeout(() => {
    const inp = document.getElementById('scan-input');
    if (inp) { inp.value = rid; previewRoll(); }
  }, 100);
}

function renderScan() {
  const el = document.getElementById('tab-scan');
  el.innerHTML = `
    <div class="card">
      <div class="card-title">Scan roll to put on machine</div>
      <p style="font-size:13px;color:#888;margin-bottom:12px;">Scan QR code or type Roll ID to mark it as running and clear it from the hold grid.</p>
      <div class="scan-row">
        <input type="text" id="scan-input" placeholder="Roll ID — e.g. R-0001" oninput="previewRoll()">
        <button class="btn btn-primary" onclick="confirmRun()">Mark as running</button>
      </div>
      <div id="scan-preview"></div>
      <div class="msg" id="scan-msg"></div>
    </div>
    <div class="card">
      <div class="card-title">Generate QR code for a roll</div>
      <div class="form-row">
        <div class="fg"><label>Select roll</label>
          <select id="qr-sel" onchange="generateQR()">
            <option value="">Select a roll...</option>
            ${rolls.map(r => `<option value="${r.id}">${r.id} — ${r.mat_num} · ${r.weight}lb (${r.status})</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="qr-output" style="margin-top:12px;"></div>
    </div>`;
}

function previewRoll() {
  const val = document.getElementById('scan-input').value.trim().toUpperCase();
  const prev = document.getElementById('scan-preview');
  if (!val) { prev.innerHTML = ''; return; }
  const roll = rolls.find(r => r.id === val);
  if (!roll) { prev.innerHTML = `<div style="font-size:13px;color:#c0392b;margin-top:8px;">Roll "${val}" not found.</div>`; return; }
  if (roll.status === 'running') { prev.innerHTML = `<div style="font-size:13px;color:#e67e22;margin-top:8px;">${val} is already on machine.</div>`; return; }
  if (roll.status === 'in-stock') { prev.innerHTML = `<div style="font-size:13px;color:#e67e22;margin-top:8px;">${val} is in stock — allocate to a printer first.</div>`; return; }
  prev.innerHTML = `<div style="background:#f5f5f5;border-radius:8px;padding:10px 14px;font-size:13px;margin-top:8px;">
    <strong>${roll.id}</strong> · ${roll.mat_num} — ${roll.mat_desc}<br>
    <span style="color:#888">Weight: ${roll.weight}lb · ${roll.location} Slot ${roll.slot_index + 1}${roll.job_num ? ' · Job: ' + roll.job_num : ''}</span>
  </div>`;
}

async function confirmRun() {
  const val = document.getElementById('scan-input').value.trim().toUpperCase();
  const msg = document.getElementById('scan-msg');
  const roll = rolls.find(r => r.id === val);
  if (!roll) { msg.textContent = 'Roll not found.'; msg.className = 'msg err'; return; }
  if (roll.status !== 'hold') { msg.textContent = 'Roll must be in a hold grid to scan to run.'; msg.className = 'msg err'; return; }
  const { error } = await db.from('rolls').update({ status: 'running', ran_at: new Date().toISOString() }).eq('id', val);
  if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
  await db.from('event_log').insert({ event: 'On machine', roll_id: roll.id, mat_num: roll.mat_num, weight: roll.weight, notes: `Scanned to run on ${roll.location}` });
  msg.textContent = `${roll.id} is now running on ${roll.location}. Slot ${roll.slot_index + 1} cleared.`; msg.className = 'msg';
  document.getElementById('scan-input').value = '';
  document.getElementById('scan-preview').innerHTML = '';
  await loadRolls();
  setTimeout(() => msg.textContent = '', 4000);
}

function generateQR() {
  const sel = document.getElementById('qr-sel').value;
  const out = document.getElementById('qr-output');
  if (!sel) { out.innerHTML = ''; return; }
  const roll = rolls.find(r => r.id === sel);
  if (!roll) return;
  out.innerHTML = `<div class="qr-box">
    <div id="qr-canvas"></div>
    <div class="qr-label" style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:8px;">${roll.id}</div>
    <div class="qr-label">${roll.mat_num} · ${roll.mat_desc}</div>
    <div class="qr-label">Weight: ${roll.weight}lb${roll.job_num ? ' · ' + roll.job_num : ''}</div>
    <div class="qr-label" style="margin-top:4px;font-size:11px;">Scan to mark as running</div>
  </div>`;
  if (typeof QRCode !== 'undefined') {
    new QRCode(document.getElementById('qr-canvas'), { text: roll.id, width: 128, height: 128, colorDark: '#000000', colorLight: '#ffffff' });
  }
}

async function renderLog() {
  const el = document.getElementById('tab-log');
  el.innerHTML = '<div class="loading">Loading...</div>';
  const { data, error } = await db.from('event_log').select('*').order('time', { ascending: false }).limit(200);
  if (error) { el.innerHTML = `<div class="no-data">${error.message}</div>`; return; }
  el.innerHTML = `<div class="card">
    <div class="card-title">Event log</div>
    ${!data.length ? '<div class="no-data">No events yet.</div>' : `
    <div style="overflow-x:auto;"><table>
      <thead><tr><th>Time</th><th>Event</th><th>Roll ID</th><th>Material</th><th>Weight</th><th>Notes</th></tr></thead>
      <tbody>${data.map(e => `
        <tr>
          <td style="font-size:12px;color:#888;white-space:nowrap;">${new Date(e.time).toLocaleString()}</td>
          <td>${e.event}</td>
          <td style="font-family:monospace;font-size:12px;">${e.roll_id}</td>
          <td>${e.mat_num}</td>
          <td>${e.weight}lb</td>
          <td style="color:#888;font-size:12px;">${e.notes}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>`;
}

init();
