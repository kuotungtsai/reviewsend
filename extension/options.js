const DEFAULTS = {
  enabled: true,
  countdown: 15,
  internalDomains: '',
  groupPatterns: 'all@\neveryone@\nall-staff@\nallstaff@\nstaff@\ncompany@',
  alertPatterns: '',
  holdOnWarning: true
};

const $ = (id) => document.getElementById(id);
let t = ReviewSendI18n.make('auto');     // 介面文字；讀到語言設定後會換掉
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

// ---------- IT 管理員下發的設定（沒有就是空物件，頁面行為與單機使用相同） ----------
let managed = {};
let lastUser = { ...DEFAULTS };          // 使用者自己存的值；被鎖定的欄位儲存時沿用這份，不寫入 IT 的值
const LISTS = ['internalDomains', 'groupPatterns', 'alertPatterns'];
const managedList = (id) => (typeof managed[id] === 'string' ? managed[id].trim() : '');
// 名單類欄位實際採用的內容 = IT 的名單 + 使用者自己填的
const eff = (id) => (managedList(id) ? managedList(id) + '\n' : '') + $(id).value;
const locked = {
  countdown: () => Number.isFinite(managed.countdown),
  holdOnWarning: () => typeof managed.holdOnWarning === 'boolean',
  enabled: () => managed.forceEnabled === true
};

function applyManaged() {
  for (const id of LISTS) {
    const box = $('m-' + id);
    const items = listFrom(managedList(id));
    box.hidden = items.length === 0;
    box.textContent = items.length ? t('optManagedList', items.join(t('sep'))) : '';
  }
  if (locked.countdown()) $('countdown').value = managed.countdown;
  if (locked.holdOnWarning()) $('holdOnWarning').checked = managed.holdOnWarning;
  if (locked.enabled()) $('enabled').checked = true;
  for (const id of Object.keys(locked)) {
    $(id).disabled = locked[id]();
    $('l-' + id).hidden = !locked[id]();
  }
}

function clampCountdown() {
  return Math.min(120, Math.max(1, parseInt($('countdown').value, 10) || 15));
}

// ---------- 即時預覽 ----------
function renderDomains() {
  const list = listFrom(eff('internalDomains')).map((d) => d.replace(/^@/, ''));
  $('domainLive').textContent = list.length
    ? t('optDomainLive', list.join(t('sep')))
    : t('optDomainEmpty');
  $('setup').hidden = list.length > 0;
}

let demoTimer = null;
function renderCountdown() {
  if (demoTimer) return;
  $('countBar').style.width = '100%';
  $('countLive').textContent = t('optCountLive', clampCountdown());
}

function playCountdown() {
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  const total = clampCountdown();
  let left = total;
  const tick = () => {
    $('countBar').style.width = `${(left / total) * 100}%`;
    $('countLive').textContent = left > 0 ? t('optDemoTick', left) : t('optDemoEnd');
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
  if (!email) { box.textContent = t('optTryEmpty'); return; }
  if (!EMAIL_RE.test(email)) { box.textContent = t('optTryInvalid'); return; }

  const internal = listFrom(eff('internalDomains')).map((d) => d.replace(/^@/, ''));
  const domain = email.split('@')[1];
  const external = internal.length ? !internal.some((i) => domain === i || domain.endsWith('.' + i)) : null;
  const group = isGroup(email, eff('groupPatterns'));
  const alert = isAlert(email, eff('alertPatterns'));

  const add = (cls, text) => {
    const s = document.createElement('span');
    s.className = cls; s.textContent = text;
    box.appendChild(s); box.appendChild(document.createTextNode(' '));
  };
  add('em', email);
  if (external === true) add('tag ext', t('tagExternal'));
  if (external === false) add('tag ok', t('tagInternal'));
  if (group) add('tag grp', t('tagGroup'));
  if (alert) add('tag alert', t('tagAlert'));

  const note = document.createElement('div');
  if (group || alert) {
    note.className = 'warn';
    note.textContent = $('holdOnWarning').checked
      ? t('optTryHold')
      : t('optTryNoHold');
  } else if (external === null) {
    note.textContent = t('optTryNoDomain');
  } else {
    note.textContent = t('optTryOk', clampCountdown());
  }
  box.appendChild(note);
}

function renderAll() { renderDomains(); renderCountdown(); renderTry(); }

// ---------- 表單讀寫 ----------
function fillForm(v) {
  lastUser = { ...v };
  $('enabled').checked = v.enabled;
  $('countdown').value = v.countdown;
  $('internalDomains').value = v.internalDomains;
  $('groupPatterns').value = v.groupPatterns;
  $('alertPatterns').value = v.alertPatterns;
  $('holdOnWarning').checked = v.holdOnWarning;
  applyManaged();
  renderAll();
}

function readForm() {
  return {
    enabled: locked.enabled() ? lastUser.enabled : $('enabled').checked,
    countdown: locked.countdown() ? lastUser.countdown : clampCountdown(),
    internalDomains: $('internalDomains').value.trim(),
    groupPatterns: $('groupPatterns').value.trim(),
    alertPatterns: $('alertPatterns').value.trim(),
    holdOnWarning: locked.holdOnWarning() ? lastUser.holdOnWarning : $('holdOnWarning').checked
  };
}

let statusTimer = null;
function showStatus(text, isError) {
  $('status').textContent = text;
  $('status').style.color = isError ? '#c5221f' : '#188038';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').textContent = ''; }, 6000);
}

// ---------- 語言 ----------
// 語言是個人偏好：選了立刻生效並儲存，不用按「儲存」，也不會寫進下載的設定檔。
function setLanguage(pref) {
  t = ReviewSendI18n.make(pref);
  ReviewSendI18n.apply(document, t);
  document.title = t('optTitle');
  applyManaged();
  renderAll();
}
setLanguage('auto');
chrome.storage.sync.get({ language: 'auto' }, (v) => {
  const pref = v && ['zh-TW', 'en'].includes(v.language) ? v.language : 'auto';
  $('language').value = pref;
  setLanguage(pref);
});
$('language').addEventListener('change', () => {
  const pref = $('language').value;
  chrome.storage.sync.set({ language: pref }, () => setLanguage(pref));
});

// ---------- 載入、儲存 ----------
// 受管理的設定：不是受管理的瀏覽器時會是空的或回報錯誤，兩種情況都當作沒有
try {
  chrome.storage.managed.get(null, (v) => {
    if (chrome.runtime.lastError || !v) return;
    managed = v; applyManaged(); renderAll();
  });
} catch (_) { /* 沒有受管理的設定 */ }

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
    lastUser = { ...v };
    if (!locked.countdown()) $('countdown').value = v.countdown;
    renderAll();
    showStatus(t('optSaved'));
  });
});

// ---------- 下載 / 上傳設定檔 ----------
// 設定檔是純文字 JSON，只在本機產生與讀取，不會上傳到任何地方。
const CONFIG_TYPE = 'reviewsend-config';
const LEGACY_TYPES = ['send-guard-for-gmail-config', 'gmail-send-guard-config'];   // 改名前匯出的設定檔仍可上傳

$('exportBtn').addEventListener('click', () => {
  const data = { type: CONFIG_TYPE, version: 1, settings: readForm() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reviewsend-config.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus(t('optExported'));
});

// 只接受認得的欄位，型別不對就拒絕，避免壞掉的檔案把設定弄亂
function parseConfig(text) {
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error(t('errJson')); }
  const s = data && (data.type === CONFIG_TYPE || LEGACY_TYPES.includes(data.type)) ? data.settings : null;
  if (!s || typeof s !== 'object') throw new Error(t('errNotConfig'));
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (!(k in s)) continue;
    if (typeof s[k] !== typeof DEFAULTS[k]) throw new Error(t('errField', k));
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
    if (file.size > 1024 * 1024) throw new Error(t('errTooBig'));
    fillForm(parseConfig(await file.text()));
    showStatus(t('optImported'));
  } catch (e) {
    showStatus(t('optImportFailed', e.message), true);
  }
});
