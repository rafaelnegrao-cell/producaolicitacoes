/* Service worker simples.
   Assets estaticos: cache-first (ja vem versionado por ?v=APP_VERSION).
   API: sempre rede — dado de licitacao e prazo nao pode ser servido velho. */
'use strict';

const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'producao-licitacoes-' + VERSAO;

const ESSENCIAIS = [
  '/',
  '/css/app.css?v=' + VERSAO,
  '/js/api.js?v=' + VERSAO,
  '/js/ui.js?v=' + VERSAO,
  '/js/router.js?v=' + VERSAO,
  '/js/app.js?v=' + VERSAO,
  '/js/views/login.js?v=' + VERSAO,
  '/js/views/dashboard.js?v=' + VERSAO,
  '/js/views/em-breve.js?v=' + VERSAO,
  '/manifest.json'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ESSENCIAIS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* offline no install: segue sem pre-cache */ })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (chaves) {
        return Promise.all(chaves.map(function (chave) {
          return chave === CACHE ? null : caches.delete(chave);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API nunca sai do cache.
  if (url.pathname.indexOf('/api/') === 0) return;

  // Navegacao: rede primeiro, cache como plano B (modo offline).
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req).catch(function () {
        return caches.match('/').then(function (r) {
          return r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then(function (cacheado) {
      if (cacheado) return cacheado;
      return fetch(req).then(function (resposta) {
        if (resposta && resposta.ok && resposta.type === 'basic') {
          const copia = resposta.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copia); });
        }
        return resposta;
      });
    })
  );
});
