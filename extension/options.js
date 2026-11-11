const DEFAULTS = {
  enabled: true,
  countdown: 15,
  internalDomains: '',
  groupPatterns: 'all@\neveryone@\nall-staff@\nallstaff@\nstaff@\ncompany@',
  alertPatterns: '',
  holdOnWarning: true
};

const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

// ---------- 與 content.js 相同的判斷規則，用在即時預覽 ----------
const listFrom = (text) => String(text || '').split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

function isGroup(email, patterns) {
  const local = email.split('@')[0];
  return listFrom(patterns).some((p) => {
    if (p.endsWith('@')) return local === p.slice(0, -1);
    if (p.includes('@')) return email === p;
    return local === p;
  });
}

function isAlert(email, patterns) {
  const [local, domain] = email.split('@');
  return listFrom(patterns).some((p) => {
    if (p.endsWith('@')) return local === p.slice(0, -1);
    if (p.includes('@') && !p.startsWith('@')) return email === p;
    const d = p.replace(/^@/, '');
    return domain === d || domain.endsWith('.' + d);
  });
}

function clampCountdown() {
  return Math.min(120, Math.max(1, parseInt($('countdown').value, 10) || 15));
}

// ---------- 即時預覽 ----------
function renderDomains() {
  const list = listFrom($('internalDomains').value).map((d) => d.replace(/^@/, ''));
  $('domainLive').textContent = list.length
    ? `目前視為內部：${list.join('、')}`
    : '目前留白：會自動使用登入 Gmail 帳號的網域。';
  $('setup').hidden = list.length > 0;
}

let demoTimer = null;
function renderCountdown() {
  if (demoTimer) return;
  $('countBar').style.width = '100%';
  $('countLive').textContent = `確認視窗會顯示「${clampCountdown()} 秒後自動寄出」`;
}

function playCountdown() {
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  const total = clampCountdown();
  let left = total;
  const tick = () => {
    $('countBar').style.width = `${(left / total) * 100}%`;
    $('countLive').textContent = left > 0 ? `${left} 秒後自動寄出（示範，不會真的寄信）` : '示範結束：實際使用時，信會在這個時候寄出。';
  };
  tick();
  demoTimer = setInterval(() => {
    left -= 1;
    tick();
    if (left <= 0) { clearInterval(demoTimer); demoTimer = null; }
  }, 1000);
}

function renderTry() {
  const box = $('tryResult');
  const email = $('tryEmail').value.trim().toLowerCase();
  box.textContent = '';
  if (!email) { box.textContent = '在上面輸入地址，這裡會顯示判斷結果。'; return; }
  if (!EMAIL_RE.test(email)) { box.textContent = '請輸入完整的信箱地址。'; return; }

  const internal = listFrom($('internalDomains').value).map((d) => d.replace(/^@/, ''));
  const domain = email.split('@')[1];
  const external = internal.length ? !internal.some((i) => domain === i || domain.endsWith('.' + i)) : null;
  const group = isGroup(email, $('groupPatterns').value);
  const alert = isAlert(email, $('alertPatterns').value);

  const add = (cls, text) => {
    const s = document.createElement('span');
    s.className = cls; s.textContent = text;
    box.appendChild(s); box.appendChild(document.createTextNode(' '));
  };
  add('em', email);
  if (external === true) add('tag ext', '外部');
  if (external === false) add('tag ok', '內部');
  if (group) add('tag grp', '群組');
  if (alert) add('tag alert', '特別警示');

  const note = document.createElement('div');
  if (group || alert) {
    note.className = 'warn';
    note.textContent = $('holdOnWarning').checked
      ? '會出現紅色警示，不會自動寄出，必須手動按「立即寄出」。'
      : '會出現紅色警示，但仍會倒數後自動寄出（第 5 項沒有勾選）。';
  } else if (external === null) {
    note.textContent = '第 1 項留白，內部或外部要到 Gmail 裡依登入帳號判斷，這裡無法預覽。';
  } else {
    note.textContent = `沒有紅色警示，${clampCountdown()} 秒後自動寄出。`;
  }
  box.appendChild(note);
}

function renderAll() { renderDomains(); renderCountdown(); renderTry(); }

// ---------- 表單讀寫 ----------
function fillForm(v) {
  $('enabled').checked = v.enabled;
  $('countdown').value = v.countdown;
  $('internalDomains').value = v.internalDomains;
  $('groupPatterns').value = v.groupPatterns;
  $('alertPatterns').value = v.alertPatterns;
  $('holdOnWarning').checked = v.holdOnWarning;
  renderAll();
}

function readForm() {
  return {
    enabled: $('enabled').checked,
    countdown: clampCountdown(),
    internalDomains: $('internalDomains').value.trim(),
    groupPatterns: $('groupPatterns').value.trim(),
    alertPatterns: $('alertPatterns').value.trim(),
    holdOnWarning: $('holdOnWarning').checked
  };
}

let statusTimer = null;
function showStatus(text, isError) {
  $('status').textContent = text;
  $('status').style.color = isError ? '#c5221f' : '#188038';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').textContent = ''; }, 6000);
}

// ---------- 載入、儲存 ----------
chrome.storage.sync.get(DEFAULTS, (v) => {
  fillForm(v);
  if (!v.internalDomains.trim()) $('internalDomains').focus();   // 新使用者：游標直接放在第 1 項
});

document.addEventListener('input', renderAll);
document.addEventListener('change', renderAll);
$('countPlay').addEventListener('click', playCountdown);

// 正在填的區塊加上外框，對應右邊的說明
document.querySelectorAll('[data-block]').forEach((b) => {
  b.addEventListener('focusin', () => b.classList.add('focus'));
  b.addEventListener('focusout', () => b.classList.remove('focus'));
});

$('save').addEventListener('click', () => {
  const v = readForm();
  chrome.storage.sync.set(v, () => {
    $('countdown').value = v.countdown;
    renderAll();
    showStatus('已儲存，請重新整理 Gmail 分頁');
  });
});

// ---------- 下載 / 上傳設定檔 ----------
// 設定檔是純文字 JSON，只在本機產生與讀取，不會上傳到任何地方。
const CONFIG_TYPE = 'send-guard-for-gmail-config';

$('exportBtn').addEventListener('click', () => {
  const data = { type: CONFIG_TYPE, version: 1, settings: readForm() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'send-guard-for-gmail-config.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus('已下載設定檔（內容為畫面上目前的設定）');
});

// 只接受認得的欄位，型別不對就拒絕，避免壞掉的檔案把設定弄亂
function parseConfig(text) {
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('不是有效的 JSON 檔'); }
  const s = data && data.type === CONFIG_TYPE ? data.settings : null;
  if (!s || typeof s !== 'object') throw new Error('不是這個擴充套件的設定檔');
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (!(k in s)) continue;
    if (typeof s[k] !== typeof DEFAULTS[k]) throw new Error(`欄位 ${k} 的格式不對`);
    out[k] = s[k];
  }
  out.countdown = Math.min(120, Math.max(1, Math.round(out.countdown) || DEFAULTS.countdown));
  return out;
}

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async () => {
  const file = $('importFile').files[0];
  $('importFile').value = '';                 // 讓同一個檔案可以再選一次
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('檔案太大');
    fillForm(parseConfig(await file.text()));
    showStatus('已載入設定檔，請確認內容後按「儲存」才會生效');
  } catch (e) {
    showStatus('無法載入：' + e.message, true);
  }
});
