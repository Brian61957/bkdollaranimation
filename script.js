/* BK Dollar Animation — Full build (Login, Chart, Bot Builder, Run File) */
/* App settings */
const APP_ID = 96054;
const REDIRECT_URI = window.location.origin + window.location.pathname;
const API_WS = "wss://ws.derivws.com/websockets/v3";

let ws = null;
let derivToken = null;
let accountInfo = null;
let balanceVal = null;

/* --- Utilities --- */
const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelectorAll(sel);

/* --- Initial boot --- */
window.addEventListener('DOMContentLoaded', () => {
  // Loader
  setTimeout(()=>{ $('loader').style.display = 'none'; }, 800);

  // Wire nav
  qs('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qs('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      qs('main section').forEach(s => s.classList.add('hidden'));
      const el = $(page);
      if (el){
        el.classList.remove('hidden');
        // Chart full-screen UX: hide topbar/nav for maximum space
        if (page === 'chart') {
          document.getElementById('topbar').style.display = 'none';
          document.getElementById('nav').style.display = 'none';
        } else {
          document.getElementById('topbar').style.display = 'flex';
          document.getElementById('nav').style.display = 'flex';
        }
      }
    });
  });

  // Auth buttons
  $('signin-btn').addEventListener('click', () => {
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  });
  $('logout-btn').addEventListener('click', doLogout);

  // Handle redirect token from OAuth (token1 param)
  const params = new URLSearchParams(window.location.search);
  const tokenParam = params.get('token1');
  if (tokenParam){
    localStorage.setItem('deriv_token', tokenParam);
    history.replaceState(null, '', REDIRECT_URI);
  }
  derivToken = localStorage.getItem('deriv_token');

  // If token present, init connection and UI
  if (derivToken) initDerivConnection();

  // Populate strategy list from known files (should exist in project root)
  const known = ['digit_over_3.xml','leo_even_odd.xml','rf_market_monitor.xml'];
  populateStrategies(known);

  // Wire Run Bot file upload
  $('file-input').addEventListener('change', handleFileUpload);
  $('simulate-run').addEventListener('click', simulateRun);
  $('load-into-run').addEventListener('click', loadSelectedIntoRun);
  // send-live remains hidden unless user wants to enable real send
  $('send-live').addEventListener('click', sendLiveToDeriv);

});

/* --- WebSocket / Deriv connection --- */
function initDerivConnection(){
  if (!derivToken) return;
  // open WS
  ws = new WebSocket(API_WS);
  ws.onopen = () => {
    logRun('WebSocket open — authorizing...');
    ws.send(JSON.stringify({ authorize: derivToken }));
  };
  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.msg_type === 'authorize') {
        accountInfo = data.authorize;
        updateAccountUI();
        // request balance
        ws.send(JSON.stringify({ balance: 1 }));
        logRun('Authorized. Account: ' + (accountInfo.loginid || 'unknown'));
      } else if (data.msg_type === 'balance') {
        balanceVal = data.balance;
        updateBalanceUI();
      } else {
        // keep other messages for debugging
        // console.log('WS:', data);
      }
    } catch(e){ console.error('WS parse error', e); }
  };
  ws.onerror = (err) => {
    console.error('WS error', err);
    logRun('WebSocket error. See console.');
  };
  ws.onclose = () => {
    logRun('WebSocket closed.');
  };
}

/* --- UI update functions --- */
function updateAccountUI(){
  if (!accountInfo) return;
  const isVirtual = !!accountInfo.is_virtual;
  const statusEl = $('status');
  statusEl.classList.remove('hidden');
  statusEl.textContent = isVirtual ? 'Demo' : 'Real';
  statusEl.style.background = isVirtual ? 'transparent' : 'var(--success)';
  statusEl.style.color = isVirtual ? 'var(--danger)' : '#000';

  $('first-name').textContent = accountInfo.first_name || accountInfo.full_name?.split(' ')[0] || '';
  $('signin-btn').classList.add('hidden');
  $('logout-btn').classList.remove('hidden');
}

function updateBalanceUI(){
  if (!balanceVal) return;
  $('balance').textContent = Number(balanceVal.balance).toFixed(2);
  $('currency').textContent = balanceVal.currency || '';
  $('flag').textContent = (balanceVal.currency === 'USD') ? '🇺🇸' : '';
}

/* --- Logout --- */
function doLogout(){
  localStorage.removeItem('deriv_token');
  derivToken = null;
  if (ws) { try{ ws.close() }catch(e){} ws=null; }
  $('status').classList.add('hidden');
  $('flag').textContent = '';
  $('balance').textContent = '';
  $('currency').textContent = '';
  $('first-name').textContent = '';
  $('signin-btn').classList.remove('hidden');
  $('logout-btn').classList.add('hidden');
  logRun('Logged out.');
}

/* --- Strategies (Bot Builder) --- */
function populateStrategies(list){
  const container = $('strategies');
  container.innerHTML = '';
  list.forEach(fname => {
    const card = document.createElement('div');
    card.className = 'strategy-card';
    card.innerHTML = `
      <strong>${fname}</strong>
      <div style="margin-top:8px">
        <button class="btn small" data-file="${fname}">Preview</button>
        <button class="btn small" data-load="${fname}">Load</button>
      </div>
    `;
    container.appendChild(card);
  });

  // wire preview buttons
  container.querySelectorAll('[data-file]').forEach(b => b.addEventListener('click', async (e) => {
    const f = e.currentTarget.dataset.file;
    try {
      const txt = await fetchLocalFile(f);
      $('strategy-code').textContent = txt;
      $('load-into-run').classList.remove('hidden');
      // store selected in dataset for loading
      $('load-into-run').dataset.content = txt;
      $('load-into-run').dataset.filename = f;
    } catch(err){
      $('strategy-code').textContent = `Error loading ${f}. Make sure the file exists in the project root.`;
      $('load-into-run').classList.add('hidden');
    }
  }));

  // wire load buttons (quick load directly)
  container.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', async (e) => {
    const f = e.currentTarget.dataset.load;
    try {
      const txt = await fetchLocalFile(f);
      $('uploaded-strategy').textContent = txt;
      $('simulate-run').classList.remove('hidden');
      $('send-live').classList.remove('hidden');
      logRun(`Loaded strategy ${f} into Run Bot.`);
    } catch(err){
      logRun(`Failed to load ${f}: ${err}`);
    }
  }));
}

/* fetch local file (requires project to be served via http(s) or local server) */
async function fetchLocalFile(filename){
  const res = await fetch(filename, {cache: "no-store"});
  if (!res.ok) throw new Error('Not found');
  return await res.text();
}

/* --- Run Bot from File: upload handling --- */
function handleFileUpload(e){
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const txt = ev.target.result;
    $('uploaded-strategy').textContent = txt;
    $('simulate-run').classList.remove('hidden');
    $('send-live').classList.remove('hidden');
    logRun(`File "${f.name}" loaded for preview.`);
  };
  reader.readAsText(f);
}

/* load selected preview into run tab (from Bot Builder) */
function loadSelectedIntoRun(){
  const content = $('load-into-run').dataset.content;
  if (!content) return alert('No strategy selected.');
  $('uploaded-strategy').textContent = content;
  // switch to run tab
  qs('.nav-btn').forEach(b => b.classList.remove('active'));
  qs('.nav-btn[data-page="runbot"]')[0].classList.add('active');
  qs('main section').forEach(s => s.classList.add('hidden'));
  $('runbot').classList.remove('hidden');
  $('simulate-run').classList.remove('hidden');
  $('send-live').classList.remove('hidden');
  logRun('Strategy loaded into Run Bot.');
}

/* simulate run (local only) */
function simulateRun(){
  const xml = $('uploaded-strategy').textContent;
  if (!xml || xml.trim().length < 10) return alert('No strategy loaded.');
  logRun('--- SIMULATION START ---');
  logRun('Parsing strategy XML (simulation)...');
  // Basic parse: show root tag names and some attributes (simple, not full XML parser)
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) {
    logRun('XML parse error — invalid XML.');
    return;
  }
  // Example: list top-level elements
  const children = Array.from(doc.children[0]?.children || []);
  children.forEach(n => logRun(`Element <${n.tagName}> (attrs: ${Array.from(n.attributes || []).map(a=>a.name+'='+a.value).join(', ')})`));
  logRun('Simulation: would execute trade actions here (not sending to Deriv).');
  logRun('--- SIMULATION END ---');
}

/* send to Deriv (OPTIONAL) - user must be aware this performs live actions
   This function currently demonstrates how to send raw XML content to the server
   as a custom message. Deriv WebSocket does not accept XML directly — real execution
   requires calling contract/trade endpoints (not included). Keep this disabled
   until you review and want live execution implemented.
*/
function sendLiveToDeriv(){
  if (!derivToken){
    return alert('You must sign in before sending live commands.');
  }
  const xml = $('uploaded-strategy').textContent;
  if (!xml || xml.trim().length < 10) return alert('No strategy loaded.');

  if (!confirm('Sending live is experimental. Proceed?')) return;

  if (!ws) initDerivConnection();
  // Example placeholder: send a custom "run_strategy" message (Deriv will ignore it).
  // Replace this block with actual contract/trade calls per Deriv API if you want live trading.
  try {
    ws.send(JSON.stringify({ run_strategy: xml }));
    logRun('Sent strategy payload to Deriv (custom message). Replace with real trade calls when ready.');
  } catch(e){
    logRun('Failed to send to Deriv: ' + e.message);
  }
}

/* --- Helpers --- */
function logRun(msg){
  const el = $('run-log');
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.prepend(line);
}
