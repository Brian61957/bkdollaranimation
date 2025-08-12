/* -------------------------
  Basic Day 3 client-side logic
  - App ID: 95972
  - OAuth: oauth.deriv.com/oauth2/authorize
  - WebSocket: wss://ws.derivws.com/websockets/v3?app_id=APP_ID
---------------------------*/

const APP_ID = 95972; // your Deriv App ID
const REDIRECT_URI = "https://brian61957.github.io/bkdollaranimation/"; // must match Deriv app redirect
const AFFILIATE_PAGE = "https://bkderivgrowth.carrd.co"; // opens in new tab before OAuth for tracking (you can add affiliate_token to OAuth URL later)

const signinBtn = document.getElementById('signin-btn');
const logoutBtn = document.getElementById('logout-btn');
const overlaySignin = document.getElementById('overlay-signin');
const accountSummary = document.getElementById('account-summary');
const acctType = document.getElementById('acct-type');
const acctBalance = document.getElementById('acct-balance');
const welcomeEl = document.getElementById('welcome');
const welcomeText = document.getElementById('welcome-text');

let ws; // websocket
let currentToken = null;
let currentAccount = null;

/* Utility: parse query tokens returned by Deriv OAuth.
   Deriv returns tokens like: ?acct1=...&token1=...&cur1=...
*/
function parseDerivReturn() {
  const params = new URLSearchParams(window.location.search);
  const tokens = [];
  // check up to 6 accounts possible
  for (let i = 1; i <= 6; i++) {
    const t = params.get(`token${i}`);
    const a = params.get(`acct${i}`);
    const c = params.get(`cur${i}`);
    if (t && a) tokens.push({ token: t, account: a, currency: c || '' });
  }
  return tokens;
}

/* Build OAuth URL. If you later have an affiliate_token and utm_campaign,
   you can append &affiliate_token=...&utm_campaign=...
*/
function buildOAuthUrl() {
  let url = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  // scope isn't required for basic interactive flow, but leave room:
  url += '&scope=read';
  return url;
}

/* Start login: open affiliate page in new tab then go to oauth */
function startLogin() {
  // Open affiliate page in new tab so tracking gets applied (best-effort)
  try { window.open(AFFILIATE_PAGE, '_blank', 'noopener'); } catch (e) {}
  // Then redirect current tab to OAuth
  setTimeout(() => {
    window.location.href = buildOAuthUrl();
  }, 500);
}

/* Save token to localStorage and connect websocket */
function saveAndConnect(tokenObj) {
  // tokenObj: { token, account, currency }
  currentToken = tokenObj.token;
  currentAccount = tokenObj;
  localStorage.setItem('deriv_token', tokenObj.token);
  localStorage.setItem('deriv_account', JSON.stringify(tokenObj));
  connectWebsocketAndAuthorize(tokenObj.token);
}

/* Logout */
function doLogout() {
  localStorage.removeItem('deriv_token');
  localStorage.removeItem('deriv_account');
  currentToken = null;
  currentAccount = null;
  if (ws) ws.close();
  updateUIForLoggedOut();
}

/* UI helpers */
function showWelcome(name){
  welcomeText.textContent = `Welcome back, ${name} 💵`;
  welcomeEl.classList.remove('hidden');
  welcomeText.style.opacity = 0;
  welcomeText.style.transform = 'translateY(-8px)';
  // animate
  setTimeout(()=> {
    welcomeText.style.transition = 'all 450ms cubic-bezier(.2,.9,.3,1)';
    welcomeText.style.opacity = 1;
    welcomeText.style.transform = 'translateY(0)';
  },50);
  // hide after 3s
  setTimeout(()=> welcomeEl.classList.add('hidden'), 3600);
}

function updateUIForLoggedIn(info){
  document.querySelectorAll('[data-requires-login="true"]').forEach(el=>{
    el.classList.remove('locked');
  });
  accountSummary.textContent = `${info.loginid || 'Account'} · ${info.currency || ''}`;
  acctType.textContent = info.landing_company_name || 'Live';
  acctBalance.textContent = formatMoney(info.balance, info.currency || 'USD');
  signinBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  document.getElementById('account-display').classList.remove('locked');
  showWelcome(info.display_name || (info.loginid || 'Trader'));
}

function updateUIForLoggedOut(){
  document.querySelectorAll('[data-requires-login="true"]').forEach(el=>{
    el.classList.add('locked');
  });
  accountSummary.textContent = `Not signed in`;
  acctType.textContent = 'Demo';
  acctBalance.textContent = '$0.00';
  signinBtn.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
}

/* Format money */
function formatMoney(amount, currency){
  try{
    const n = Number(amount);
    return (isNaN(n) ? amount : n.toLocaleString(undefined, { style:'currency', currency: currency.toUpperCase() || 'USD' }));
  }catch(e){ return `${amount} ${currency}`; }
}

/* Connect websocket and authenticate with token, then request balance and account status.
   Uses Deriv WebSocket endpoint (docs show wss://ws.derivws.com/websockets/v3?app_id=APP_ID).
   After authorize, responses include authorization details and we request balance and account_status.
*/
function connectWebsocketAndAuthorize(token) {
  if (!token) return;
  try {
    const url = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      // authorize
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch(e){ return; }

      // authorize response -> contains account information
      if (data.authorize) {
        // authorize response often contains account_list or loginid
        const auth = data.authorize;
        // request balance subscribe for the authorized account
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        ws.send(JSON.stringify({ get_account_status: 1 }));
      }

      // balance updates
      if (data.msg_type === 'balance' || data.balance) {
        const balData = data.balance || data;
        // display balance (may contain account_type, currency)
        const acctInfo = JSON.parse(localStorage.getItem('deriv_account') || '{}') || {};
        acctInfo.balance = balData.balance;
        acctInfo.currency = balData.currency || acctInfo.currency || 'USD';
        localStorage.setItem('deriv_account', JSON.stringify(acctInfo));
        updateUIForLoggedIn(acctInfo);
      }

      // account status response
      if (data.msg_type === 'get_account_status' || data.get_account_status) {
        const status = data.get_account_status || data;
        // status contains loginid and other info
        const acctInfo = JSON.parse(localStorage.getItem('deriv_account') || '{}') || {};
        acctInfo.loginid = status.echo_req && status.echo_req.loginid ? status.echo_req.loginid : (status.loginid || acctInfo.loginid);
        // sometimes response struct differs—merge safely
        if (!acctInfo.display_name && status.account_name) acctInfo.display_name = status.account_name;
        if (!acctInfo.landing_company_name && status.landing_company) acctInfo.landing_company_name = status.landing_company.name || acctInfo.landing_company_name;
        localStorage.setItem('deriv_account', JSON.stringify(acctInfo));
        updateUIForLoggedIn(acctInfo);
      }

      // fallback: if message contains authorize result and account list, pick first
      if (data.msg_type === 'authorize') {
        if (data.authorize && data.authorize.account_list && data.authorize.account_list.length) {
          const first = data.authorize.account_list[0];
          const acctObj = {
            loginid: first.loginid,
            balance: first.balance,
            currency: first.currency,
            display_name: first.display_name || first.loginid
          };
          localStorage.setItem('deriv_account', JSON.stringify(acctObj));
          updateUIForLoggedIn(acctObj);
        }
      }

    };

    ws.onerror = (e) => {
      console.warn('WebSocket error', e);
    };

    ws.onclose = () => {
      // closed
    };
  } catch (e) {
    console.error('WS connect error', e);
  }
}

/* On page load: check for tokens in URL (OAuth return), then for saved token in localStorage */
window.addEventListener('load', () => {
  // wire UI
  signinBtn.addEventListener('click', startLogin);
  overlaySignin.addEventListener('click', startLogin);
  logoutBtn.addEventListener('click', doLogout);

  document.getElementById('open-upload-modal').addEventListener('click', ()=> {
    document.getElementById('upload-modal').classList.remove('hidden');
  });
  document.getElementById('modal-close').addEventListener('click', ()=> document.getElementById('upload-modal').classList.add('hidden'));
  document.getElementById('modal-upload').addEventListener('click', ()=>{
    const f = document.getElementById('local-file').files[0];
    if (!f) { alert('Please pick an XML bot file'); return; }
    alert('Uploaded: ' + f.name + ' (demo behavior — implement storage as needed)');
    document.getElementById('upload-modal').classList.add('hidden');
  });

  // nav behaviour
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
      const el = document.getElementById(page);
      if (el) el.classList.remove('hidden');
    });
  });

  // run bot buttons (demo — open Deriv in new tab)
  document.querySelectorAll('.run-btn').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      // If not logged in, prompt sign-in overlay
      const token = localStorage.getItem('deriv_token');
      if (!token) {
        document.getElementById('locked-overlay').classList.remove('hidden');
        return;
      }
      const name = ev.target.dataset.run || 'bot';
      // Example: open Deriv in a new tab. Real automatic loading in botbuilder requires Deriv integrations.
      window.open('https://app.deriv.com/bot-builder', '_blank', 'noopener');
    });
  });

  // clicking on locked tiles triggers overlay
  document.querySelectorAll('.tile').forEach(t=>{
    t.addEventListener('click', ()=>{
      const requires = t.dataset.requiresLogin === "true";
      if (requires && !localStorage.getItem('deriv_token')) {
        document.getElementById('locked-overlay').classList.remove('hidden');
      } else {
        // open the tile (basic behaviour)
        alert('Opening: ' + (t.id || 'tile'));
      }
    });
  });

  // close overlay when clicking outside
  document.getElementById('locked-overlay').addEventListener('click', (e)=>{
    if (e.target === e.currentTarget) document.getElementById('locked-overlay').classList.add('hidden');
  });

  // overlay sign in
  document.getElementById('overlay-signin').addEventListener('click', ()=> {
    document.getElementById('locked-overlay').classList.add('hidden');
    startLogin();
  });

  // 1) If redirected from OAuth (tokens in query), parse and save
  const returned = parseDerivReturn();
  if (returned && returned.length) {
    // choose first returned token
    const first = returned[0];
    saveAndConnect(first);
    // cleanup URL (remove query params)
    history.replaceState(null, '', REDIRECT_URI);
    return;
  }

  // 2) If token in localStorage, auto-connect
  const savedToken = localStorage.getItem('deriv_token');
  const savedAccount = JSON.parse(localStorage.getItem('deriv_account') || 'null');
  if (savedToken) {
    // set current and connect
    currentToken = savedToken;
    currentAccount = savedAccount || null;
    connectWebsocketAndAuthorize(savedToken);
    if (savedAccount) updateUIForLoggedIn(savedAccount);
  } else {
    updateUIForLoggedOut();
  }

});
