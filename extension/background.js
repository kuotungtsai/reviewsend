// 第一次安裝時自動打開設定頁，請使用者填寫公司內部網域。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

// Gmail 分頁裡的 content script 回報狀態後，在該分頁的工具列圖示右下角畫一個小圓點：
// 綠色 = 運作中，灰色 = 已停用，紅色 = 可能失效（認不出傳送按鈕）。其他分頁維持原本的圖示，代表擴充套件在那裡不作用。
// （Chrome 內建的文字標記大小不能調整，會蓋住半個圖示，所以自己畫。）
const SIZES = [16, 32];
const bitmaps = {};

async function baseIcon(size) {
  if (!bitmaps[size]) {
    const res = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
    bitmaps[size] = await createImageBitmap(await res.blob());
  }
  return bitmaps[size];
}

async function iconWithDot(color) {
  const imageData = {};
  for (const size of SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(await baseIcon(size), 0, 0, size, size);
    const r = size * 0.2;                       // 圓點半徑
    const c = size - r - size * 0.04;           // 圓心（右下角）
    ctx.beginPath(); ctx.arc(c, c, r + size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();         // 白色外圈，讓圓點和盾牌分開
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'gsg-status' || !sender.tab) return;
  const tabId = sender.tab.id;
  chrome.action.setBadgeText({ tabId, text: '' });
  chrome.action.setTitle({
    tabId,
    // 文字由分頁裡的 content script 依使用者選的語言產生
    title: typeof msg.title === 'string' && msg.title ? msg.title.slice(0, 200) : 'ReviewSend'
  });
  iconWithDot(msg.broken ? '#d93025' : msg.enabled ? '#188038' : '#80868b')
    .then((imageData) => chrome.action.setIcon({ tabId, imageData }))
    .catch(() => { /* 畫不出來就維持原本的圖示 */ });
});
