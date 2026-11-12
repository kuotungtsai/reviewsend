/*
 * ReviewSend 介面文字（繁體中文 / English）。
 * 語言由設定頁的「語言」決定：auto = 跟隨瀏覽器介面語言（中文系顯示繁體中文，其餘顯示英文）。
 * 用法：const t = ReviewSendI18n.make(pref);  t('key', 參數0, 參數1)
 *       t.n('key', 數量, 參數...)  數量為 1 且該語言有 key_one 時改用 key_one（英文單數）。
 */
// eslint-disable-next-line no-unused-vars
const ReviewSendI18n = (() => {
  'use strict';

  const M = {
    'zh-TW': {
      sep: '、',
      section: '{0}（{1}）',
      // 標籤
      tagExternal: '外部',
      tagInternal: '內部',
      tagGroup: '群組',
      tagAlert: '特別警示',
      // 確認視窗
      dlgAria: '確認寄出',
      dlgTitle: '確認寄出（共 {0} 位收件人）',
      subject: '主旨：',
      noSubject: '（無主旨）',
      secTo: '收件者',
      secCc: '副本',
      secBcc: '密件副本',
      secUnknown: '收件人（欄位不明）',
      attachments: '附件：',
      btnCancel: '取消，返回編輯',
      btnSendNow: '立即寄出',
      warnNoRecipients: '讀不到任何收件人，可能是 Gmail 介面改版。請自行確認收件人後再寄出。',
      infoExternal: '含 {0} 位外部收件人（{1}）',
      warnMultiDomain: '同時寄給 {0} 個不同的外部網域，請確認沒有混到其他客戶',
      warnGroup: '含群組地址：{0}',
      warnAlert: '含特別警示地址：{0}',
      infoNoDomain: '無法判斷公司網域，請到擴充套件選項設定',
      msgHold: '有警示，不會自動寄出，請確認後手動按「立即寄出」。',
      msgScroll: '收件人較多，請往下捲到最後確認，才會開始倒數。',
      msgPaused: '已暫停倒數',
      msgCountdown: '{0} 秒後自動寄出（點清單可暫停）',
      msgFinal: '含特別警示地址，{0} 秒後寄出。要反悔請按「取消，返回編輯」。',
      btnFinal: '{0} 秒後寄出',
      alertButtonGone: 'ReviewSend：找不到原本的傳送按鈕（撰寫視窗可能已關閉），信件沒有寄出。',
      // 工具列圖示提示
      titleOn: 'ReviewSend：運作中',
      titleOff: 'ReviewSend：已停用',
      titleBroken: 'ReviewSend：可能失效，認不出 Gmail 的傳送按鈕',
      // 彈出視窗
      popChecking: '檢查中…',
      popOpenOptions: '開啟設定',
      popCopyDiag: '複製診斷資訊',
      popUnknown: '無法判斷',
      popNoTab: '找不到目前的分頁。',
      popInactive: '這個分頁沒有作用',
      popInactiveDetail: '擴充套件只在 Gmail 網頁運作。如果這就是 Gmail，請重新整理這個分頁一次。',
      popBroken: '可能失效',
      popBrokenDetail: '這個分頁有撰寫視窗，但認不出 Gmail 的傳送按鈕，可能是 Gmail 改版。寄信前請自行確認收件人，並回報給維護者。',
      popOn: '運作中',
      popOnForced: '運作中（由管理員啟用）',
      popOnDetail: '在這個分頁按「傳送」或 Ctrl+Enter 時，會先跳出確認視窗。',
      popOff: '已停用',
      popOffDetail: '設定裡的「啟用寄出確認」沒有勾選，信會直接寄出。',
      popDiagUnavailable: '這個分頁無法產生診斷資訊。請在 Gmail 分頁、撰寫視窗開著的時候再按一次。',
      popDiagCopied: '已複製到剪貼簿。內容只有頁面結構，信箱地址已遮蔽，不含主旨與內文。',
      popDiagFailed: '無法寫入剪貼簿：',
      // 設定頁
      optTitle: 'ReviewSend - 設定',
      optLangAuto: '自動（跟隨瀏覽器）',
      optIntro: '按下 Gmail 的「傳送」後，會先跳出視窗列出所有收件人並倒數，確認後才真正寄出。每一項設定右邊都有說明，改了之後可以在最下面的「試試看」馬上看到效果。',
      optSetup: '第一次使用？請先填寫第 1 項「公司內部網域」再按最下面的「儲存」。',
      optH1: '公司內部網域',
      optHelp1: '<b>用來判斷誰是「外部」收件人。</b><ul>'
        + '<li>一行一個，例如 <code>example.com</code>。</li>'
        + '<li>不在這份清單裡的網域，收件人會標 <span class="tag ext">外部</span>。</li>'
        + '<li>子網域（例如 <code>tw.example.com</code>）也算內部。</li>'
        + '<li>留白時，會改用目前登入 Gmail 帳號的網域。</li></ul>',
      optH2: '倒數秒數',
      optSeconds: '秒',
      optPlay: '播放倒數示範',
      optHelp2: '<b>確認視窗出現後，等多久自動寄出。</b><ul>'
        + '<li>倒數中可以按「立即寄出」或「取消，返回編輯」。</li>'
        + '<li>按 Esc 等於取消；點一下收件人清單可暫停倒數。</li>'
        + '<li>收件人多到一頁顯示不完時，要先捲到清單最底才開始倒數。</li>'
        + '<li>可設 1 到 120 秒。</li></ul>',
      optH3: '群組地址',
      optHelp3: '<b>一次會寄給很多人的地址。</b>命中時標 <span class="tag grp">群組</span> 並出現紅色警示。<ul>'
        + '<li><code>all@</code>：任何網域的 all 信箱。</li>'
        + '<li><code>team@example.com</code>：只比對這個地址。</li></ul>',
      optH4: '特別警示名單',
      optHelp4: '<b>你想特別小心的收件人。</b>命中時標 <span class="tag alert">特別警示</span> 並出現紅色警示；按「立即寄出」後還會再倒數 5 秒，可以反悔。<ul>'
        + '<li><code>boss@example.com</code>：只比對這個地址。</li>'
        + '<li><code>@competitor.com</code>：整個網域（含子網域）。</li>'
        + '<li><code>ceo@</code>：任何網域的 ceo 信箱。</li></ul>',
      optH5: '開關',
      optHold: '有紅色警示時不自動寄出',
      optEnabled: '啟用寄出確認',
      optHelp5: '<ul><li><b>紅色警示</b>包含：群組地址、特別警示名單、同時寄給多個外部網域、讀不到收件人。勾選後遇到這些情況必須手動按「立即寄出」。</li>'
        + '<li><b>啟用寄出確認</b>取消勾選後，Gmail 會恢復成按下傳送就直接寄出。</li></ul>',
      optStepTry: '試',
      optHTry: '試試看',
      optTryPlaceholder: '輸入一個收件人地址，例如 someone@gmail.com',
      optHelpTry: '<b>不用真的寄信就能確認設定。</b><ul>'
        + '<li>輸入任何地址，會用上面目前填的內容（還沒儲存也算）判斷它會被標成什麼。</li>'
        + '<li>確認結果符合預期後，再按「儲存」。</li></ul>',
      optSave: '儲存',
      optExport: '下載設定檔',
      optImport: '上傳設定檔',
      optNote1: '「下載設定檔」會把畫面上目前的設定存成一個 JSON 檔，可以傳給同事或備份；「上傳設定檔」會把檔案內容填進上面的欄位，確認後按「儲存」才會生效。設定檔裡會包含你填的公司網域與名單，分享前請留意。',
      optNote2: '儲存後請重新整理已開啟的 Gmail 分頁。所有檢查都在你的電腦上完成，不會把信件內容或收件人傳到任何地方。從「排定傳送」寄出的信與手機 App 不會被攔截。',
      optLocked: '由管理員設定',
      optManagedList: '由管理員設定（不可移除）：{0}',
      optDomainLive: '目前視為內部：{0}',
      optDomainEmpty: '目前留白：會自動使用登入 Gmail 帳號的網域。',
      optCountLive: '確認視窗會顯示「{0} 秒後自動寄出」',
      optDemoTick: '{0} 秒後自動寄出（示範，不會真的寄信）',
      optDemoEnd: '示範結束：實際使用時，信會在這個時候寄出。',
      optTryEmpty: '在上面輸入地址，這裡會顯示判斷結果。',
      optTryInvalid: '請輸入完整的信箱地址。',
      optTryHold: '會出現紅色警示，不會自動寄出，必須手動按「立即寄出」。',
      optTryNoHold: '會出現紅色警示，但仍會倒數後自動寄出（第 5 項沒有勾選）。',
      optTryNoDomain: '第 1 項留白，內部或外部要到 Gmail 裡依登入帳號判斷，這裡無法預覽。',
      optTryOk: '沒有紅色警示，{0} 秒後自動寄出。',
      optSaved: '已儲存，請重新整理 Gmail 分頁',
      optExported: '已下載設定檔（內容為畫面上目前的設定）',
      optImported: '已載入設定檔，請確認內容後按「儲存」才會生效',
      optImportFailed: '無法載入：{0}',
      errJson: '不是有效的 JSON 檔',
      errNotConfig: '不是這個擴充套件的設定檔',
      errField: '欄位 {0} 的格式不對',
      errTooBig: '檔案太大'
    },

    en: {
      sep: ', ',
      section: '{0} ({1})',
      tagExternal: 'External',
      tagInternal: 'Internal',
      tagGroup: 'Group',
      tagAlert: 'Alert',
      dlgAria: 'Confirm send',
      dlgTitle: 'Confirm send ({0} recipients)',
      dlgTitle_one: 'Confirm send (1 recipient)',
      subject: 'Subject: ',
      noSubject: '(no subject)',
      secTo: 'To',
      secCc: 'Cc',
      secBcc: 'Bcc',
      secUnknown: 'Recipients (field unknown)',
      attachments: 'Attachments: ',
      btnCancel: 'Cancel, keep editing',
      btnSendNow: 'Send now',
      warnNoRecipients: 'No recipients could be read. Gmail may have changed its layout. Check the recipients yourself before sending.',
      infoExternal: '{0} external recipients ({1})',
      infoExternal_one: '1 external recipient ({1})',
      warnMultiDomain: 'Going to {0} different external domains. Make sure you are not mixing up customers.',
      warnGroup: 'Includes group address: {0}',
      warnAlert: 'Includes alert-list address: {0}',
      infoNoDomain: 'Your company domain is unknown. Set it in the extension options.',
      msgHold: 'There are warnings, so this will not send automatically. Check, then click "Send now".',
      msgScroll: 'Long recipient list: scroll to the end to start the countdown.',
      msgPaused: 'Countdown paused',
      msgCountdown: 'Sending in {0} s (click the list to pause)',
      msgFinal: 'Alert-list recipient: sending in {0} s. Click "Cancel, keep editing" to stop.',
      btnFinal: 'Sending in {0} s',
      alertButtonGone: 'ReviewSend: the original Send button is gone (the compose window may have been closed). The email was not sent.',
      titleOn: 'ReviewSend: active',
      titleOff: 'ReviewSend: turned off',
      titleBroken: 'ReviewSend: may not be working (Gmail\'s Send button was not recognised)',
      popChecking: 'Checking…',
      popOpenOptions: 'Open settings',
      popCopyDiag: 'Copy diagnostics',
      popUnknown: 'Unknown',
      popNoTab: 'The current tab could not be found.',
      popInactive: 'Not active on this tab',
      popInactiveDetail: 'The extension only works on Gmail. If this is Gmail, reload this tab once.',
      popBroken: 'May not be working',
      popBrokenDetail: 'This tab has a compose window, but Gmail\'s Send button was not recognised. Gmail may have changed. Check your recipients yourself before sending, and report this to the maintainer.',
      popOn: 'Active',
      popOnForced: 'Active (enabled by your administrator)',
      popOnDetail: 'Clicking Send or pressing Ctrl+Enter on this tab shows the confirmation dialog first.',
      popOff: 'Turned off',
      popOffDetail: '"Enable send confirmation" is unchecked in the settings, so emails are sent immediately.',
      popDiagUnavailable: 'Diagnostics are not available on this tab. Try again on a Gmail tab with a compose window open.',
      popDiagCopied: 'Copied to the clipboard. It contains page structure only: addresses are masked, and there is no subject or body.',
      popDiagFailed: 'Could not write to the clipboard: ',
      optTitle: 'ReviewSend - Settings',
      optLangAuto: 'Auto (follow the browser)',
      optIntro: 'After you click Send in Gmail, a dialog lists every recipient and counts down; the email is only sent once you confirm or the countdown ends. Each setting is explained on its right, and you can see the effect straight away in "Try it" at the bottom.',
      optSetup: 'First time here? Fill in item 1, "Internal domains", then click Save at the bottom.',
      optH1: 'Internal domains',
      optHelp1: '<b>Used to decide who counts as an external recipient.</b><ul>'
        + '<li>One per line, for example <code>example.com</code>.</li>'
        + '<li>Recipients on any other domain are tagged <span class="tag ext">External</span>.</li>'
        + '<li>Subdomains (such as <code>tw.example.com</code>) count as internal.</li>'
        + '<li>If left empty, the domain of the signed-in Gmail account is used.</li></ul>',
      optH2: 'Countdown',
      optSeconds: 'seconds',
      optPlay: 'Play countdown demo',
      optHelp2: '<b>How long the dialog waits before sending automatically.</b><ul>'
        + '<li>During the countdown you can click "Send now" or "Cancel, keep editing".</li>'
        + '<li>Esc cancels; clicking the recipient list pauses the countdown.</li>'
        + '<li>If the list does not fit on one screen, the countdown starts only after you scroll to the end.</li>'
        + '<li>1 to 120 seconds.</li></ul>',
      optH3: 'Group addresses',
      optHelp3: '<b>Addresses that reach many people at once.</b> A match is tagged <span class="tag grp">Group</span> and raises a red warning.<ul>'
        + '<li><code>all@</code>: the "all" mailbox on any domain.</li>'
        + '<li><code>team@example.com</code>: this exact address only.</li></ul>',
      optH4: 'Alert list',
      optHelp4: '<b>Recipients you want to be extra careful with.</b> A match is tagged <span class="tag alert">Alert</span> and raises a red warning; after "Send now" there is a further 5-second countdown during which you can still cancel.<ul>'
        + '<li><code>boss@example.com</code>: this exact address only.</li>'
        + '<li><code>@competitor.com</code>: the whole domain, including subdomains.</li>'
        + '<li><code>ceo@</code>: the "ceo" mailbox on any domain.</li></ul>',
      optH5: 'Switches',
      optHold: 'Do not send automatically when there is a red warning',
      optEnabled: 'Enable send confirmation',
      optHelp5: '<ul><li><b>Red warnings</b> are: a group address, an alert-list address, more than one external domain, or no readable recipients. When checked, you must click "Send now" yourself in these cases.</li>'
        + '<li>Unchecking <b>Enable send confirmation</b> makes Gmail send immediately again.</li></ul>',
      optStepTry: '?',
      optHTry: 'Try it',
      optTryPlaceholder: 'Type a recipient address, e.g. someone@gmail.com',
      optHelpTry: '<b>Check your settings without sending anything.</b><ul>'
        + '<li>Type any address to see how it would be tagged with what is currently filled in above, saved or not.</li>'
        + '<li>Click Save once the result is what you expect.</li></ul>',
      optSave: 'Save',
      optExport: 'Download settings',
      optImport: 'Upload settings',
      optNote1: '"Download settings" saves what is currently on this page as a JSON file you can back up or pass to a colleague. "Upload settings" fills the fields above from a file; nothing takes effect until you click Save. The file contains the domains and lists you entered, so mind who you share it with.',
      optNote2: 'After saving, reload any open Gmail tabs. All checks run on your computer; no email content or recipients are sent anywhere. Emails sent via "Schedule send" or the mobile app are not intercepted.',
      optLocked: 'Set by your administrator',
      optManagedList: 'Set by your administrator (cannot be removed): {0}',
      optDomainLive: 'Treated as internal: {0}',
      optDomainEmpty: 'Empty: the domain of the signed-in Gmail account will be used.',
      optCountLive: 'The dialog will show "Sending in {0} s"',
      optDemoTick: 'Sending in {0} s (demo only, nothing is sent)',
      optDemoEnd: 'Demo finished: in real use the email would be sent now.',
      optTryEmpty: 'Type an address above to see the result here.',
      optTryInvalid: 'Please enter a complete email address.',
      optTryHold: 'Raises a red warning and will not send automatically; you must click "Send now".',
      optTryNoHold: 'Raises a red warning but still sends automatically after the countdown (item 5 is unchecked).',
      optTryNoDomain: 'Item 1 is empty, so internal or external is decided in Gmail from the signed-in account and cannot be previewed here.',
      optTryOk: 'No red warning; sends automatically after {0} s.',
      optSaved: 'Saved. Reload your Gmail tabs.',
      optExported: 'Settings downloaded (what is currently on this page)',
      optImported: 'Settings loaded. Review them, then click Save to apply.',
      optImportFailed: 'Could not load: {0}',
      errJson: 'not a valid JSON file',
      errNotConfig: 'not a settings file for this extension',
      errField: 'field {0} has the wrong format',
      errTooBig: 'the file is too large'
    }
  };

  // 跟隨瀏覽器：中文系介面顯示繁體中文，其餘顯示英文
  function detect() {
    let ui = '';
    try { ui = chrome.i18n.getUILanguage(); } catch (_) { /* 沒有 chrome.i18n 時用瀏覽器語言 */ }
    if (!ui) ui = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    return /^zh\b/i.test(ui) ? 'zh-TW' : 'en';
  }

  const resolve = (pref) => (Object.prototype.hasOwnProperty.call(M, pref) ? pref : detect());

  function make(pref) {
    const lang = resolve(pref);
    const fill = (s, args) => s.replace(/\{(\d)\}/g, (_, i) => (args[i] === undefined ? '' : String(args[i])));
    const raw = (key) => (key in M[lang] ? M[lang][key] : key in M.en ? M.en[key] : key);
    const t = (key, ...args) => fill(raw(key), args);
    t.n = (key, count, ...args) => fill(raw(count === 1 && (key + '_one') in M[lang] ? key + '_one' : key), [count, ...args]);
    t.lang = lang;
    return t;
  }

  // 套用到頁面：data-i18n = 文字、data-i18n-html = 含標記的說明、data-i18n-placeholder = 輸入框提示
  function apply(doc, t) {
    doc.documentElement.lang = t.lang === 'zh-TW' ? 'zh-Hant' : 'en';
    doc.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    doc.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  return { languages: Object.keys(M), keys: (lang) => Object.keys(M[lang]), resolve, make, apply };
})();
