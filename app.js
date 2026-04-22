const SUPABASE_URL = window.ENV_SUPABASE_URL;
const SUPABASE_KEY = window.ENV_SUPABASE_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const { data, error } = await supabase.from('materials').select('*').order('num');
  if (!error) materials = data;
}

async function loadRolls() {
  const { data, error } = await supabase.from('rolls').select('*').order('received_at', { ascending: false });
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
      <div class="metric"><div
