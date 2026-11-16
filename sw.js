// 離線快取：第一次打開後，沒有網路也能練習。版本號由 build.py 填入，網站更新時自動換新快取。
const CACHE = 'gsat1800-24f7b703';
const CORE = ['./', './index.html', './app.css?v=24f7b703', './app.js?v=24f7b703', './data.js?v=24f7b703', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gsat1800-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    // 頁面本身：先上網拿最新版，離線時用快取
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // 其他檔案（帶版本號）與字型：有快取就用快取
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })));
});
