// Day 2 UI wiring (loader, modal, bot-run links, chat panel, etc.)

document.addEventListener('DOMContentLoaded', () => {
  // --- Loader messages & branding ---
  const loader = document.getElementById('loader');
  const loaderMsg = document.getElementById('loader-msg');
  const messages = [
    'Printing profits...',
    'Counting pips...',
    'Sharpening strategies...',
    'Fetching market magic...',
    'Connecting community...'
  ];
  let mi = 0;
  const msgInterval = setInterval(() => {
    loaderMsg.textContent = messages[mi++ % messages.length];
  }, 800);

  // auto-hide loader after ~2.5s (brand first)
  setTimeout(() => {
    clearInterval(msgInterval);
    loader.style.transition = 'opacity .4s, visibility .4s';
    loader.style.opacity = '0';
    setTimeout(()=> loader.remove(), 500);

    // fade-in subtle animations for tiles & bots
    document.querySelectorAll('.tile, .bot-card').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
      setTimeout(()=> { el.style.transition='opacity .45s ease,transform .45s ease'; el.style.opacity='1'; el.style.transform='translateY(0)'; }, 120*i);
    });
  }, 2500);

  // --- Primary nav behaviour (smooth scroll) ---
  document.querySelectorAll('.primary-nav .menu-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t = btn.dataset.target;
      const el = document.getElementById(t);
      if(el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      document.querySelectorAll('.primary-nav .menu-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // floating nav pills smooth scroll
  document.querySelectorAll('.nav-pill').forEach(p=>{
    p.addEventListener('click', e=>{
      e.preventDefault();
      const href = p.getAttribute('href');
      const tgt = document.querySelector(href);
      if(tgt) window.scrollTo({ top: tgt.offsetTop - 80, behavior:'smooth' });
    });
  });

  // --- Tiles behaviour ---
  document.querySelectorAll('.tile').forEach(tile=>{
    tile.addEventListener('click', ()=> {
      const a = tile.dataset.action;
      if(a === 'builder') {
        const el = document.getElementById('bot-section'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      } else if(a === 'gdrive') {
        alert('Google Drive sync placeholder (coming soon).');
      } else if(a === 'local') {
        openUploadModal();
      } else if(a === 'quick') {
        alert('Quick strategies will open here (coming soon).');
      }
    });
  });

  // --- Upload modal wiring ---
  const modal = document.getElementById('upload-modal');
  const modalClose = document.getElementById('modal-close');
  const fileInput = document.getElementById('local-file');
  const fileName = document.getElementById('file-name');
  const modalHostRun = document.getElementById('modal-host-run');
  const modalOpenDeriv = document.getElementById('modal-open-deriv');

  function openUploadModal(){
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeUploadModal(){
    modal.setAttribute('aria-hidden', 'true');
    fileInput.value = '';
    fileName.textContent = 'No file chosen';
  }

  modalClose.addEventListener('click', closeUploadModal);
  // close modal on outside click
  modal.addEventListener('click', (e) => {
    if(e.target === modal) closeUploadModal();
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if(!f) { fileName.textContent = 'No file chosen'; return; }
    fileName.textContent = `${f.name} — ${Math.round(f.size/1024)} KB`;
    // keep file in memory for potential later upload (not sent automatically)
    modal.dataset.selectedFile = f.name;
    // store file object reference if needed later:
    (window._bk_local_file = window._bk_local_file || {});
    window._bk_local_file.current = f;
  });

  // When user clicks "Host & Run" — we attempt to open with hosted path.
  // NOTE: to auto-load, the file MUST be hosted publicly at /bots/<filename>
  modalHostRun.addEventListener('click', () => {
    const fname = modal.dataset.selectedFile;
    if(!fname){
      alert('Please choose a .xml file first (file must be hosted publicly in /bots/ to auto-load).');
      return;
    }
    // build hosted path assumption
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const hosted = base + 'bots/' + encodeURIComponent(fname);
    // open deriv with load_url=hosted
    const url = 'https://app.deriv.com/bot#load_url=' + encodeURIComponent(hosted);
    window.open(url, '_blank');
    closeUploadModal();
  });

  // Open Deriv directly: user must upload manually there.
  modalOpenDeriv.addEventListener('click', () => {
    // open Deriv Bot Builder and show a short instruction overlay (user must upload file)
    window.open('https://app.deriv.com/bot', '_blank');
    alert('Deriv Bot Builder opened in new tab. Please use the builder’s Load / Import option to upload your local .xml file.');
    closeUploadModal();
  });

  // --- Run in Bot Builder for free bots (hosted) ---
  function derivBotBuilderUrl(botUrl){
    return 'https://app.deriv.com/bot#load_url=' + encodeURIComponent(botUrl);
  }

  document.querySelectorAll('.run-bot').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const file = btn.dataset.file; // e.g. "Digit Over 3.xml"
      const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
      const botPath = base + 'bots/' + encodeURIComponent(file);
      const url = derivBotBuilderUrl(botPath);
      window.open(url, '_blank');
    });
  });

  // --- Run / Stop global bot button (UI only) ---
  const runBtn = document.getElementById('run-bot');
  const botIndicator = document.getElementById('bot-indicator');
  const botState = document.getElementById('bot-state');
  let botRunning = false;
  runBtn && runBtn.addEventListener('click', ()=> {
    botRunning = !botRunning;
    if(botRunning){
      runBtn.classList.add('running');
      runBtn.querySelector('.run-icon i').classList.remove('fa-play'); runBtn.querySelector('.run-icon i').classList.add('fa-pause');
      botIndicator.classList.remove('stopped'); botIndicator.classList.add('running');
      botState.textContent = 'Bot is running';
    } else {
      runBtn.classList.remove('running');
      runBtn.querySelector('.run-icon i').classList.remove('fa-pause'); runBtn.querySelector('.run-icon i').classList.add('fa-play');
      botIndicator.classList.remove('running'); botIndicator.classList.add('stopped');
      botState.textContent = 'Bot is stopped';
    }
  });

  // --- Chat panel (auto-open first visit) ---
  const chatPanel = document.getElementById('chat-panel');
  const chatCloseBtn = document.getElementById('chat-close');
  const CHAT_KEY = 'bk_chat_closed_v1';
  if(localStorage.getItem(CHAT_KEY) === 'closed') {
    chatPanel.classList.remove('open');
    chatPanel.classList.add('closed');
    chatPanel.setAttribute('aria-hidden','true');
  } else {
    chatPanel.classList.add('open');
    chatPanel.classList.remove('closed');
    chatPanel.setAttribute('aria-hidden','false');
  }
  chatCloseBtn.addEventListener('click', ()=> {
    chatPanel.classList.add('closed');
    chatPanel.classList.remove('open');
    chatPanel.setAttribute('aria-hidden','true');
    localStorage.setItem(CHAT_KEY, 'closed');
  });
  // chat tabs
  document.querySelectorAll('.chat-tab').forEach(t => {
    t.addEventListener('click', ()=> {
      document.querySelectorAll('.chat-tab').forEach(tb=>tb.classList.remove('active'));
      t.classList.add('active');
      const sel = t.dataset.tab;
      document.getElementById('telegram-panel').style.display = (sel==='telegram') ? 'block' : 'none';
      document.getElementById('whatsapp-panel').style.display = (sel==='whatsapp') ? 'block' : 'none';
    });
  });

  // --- Mobile hamburger ---
  const hamburger = document.querySelector('.hamburger');
  const primaryNav = document.querySelector('.primary-nav');
  hamburger && hamburger.addEventListener('click', ()=>{
    const visible = getComputedStyle(primaryNav).display !== 'none';
    primaryNav.style.display = visible ? 'none' : 'flex';
    hamburger.setAttribute('aria-expanded', (!visible).toString());
  });

  // --- create missing anchors to keep menu safe ---
  ['dashboard','bot-section','chart-section','analysis-section','freebot-section','tutorial-section'].forEach(id=>{
    if(!document.getElementById(id)){
      const s = document.createElement('section'); s.id = id; s.style.display='none'; document.body.appendChild(s);
    }
  });

}); // DOMContentLoaded
