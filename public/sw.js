// 설치 가능한 앱(PWA)을 위한 최소 서비스 워커.
// 가계부 데이터와 잠금 상태가 항상 최신이어야 해서 응답을 캐시하지 않고 네트워크로 그대로 보낸다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
