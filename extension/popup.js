// 點工具列圖示時顯示：這個分頁上擴充套件有沒有在運作。
const show = (cls, title, detail) => {
  document.getElementById('state').className = 'state ' + cls;
  document.getElementById('title').textContent = title;
  document.getElementById('detail').textContent = detail;
};

document.getElementById('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab) return show('', '無法判斷', '找不到目前的分頁。');
  // 只有 Gmail 分頁裡的 content script 會回應
  chrome.tabs.sendMessage(tab.id, { type: 'gsg-ping' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      return show('', '這個分頁沒有作用',
        '擴充套件只在 Gmail 網頁運作。如果這就是 Gmail，請重新整理這個分頁一次。');
    }
    if (res.broken && res.enabled) {
      return show('off', '可能失效',
        '這個分頁有撰寫視窗，但認不出 Gmail 的傳送按鈕，可能是 Gmail 改版。寄信前請自行確認收件人，並回報給維護者。');
    }
    if (res.enabled) {
      show('on', res.forced ? '運作中（由管理員啟用）' : '運作中',
        '在這個分頁按「傳送」或 Ctrl+Enter 時，會先跳出確認視窗。');
    } else {
      show('off', '已停用', '設定裡的「啟用寄出確認」沒有勾選，信會直接寄出。');
    }
  });
});

// 複製診斷資訊：收件人顯示不正確時，把撰寫視窗的結構（地址已遮蔽，不含主旨與內文）複製到剪貼簿，方便回報。
document.getElementById('diag').addEventListener('click', () => {
  const out = document.getElementById('diagMsg');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) { out.textContent = '找不到目前的分頁。'; return; }
    chrome.tabs.sendMessage(tab.id, { type: 'gsg-diagnose' }, async (res) => {
      if (chrome.runtime.lastError || !res || !res.report) {
        out.textContent = '這個分頁無法產生診斷資訊。請在 Gmail 分頁、撰寫視窗開著的時候再按一次。';
        return;
      }
      try {
        await navigator.clipboard.writeText(res.report);
        out.textContent = '已複製到剪貼簿。內容只有頁面結構，信箱地址已遮蔽，不含主旨與內文。';
      } catch (_) {
        out.textContent = '無法寫入剪貼簿：' + res.report.slice(0, 200);
      }
    });
  });
});
