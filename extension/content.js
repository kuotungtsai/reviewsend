/*
 * ReviewSend
 * 攔截 Gmail 的「傳送」按鈕與 Ctrl/Cmd+Enter，先顯示所有收件人並倒數，
 * 倒數結束或按「立即寄出」才真正送出。全部在本機執行，不連任何外部伺服器。
 */
(() => {
  'use strict';

  // ---------- 設定 ----------
  const DEFAULTS = {
    enabled: true,
    countdown: 15,                 // 秒
    internalDomains: '',           // 逗號或換行分隔；空白 = 自動用登入帳號的網域
    groupPatterns: 'all@\neveryone@\nall-staff@\nallstaff@\nstaff@\ncompany@',
    alertPatterns: '',             // 特別警示名單：完整地址、@網域 或 網域、name@
    holdOnWarning: true,           // 有紅色警示（群組 / 特別警示 / 多個外部網域 / 讀不到收件人）時不自動寄出
    language: 'auto'               // 介面語言：auto（跟隨瀏覽器）、zh-TW、en
  };
  // user = 使用者自己存的設定；managed = IT 管理員下發的設定（沒有就是空的）。
  // cfg 是兩者合併後實際採用的值。沒有 IT 設定時 cfg 就等於 user，行為和單機使用完全相同。
  let user = { ...DEFAULTS };
  let managed = {};
  let cfg = { ...DEFAULTS };
  let t = ReviewSendI18n.make('auto');   // 介面文字，語言設定載入後會換掉

  function mergeConfig() {
    const out = { ...user };
    // 名單類：IT 的名單和使用者自己的合併
    for (const k of ['internalDomains', 'groupPatterns', 'alertPatterns']) {
      if (typeof managed[k] === 'string' && managed[k].trim()) out[k] = managed[k] + '\n' + (user[k] || '');
    }
    // 數值與開關：IT 有設定就以 IT 為準
    if (Number.isFinite(managed.countdown)) out.countdown = managed.countdown;
    if (typeof managed.holdOnWarning === 'boolean') out.holdOnWarning = managed.holdOnWarning;
    if (managed.forceEnabled === true) out.enabled = true;
    cfg = out;
    t = ReviewSendI18n.make(out.language);
  }

  let broken = false;              // 自我檢查：有撰寫視窗卻認不出傳送按鈕（Gmail 可能改版）
  // 告訴背景程式目前是否啟用，讓工具列圖示在這個 Gmail 分頁顯示綠點 / 灰點
  function reportStatus() {
    try { chrome.runtime.sendMessage({ type: 'gsg-status', enabled: !!cfg.enabled, broken,
        title: t(broken ? 'titleBroken' : cfg.enabled ? 'titleOn' : 'titleOff') }, () => void chrome.runtime.lastError); }
    catch (_) { /* 擴充套件剛被重新載入時舊分頁會失敗，忽略 */ }
  }
  try {
    chrome.storage.sync.get(DEFAULTS, (v) => { user = { ...DEFAULTS, ...v }; mergeConfig(); reportStatus(); });
    try {
      chrome.storage.managed.get(null, (v) => {
        if (chrome.runtime.lastError || !v) return;        // 不是受管理的瀏覽器：維持空的
        managed = v; mergeConfig(); reportStatus();
      });
    } catch (_) { /* 沒有受管理的設定 */ }
    chrome.storage.onChanged.addListener((changes, area) => {
      const target = area === 'managed' ? managed : area === 'sync' ? user : null;
      if (!target) return;
      for (const k of Object.keys(changes)) {
        if (changes[k].newValue === undefined) { if (area === 'managed') delete target[k]; else target[k] = DEFAULTS[k]; }
        else target[k] = changes[k].newValue;
      }
      mergeConfig(); reportStatus();
    });
    // 點工具列圖示時，彈出視窗會來問這個分頁的狀態
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (msg && msg.type === 'gsg-ping') reply({ enabled: !!cfg.enabled, forced: managed.forceEnabled === true, broken });
      if (msg && msg.type === 'gsg-diagnose') reply({ report: diagnose() });
    });
  } catch (_) { /* 測試環境沒有 chrome.storage 時用預設值 */ }

  // ---------- 辨識 Gmail 元素 ----------
  // 傳送按鈕的 tooltip 例如「傳送 ‪(Ctrl-Enter)‬」或「Send ‪(Ctrl-Enter)‬」
  const SEND_LABEL_RE = /^\s*(?:傳送|傳送郵件|发送|發送|Send|送信|보내기)\s*(?:[‪‬(（].*)?$/i;
  const FIELD_RES = [
    ['bcc', /^\s*(?:密件副本|密送|Bcc)/i],
    ['cc',  /^\s*(?:副本|抄送|Cc)/i],
    ['to',  /^\s*(?:收件者|收件人|To\b|宛先)/i],
    ['from', /^\s*(?:寄件者|发件人|寄件人|From\b|差出人)/i]
  ];
  const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
  // 傳送按鈕的提示一定帶有快速鍵，例如「(Ctrl-Enter)」或「(⌘Enter)」，不受介面語言影響
  const SEND_SHORTCUT_RE = /(?:Ctrl|Control|⌘|Cmd|Command)\s*[-+]?\s*Enter/i;
  const EDITABLE_SEL = '[g_editable="true"], div[contenteditable="true"][role="textbox"]';

  function isSendButtonEl(btn) {
    if (!btn || btn.getAttribute('role') !== 'button') return false;
    if (btn.hasAttribute('aria-haspopup')) return false;          // 排除「更多傳送選項」下拉
    const label = (btn.getAttribute('data-tooltip') || btn.getAttribute('aria-label') || '').trim();
    // 三種特徵任一符合就算：Gmail 的 class、各語言的按鈕文字、提示裡的快速鍵（與語言無關）
    return btn.classList.contains('aoO') || SEND_LABEL_RE.test(label) || SEND_SHORTCUT_RE.test(label);
  }

  // 撰寫視窗的範圍。真實 Gmail 裡「內文 + 傳送按鈕」在同一個 table，
  // 收件人與主旨在旁邊的 form，所以找到內文後還要繼續往上，直到連主旨欄也包進來。
  // 往上時若碰到第二顆傳送按鈕（另一個撰寫視窗）就停，避免混到別封信的收件人。
  const HEADER_SEL = 'input[name="subjectbox"]';

  function countSendButtons(n) {
    let c = 0;
    for (const b of n.querySelectorAll('[role="button"]')) if (isSendButtonEl(b)) c++;
    return c;
  }

  function composeRootOf(el) {
    let n = el && el.parentElement;
    let body = null;
    for (let i = 0; n && i < 30; i++, n = n.parentElement) {
      if (!body) {
        if (!n.querySelector(EDITABLE_SEL)) continue;
        body = n;
      } else if (countSendButtons(n) > 1) {
        break;
      }
      if (n.querySelector(HEADER_SEL)) return n;
    }
    return body;
  }

  function sendButtonFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const btn = target.closest('[role="button"]');
    if (!isSendButtonEl(btn)) return null;
    return composeRootOf(btn) ? btn : null;
  }

  // 從游標所在位置（內文 / 主旨）往上找最近的一顆傳送按鈕
  function sendButtonNear(el) {
    let n = el instanceof Element ? el : null;
    for (let i = 0; n && i < 30; i++, n = n.parentElement) {
      for (const c of n.querySelectorAll('[role="button"]')) {
        if (isSendButtonEl(c) && composeRootOf(c)) return c;
      }
    }
    return null;
  }

  // ---------- 讀取收件人 ----------
  function fieldOf(chip, root) {
    let n = chip.parentElement;
    for (let i = 0; n && n !== root.parentElement && i < 12; i++, n = n.parentElement) {
      const labelled = n.querySelectorAll('input[aria-label], textarea[aria-label], [role="combobox"][aria-label], [role="listbox"][aria-label]');
      for (const l of labelled) {
        const label = l.getAttribute('aria-label') || '';
        for (const [field, re] of FIELD_RES) if (re.test(label)) return field;
      }
      const own = n.getAttribute && n.getAttribute('aria-label');
      if (own) for (const [field, re] of FIELD_RES) if (re.test(own)) return field;
    }
    return 'unknown';
  }

  function parseAddressList(str) {
    // "王小明 <a@b.com>, c@d.com"
    const out = [];
    for (const part of str.split(/[,;]\s*/)) {
      const m = part.match(EMAIL_RE);
      if (!m) continue;
      const name = part.replace(/<[^>]*>/, '').replace(m[0], '').replace(/["']/g, '').trim();
      out.push({ email: m[0].toLowerCase(), name });
    }
    return out;
  }

  function readRecipients(root) {
    const result = { to: [], cc: [], bcc: [], unknown: [] };
    const seen = new Set();
    const add = (field, email, name) => {
      if (!email) return;
      email = email.toLowerCase();
      const key = field + '|' + email;
      if (seen.has(key)) return;
      seen.add(key);
      (result[field] || result.unknown).push({ email, name: (name || '').trim() });
    };

    // 方法 1：隱藏欄位 input[name=to|cc|bcc]
    for (const field of ['to', 'cc', 'bcc']) {
      root.querySelectorAll(`input[name="${field}"], textarea[name="${field}"]`).forEach((inp) => {
        if (inp.value) parseAddressList(inp.value).forEach((r) => add(field, r.email, r.name));
      });
    }

    // 方法 2：頁面上帶有信箱地址的元素（新版 data-hovercard-id、舊版 span[email]）。
    // Gmail 每位收件人有兩份：
    //   膠囊  = 收件人欄位展開時看到的，role="option"，刪除收件人時會立刻更新，是準確的來源。
    //   摘要  = 欄位收合時看到的那行文字，只在收合的瞬間重寫；欄位展開時它被藏起來，內容可能是舊的。
    const els = [...root.querySelectorAll('[data-hovercard-id], span[email], div[email]')]
      .filter((el) => !el.closest(EDITABLE_SEL));                  // 內文、引用內容裡的名字不算
    const isChip = (el) => el.getAttribute('role') === 'option';
    const hasChips = els.some(isChip);
    const everSeen = new Set();                                     // 已經從膠囊讀到的地址（不分欄位）
    const take = (el, fromChip) => {
      const raw = el.getAttribute('data-hovercard-id') || el.getAttribute('email') || '';
      const m = raw.match(EMAIL_RE);
      if (!m) return;
      const email = m[0].toLowerCase();
      // 摘要判斷不出收件者 / 副本的差別，膠囊已經有的地址就不要再從摘要加一次
      if (!fromChip && everSeen.has(email)) return;
      const field = fieldOf(el, root);
      if (field === 'from') return;
      const name = el.getAttribute('data-name') || el.getAttribute('name') || (el.textContent || '').replace(m[0], '').trim();
      add(field, m[0], name && name !== m[0] ? name : '');
      if (fromChip) everSeen.add(email);
    };
    for (const el of els) if (isChip(el)) take(el, true);
    for (const el of els) {
      if (isChip(el)) continue;
      // 有膠囊可讀、而這個元素目前沒有顯示在畫面上：它是被藏起來的舊摘要，可能含有已刪除的收件人，略過。
      // 沒有膠囊（舊版介面）或元素看得見時照常採用，寧可多列也不要漏掉。
      if (hasChips && el.getClientRects().length === 0) continue;
      take(el, false);
    }

    // 已經在明確欄位出現過的地址，從 unknown 移除
    const known = new Set([...result.to, ...result.cc, ...result.bcc].map((r) => r.email));
    result.unknown = result.unknown.filter((r) => !known.has(r.email));
    return result;
  }

  function readSubject(root) {
    const s = root.querySelector('input[name="subjectbox"]');
    if (s && s.value) return s.value;
    const h = document.querySelector('h2.hP');
    return h ? h.textContent.trim() : '';
  }

  function readAttachments(root) {
    const names = new Set();
    root.querySelectorAll('.dL .vI, [data-attachment-name]').forEach((el) => {
      const t = (el.getAttribute('data-attachment-name') || el.textContent || '').trim();
      if (t) names.add(t);
    });
    return [...names];
  }

  // ---------- 風險判斷 ----------
  function accountDomain() {
    const m = (document.title || '').match(EMAIL_RE);
    return m ? m[0].split('@')[1].toLowerCase() : '';
  }

  function listFrom(text) {
    return String(text || '').split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  function internalDomains() {
    const list = listFrom(cfg.internalDomains).map((d) => d.replace(/^@/, ''));
    if (!list.length) { const d = accountDomain(); if (d) list.push(d); }
    return list;
  }

  function isGroup(email) {
    const local = email.split('@')[0];
    return listFrom(cfg.groupPatterns).some((p) => {
      if (p.endsWith('@')) return local === p.slice(0, -1);
      if (p.includes('@')) return email === p;
      return local === p;
    });
  }

  // 特別警示名單：a@b.com = 只比對該地址；@b.com 或 b.com = 整個網域（含子網域）；a@ = 任何網域的同名信箱
  function isAlert(email) {
    const [local, domain] = email.split('@');
    return listFrom(cfg.alertPatterns).some((p) => {
      if (p.endsWith('@')) return local === p.slice(0, -1);
      if (p.includes('@') && !p.startsWith('@')) return email === p;
      const d = p.replace(/^@/, '');
      return domain === d || domain.endsWith('.' + d);
    });
  }

  function analyze(recips) {
    const internal = internalDomains();
    const all = [...recips.to, ...recips.cc, ...recips.bcc, ...recips.unknown];
    for (const r of all) {
      const d = r.email.split('@')[1];
      r.external = internal.length ? !internal.some((i) => d === i || d.endsWith('.' + i)) : false;
      r.group = isGroup(r.email);
      r.alert = isAlert(r.email);
    }
    // level: 'high' = 暫停自動寄出；'info' = 只提示
    const warnings = [];
    if (!all.length) warnings.push({ level: 'high', text: t('warnNoRecipients') });
    const ext = all.filter((r) => r.external);
    if (ext.length) {
      const domains = [...new Set(ext.map((r) => r.email.split('@')[1]))];
      warnings.push({ level: 'info', text: t.n('infoExternal', ext.length, domains.join(t('sep'))) });
      if (domains.length > 1) warnings.push({ level: 'high', text: t('warnMultiDomain', domains.length) });
    }
    const groups = all.filter((r) => r.group);
    if (groups.length) warnings.push({ level: 'high', text: t('warnGroup', groups.map((r) => r.email).join(t('sep'))) });
    const alerts = all.filter((r) => r.alert);
    if (alerts.length) warnings.push({ level: 'high', text: t('warnAlert', [...new Set(alerts.map((r) => r.email))].join(t('sep'))) });
    if (!internal.length) warnings.push({ level: 'info', text: t('infoNoDomain') });
    return { all, warnings };
  }

  // ---------- 對話框 ----------
  let overlayHost = null;
  let bypass = false;

  const CSS = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      font: 14px/1.5 "Google Sans", "Noto Sans TC", "Microsoft JhengHei", Roboto, Arial, sans-serif; }
    .dlg { background: #fff; color: #1f1f1f; width: min(560px, 92vw); max-height: 86vh; display: flex;
      flex-direction: column; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.35); overflow: hidden; }
    .hd { padding: 18px 22px 8px; font-size: 18px; font-weight: 600; overflow-wrap: anywhere; }
    .bd { padding: 4px 22px 12px; overflow-y: auto; overflow-x: hidden; overflow-wrap: anywhere; }
    .subj { color: #444; margin-bottom: 10px; word-break: break-all; }
    .subj b { color: #1f1f1f; }
    .warn { background: #fdecea; color: #a50e0e; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; overflow-wrap: anywhere; }
    .info { background: #fef7e0; color: #7a4f01; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; overflow-wrap: anywhere; }
    .warn div + div, .info div + div { margin-top: 4px; }
    .sec { margin-top: 10px; }
    .sec h4 { margin: 0 0 6px; font-size: 13px; color: #5f6368; font-weight: 600; }
    .r { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 8px; min-width: 0; }
    .r:nth-child(odd) { background: #f6f8fc; }
    .r .em { font-family: Consolas, "Roboto Mono", monospace; font-size: 13px; word-break: break-all; }
    .r .nm { color: #5f6368; }
    .tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
    .tag.ext { background: #fce8e6; color: #c5221f; }
    .tag.grp { background: #fef7e0; color: #b06000; }
    .tag.alert { background: #c5221f; color: #fff; }
    .att { color: #444; margin-top: 10px; word-break: break-all; }
    .ft { border-top: 1px solid #e0e0e0; padding: 12px 22px 16px; }
    .bar { height: 4px; background: #e8eaed; border-radius: 2px; overflow: hidden; margin-bottom: 10px; }
    .bar i { display: block; height: 100%; background: #0b57d0; width: 100%; transition: width 1s linear; }
    .row { display: flex; align-items: center; gap: 10px; }
    .msg { flex: 1; color: #444; }
    button { font: inherit; border-radius: 999px; padding: 8px 18px; cursor: pointer; border: 1px solid #747775; background: #fff; color: #0b57d0; }
    button.primary { background: #0b57d0; color: #fff; border-color: #0b57d0; }
    button:disabled { opacity: .6; cursor: default; }
    button:focus-visible { outline: 3px solid #a8c7fa; outline-offset: 1px; }
  `;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderSection(title, list) {
    if (!list.length) return '';
    const rows = list.map((r) => `
      <div class="r">
        <span class="em">${esc(r.email)}</span>
        ${r.name ? `<span class="nm">${esc(r.name)}</span>` : ''}
        ${r.external ? `<span class="tag ext">${esc(t('tagExternal'))}</span>` : ''}
        ${r.group ? `<span class="tag grp">${esc(t('tagGroup'))}</span>` : ''}
        ${r.alert ? `<span class="tag alert">${esc(t('tagAlert'))}</span>` : ''}
      </div>`).join('');
    return `<div class="sec"><h4>${esc(t('section', title, list.length))}</h4>${rows}</div>`;
  }

  function openDialog(sendBtn) {
    if (overlayHost) return;
    const root = composeRootOf(sendBtn) || document.body;
    const recips = readRecipients(root);
    const { all, warnings } = analyze(recips);
    const subject = readSubject(root);
    const atts = readAttachments(root);
    const high = warnings.filter((w) => w.level === 'high');
    const info = warnings.filter((w) => w.level === 'info');
    const hold = cfg.holdOnWarning && high.length > 0;
    let remaining = Math.max(1, parseInt(cfg.countdown, 10) || 15);
    const total = remaining;

    overlayHost = document.createElement('div');
    overlayHost.id = 'gsg-overlay-host';
    const shadow = overlayHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="backdrop">
        <div class="dlg" role="dialog" aria-modal="true" aria-label="${esc(t('dlgAria'))}">
          <div class="hd">${esc(t.n('dlgTitle', all.length))}</div>
          <div class="bd">
            <div class="subj">${esc(t('subject'))}<b>${esc(subject || t('noSubject'))}</b></div>
            ${high.length ? `<div class="warn">${high.map((w) => `<div>⚠ ${esc(w.text)}</div>`).join('')}</div>` : ''}
            ${info.length ? `<div class="info">${info.map((w) => `<div>ℹ ${esc(w.text)}</div>`).join('')}</div>` : ''}
            ${renderSection(t('secTo'), recips.to)}
            ${renderSection(t('secCc'), recips.cc)}
            ${renderSection(t('secBcc'), recips.bcc)}
            ${renderSection(t('secUnknown'), recips.unknown)}
            ${atts.length ? `<div class="att">📎 ${esc(t('attachments'))}${atts.map(esc).join(esc(t('sep')))}</div>` : ''}
          </div>
          <div class="ft">
            ${hold ? '' : '<div class="bar"><i></i></div>'}
            <div class="row">
              <span class="msg"></span>
              <button class="cancel">${esc(t('btnCancel'))}</button>
              <button class="primary send">${esc(t('btnSendNow'))}</button>
            </div>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(overlayHost);

    const $ = (s) => shadow.querySelector(s);
    const msg = $('.msg');
    const bar = $('.bar i');
    let timer = null;
    let paused = false;

    // 收件人含特別警示名單時，按「立即寄出」後再多等幾秒，這段時間還可以取消
    const FINAL_SECONDS = 5;
    const hasAlert = all.some((r) => r.alert);
    let finalTimer = null;
    let finalizing = false;

    const close = () => {
      if (timer) clearInterval(timer);
      if (finalTimer) clearInterval(finalTimer);
      if (overlayHost) overlayHost.remove();
      overlayHost = null;
    };
    const cancel = () => { close(); };
    const send = () => { close(); reallySend(sendBtn); };
    overlayHost._gsgCancel = cancel;

    $('.cancel').addEventListener('click', cancel);
    const confirmSend = () => {
      if (!hasAlert) { send(); return; }
      if (finalizing) return;
      finalizing = true;
      if (timer) { clearInterval(timer); timer = null; }        // 停掉原本的倒數，改跑最後這幾秒
      const btn = $('.send');
      btn.disabled = true;
      if (bar) bar.style.width = '0%';
      let left = FINAL_SECONDS;
      const show = () => {
        msg.textContent = t('msgFinal', left);
        btn.textContent = t('btnFinal', left);
      };
      show();
      finalTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) { send(); return; }
        show();
      }, 1000);
    };
    $('.send').addEventListener('click', confirmSend);

    if (hold) {
      msg.textContent = t('msgHold');
    } else {
      // 清單長到一頁顯示不完時，要先捲到最底才開始倒數（仍可直接按「立即寄出」）
      const bd = $('.bd');
      const atBottom = () => bd.scrollTop + bd.clientHeight >= bd.scrollHeight - 4;
      let waiting = !atBottom();
      const tick = () => {
        if (finalizing) return;                 // 最後倒數中，不要蓋掉訊息
        msg.textContent = waiting ? t('msgScroll') : paused ? t('msgPaused') : t('msgCountdown', remaining);
        if (bar) bar.style.width = `${(remaining / total) * 100}%`;
      };
      tick();
      const recheck = () => { if (waiting && atBottom()) { waiting = false; tick(); } };
      bd.addEventListener('scroll', recheck);
      // 視窗被放大到整份清單都看得到時，不會有捲動事件，所以尺寸改變時也要重新檢查
      if (typeof ResizeObserver === 'function') new ResizeObserver(recheck).observe(bd);
      timer = setInterval(() => {
        if (paused || waiting) return;
        remaining -= 1;
        if (remaining <= 0) { send(); return; }
        tick();
      }, 1000);
      $('.bd').addEventListener('click', () => { paused = true; tick(); });
    }

    // 預設焦點放在「取消」，避免連按 Enter 直接寄出
    setTimeout(() => $('.cancel').focus(), 0);
  }

  function reallySend(btn) {
    if (!btn.isConnected) {
      alert(t('alertButtonGone'));
      return;
    }
    bypass = true;
    try {
      const r = btn.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      btn.dispatchEvent(new PointerEvent('pointerdown', o));
      btn.dispatchEvent(new MouseEvent('mousedown', o));
      btn.dispatchEvent(new PointerEvent('pointerup', o));
      btn.dispatchEvent(new MouseEvent('mouseup', o));
      btn.dispatchEvent(new MouseEvent('click', o));
    } finally {
      setTimeout(() => { bypass = false; }, 300);
    }
  }

  // ---------- 診斷資訊 ----------
  // 使用者主動按「複製診斷資訊」時才會執行。只描述撰寫視窗裡「收件人相關元素」的結構，
  // 不含主旨、內文、附件；信箱地址會遮蔽（只留前兩個字與網域），顯示名稱不輸出。
  function maskEmail(e) {
    const m = String(e || '').match(EMAIL_RE);
    if (!m) return '';
    const [local, domain] = m[0].toLowerCase().split('@');
    return local.slice(0, 2) + '***@' + domain;
  }
  function describe(el, root) {
    const visible = el.getClientRects().length > 0;
    const chain = [];
    let hiddenBy = '';
    for (let n = el, i = 0; n && n !== root.parentElement && i < 8; n = n.parentElement, i++) {
      const cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).slice(0, 4).join('.');
      chain.push(n.tagName.toLowerCase() + (cls ? '.' + cls : '') + (n.getAttribute('role') ? '[role=' + n.getAttribute('role') + ']' : ''));
      if (!hiddenBy) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none') hiddenBy = 'display:none@' + i;
        else if (cs.visibility === 'hidden') hiddenBy = 'visibility:hidden@' + i;
        else if (n.getAttribute('aria-hidden') === 'true') hiddenBy = 'aria-hidden@' + i;
        else if (n.hasAttribute('hidden')) hiddenBy = 'hidden-attr@' + i;
      }
    }
    return { visible, hiddenBy, chain: chain.join(' < ') };
  }
  function diagnose() {
    const roots = new Set();
    for (const b of document.querySelectorAll('[role="button"]')) {
      if (!isSendButtonEl(b)) continue;
      const r = composeRootOf(b);
      if (r) roots.add(r);
    }
    const out = { version: 1, url: location.pathname, composeCount: roots.size, composes: [] };
    for (const root of roots) {
      const c = { inputs: [], chips: [], result: {} };
      for (const inp of root.querySelectorAll('input[name="to"], input[name="cc"], input[name="bcc"], textarea[name="to"], textarea[name="cc"], textarea[name="bcc"]')) {
        c.inputs.push({ tag: inp.tagName.toLowerCase(), name: inp.name, type: inp.type || '',
          values: parseAddressList(inp.value || '').map((r) => maskEmail(r.email)), ...describe(inp, root) });
      }
      for (const chip of root.querySelectorAll('[data-hovercard-id], span[email], div[email]')) {
        const raw = chip.getAttribute('data-hovercard-id') || chip.getAttribute('email') || '';
        if (!EMAIL_RE.test(raw)) continue;
        c.chips.push({ email: maskEmail(raw), attr: chip.hasAttribute('data-hovercard-id') ? 'data-hovercard-id' : 'email',
          inBody: !!chip.closest(EDITABLE_SEL), field: fieldOf(chip, root),
          selected: chip.getAttribute('aria-selected') || '', ...describe(chip, root) });
      }
      // 附件元素：不輸出檔名，只留副檔名與結構，用來確認附件的讀取方式是否正確
      c.attachments = [];
      for (const el of root.querySelectorAll('.dL .vI, [data-attachment-name], input[name="attach"], [download_url]')) {
        const nm = (el.getAttribute('data-attachment-name') || el.textContent || '').trim();
        c.attachments.push({ tag: el.tagName.toLowerCase(), ext: (nm.match(/\.([A-Za-z0-9]{1,6})$/) || [, ''])[1], nameLen: nm.length,
          via: el.hasAttribute('data-attachment-name') ? 'data-attachment-name' : el.matches('.dL .vI') ? '.dL .vI' : 'other', ...describe(el, root) });
      }
      c.attachmentsRead = readAttachments(root).length;
      const rec = readRecipients(root);
      for (const k of Object.keys(rec)) c.result[k] = rec[k].map((r) => maskEmail(r.email));
      out.composes.push(c);
    }
    return JSON.stringify(out, null, 1);
  }

  // ---------- 自我檢查 ----------
  // 每隔幾秒看一次：頁面上有撰寫視窗（有主旨欄和內文），卻找不到任何認得的傳送按鈕，
  // 代表 Gmail 改版導致攔截失效。連續兩次都這樣才回報，避免撰寫視窗剛打開、按鈕還沒畫出來時誤報。
  let missCount = 0;
  function healthCheck() {
    let miss = false;
    for (const subj of document.querySelectorAll(HEADER_SEL)) {
      let n = subj.parentElement, root = null;
      for (let i = 0; n && i < 30; i++, n = n.parentElement) {
        if (n.querySelector(EDITABLE_SEL)) { root = n; break; }
      }
      if (root && countSendButtons(root) === 0) miss = true;
    }
    missCount = miss ? missCount + 1 : 0;
    const now = missCount >= 2;
    if (now !== broken) { broken = now; reportStatus(); }
  }
  setInterval(healthCheck, 3000);

  // ---------- 攔截事件（window capture，比 Gmail 自己的 handler 更早） ----------
  const insideOverlay = (e) => overlayHost && e.composedPath().includes(overlayHost);

  function onPointer(e) {
    if (bypass || !cfg.enabled || insideOverlay(e)) return;
    const btn = sendButtonFromTarget(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'click') openDialog(btn);
  }
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) =>
    window.addEventListener(t, onPointer, true));

  function onKey(e) {
    if (bypass || !cfg.enabled) return;

    // 對話框開著時：Esc = 取消；其他按鍵不讓 Gmail 收到（避免觸發 Gmail 快捷鍵）
    if (overlayHost) {
      if (e.type === 'keydown' && e.key === 'Escape') {
        e.preventDefault();
        overlayHost._gsgCancel();
      }
      e.stopImmediatePropagation();
      return;
    }

    const ctrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
    const onSendBtn = (e.key === 'Enter' || e.key === ' ') && sendButtonFromTarget(e.target);
    if (!ctrlEnter && !onSendBtn) return;
    const btn = onSendBtn || sendButtonNear(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && !e.repeat) openDialog(btn);
  }
  ['keydown', 'keypress', 'keyup'].forEach((t) => window.addEventListener(t, onKey, true));
})();
