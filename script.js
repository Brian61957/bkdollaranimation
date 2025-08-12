
/* Day3 simplified script
   - App ID: 95972
   - Affiliate page opens first for tracking, then OAuth
*/
const APP_ID = 95972;
const REDIRECT_URI = "https://brian61957.github.io/bkdollaranimation/";
const AFFILIATE_PAGE = "https://bkderivgrowth.carrd.co";

document.addEventListener('DOMContentLoaded', ()=> {
  // loader hide after short delay
  setTimeout(()=> document.getElementById('loader').style.display = 'none', 800);

  // nav
  document.querySelectorAll('.nav-btn').forEach(btn=> btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    const el = document.getElementById(page);
    if (el) el.classList.remove('hidden');
  }));

  // auth buttons
  const signinBtn = document.getElementById('signin-btn');
  const logoutBtn = document.getElementById('logout-btn');
  signinBtn.addEventListener('click', startLogin);
  logoutBtn.addEventListener('click', doLogout);

  // run/stop button behaviour (visual)
  const runBtn = document.getElementById('run-btn');
  const stopBtn = document.getElementById('stop-btn');
  const botStatus = document.getElementById('bot-status');
  runBtn.addEventListener('click', ()=>{
    // require login
    const token = localStorage.getItem('deriv_token');
    if (!token) return alert('Please sign in to run bots');
    runBtn.classList.add('hidden'); stopBtn.classList.remove('hidden');
    botStatus.textContent = 'Bot is running...';
    // slide up to show P/L (demo animation)
    document.getElementById('workspace').style.transform = 'translateY(-40px)';
  });
  stopBtn.addEventListener('click', ()=>{
    stopBtn.classList.add('hidden'); runBtn.classList.remove('hidden');
    botStatus.textContent = 'Bot is not running';
    document.getElementById('workspace').style.transform = 'translateY(0)';
  });

  // upload modal
  document.getElementById('open-upload-modal').addEventListener('click', ()=> document.getElementById('upload-modal').classList.remove('hidden'));
  document.getElementById('modal-close').addEventListener('click', ()=> document.getElementById('upload-modal').classList.add('hidden'));
  document.getElementById('modal-upload').addEventListener('click', ()=>{
    const f = document.getElementById('local-file').files[0];
    if (!f) return alert('Please choose an xml file');
    alert('Uploaded ' + f.name + ' (demo)');
    document.getElementById('upload-modal').classList.add('hidden');
  });

  // run bot buttons (open Bot Builder in new tab with affiliate)
  document.querySelectorAll('.run-bot-btn').forEach(b=> b.addEventListener('click', (e)=>{
    const file = e.target.dataset.file;
    // open affiliate first then bot builder
    window.open(AFFILIATE_PAGE, '_blank', 'noopener');
    // open bot builder in new tab (user must be logged in for auto-load)
    setTimeout(()=> window.open('https://app.deriv.com/bot-builder', '_blank', 'noopener'), 600);
  }));
  document.querySelectorAll('.run-hybrid-btn').forEach(b=> b.addEventListener('click', (e)=>{
    const file = e.target.dataset.file;
    // open bot builder and chart side-by-side -> open builder in new tab, open chart
    window.open(AFFILIATE_PAGE, '_blank', 'noopener');
    setTimeout(()=> window.open('https://app.deriv.com/bot-builder', '_blank', 'noopener'), 600);
    setTimeout(()=> window.open('https://app.deriv.com', '_blank', 'noopener'), 800);
  }));

  // OAuth parse on return
  const params = new URLSearchParams(window.location.search);
  for (let i=1;i<=6;i++){ const t = params.get('token'+i); const a = params.get('acct'+i); if (t) { localStorage.setItem('deriv_token', t); localStorage.setItem('deriv_account', JSON.stringify({ account:a })); history.replaceState(null,'', REDIRECT_URI); alert('Logged in successfully'); location.reload(); } }

  // auto-login UI
  const saved = JSON.parse(localStorage.getItem('deriv_account') || 'null');
  if (localStorage.getItem('deriv_token')){ document.getElementById('account-info').textContent = (saved && saved.account) ? saved.account : 'Signed in'; document.getElementById('signin-btn').classList.add('hidden'); document.getElementById('logout-btn').classList.remove('hidden'); }

});

// Start login -> open affiliate then OAuth
function startLogin(){
  try{ window.open(AFFILIATE_PAGE, '_blank', 'noopener'); }catch(e){}
  setTimeout(()=>{
    const url = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=read%20trade%20trading_information`;
    window.location.href = url;
  },600);
}

// Logout
function doLogout(){
  localStorage.removeItem('deriv_token');
  localStorage.removeItem('deriv_account');
  location.reload();
}
