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
    if (res.enabled) {
      show('on', '運作中', '在這個分頁按「傳送」或 Ctrl+Enter 時，會先跳出確認視窗。');
    } else {
      show('off', '已停用', '設定裡的「啟用寄出確認」沒有勾選，信會直接寄出。');
    }
  });
});
