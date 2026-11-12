// 點工具列圖示時顯示：這個分頁上擴充套件有沒有在運作。
const show = (cls, title, detail) => {
  document.getElementById('state').className = 'state ' + cls;
  document.getElementById('title').textContent = title;
  document.getElementById('detail').textContent = detail;
};

document.getElementById('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

let t = ReviewSendI18n.make('auto');
ReviewSendI18n.apply(document, t);

const refresh = () => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab) return show('', t('popUnknown'), t('popNoTab'));
  // 只有 Gmail 分頁裡的 content script 會回應
  chrome.tabs.sendMessage(tab.id, { type: 'gsg-ping' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      return show('', t('popInactive'), t('popInactiveDetail'));
    }
    if (res.broken && res.enabled) {
      return show('off', t('popBroken'), t('popBrokenDetail'));
    }
    if (res.enabled) {
      show('on', t(res.forced ? 'popOnForced' : 'popOn'), t('popOnDetail'));
    } else {
      show('off', t('popOff'), t('popOffDetail'));
    }
  });
});

// 先讀使用者選的語言再顯示狀態
chrome.storage.sync.get({ language: 'auto' }, (v) => {
  t = ReviewSendI18n.make(v && v.language);
  ReviewSendI18n.apply(document, t);
  refresh();
});

// 複製診斷資訊：收件人顯示不正確時，把撰寫視窗的結構（地址已遮蔽，不含主旨與內文）複製到剪貼簿，方便回報。
document.getElementById('diag').addEventListener('click', () => {
  const out = document.getElementById('diagMsg');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) { out.textContent = t('popNoTab'); return; }
    chrome.tabs.sendMessage(tab.id, { type: 'gsg-diagnose' }, async (res) => {
      if (chrome.runtime.lastError || !res || !res.report) {
        out.textContent = t('popDiagUnavailable');
        return;
      }
      try {
        await navigator.clipboard.writeText(res.report);
        out.textContent = t('popDiagCopied');
      } catch (_) {
        out.textContent = t('popDiagFailed') + res.report.slice(0, 200);
      }
    });
  });
});
