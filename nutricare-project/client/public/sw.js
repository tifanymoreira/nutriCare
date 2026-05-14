const CACHE_NAME = 'nutricare-cache-v1';

// Lista de arquivos estáticos essenciais para o funcionamento offline básico
const urlsToCache = [
  '/',
  '/pages/login.html',
  '/css/style.css',
  '/js/login.js',
  '/manifest.json',
  '/images/logo-mae.png'
];

// 1. Evento de Instalação: Salva os arquivos estáticos no cache do navegador
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto com sucesso');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 2. Evento de Ativação: Limpa caches antigos se a versão (CACHE_NAME) mudar
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Deletando cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Evento de Fetch (Requisição): Intercepta a rede e serve o cache se estiver offline
self.addEventListener('fetch', (event) => {
  // Ignora requisições da API (não queremos cachear chamadas ao banco de dados)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retorna o cache se encontrar, senão vai para a rede (fetch normal)
        return response || fetch(event.request);
      })
  );
});