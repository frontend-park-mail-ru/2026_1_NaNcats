/**
 * @file Сервис-воркер приложения.
 *
 * Обеспечивает офлайн-доступ и ускоряет повторные загрузки за счёт кэша.
 * Стратегия кэширования зависит от типа запроса. Для API (префикс `/api/`)
 * применяется network-first: свежий ответ кладётся в кэш и используется как
 * фоллбэк только при сетевой ошибке. Для остальных GET-запросов работает
 * stale-while-revalidate: сначала отдаётся закэшированный ответ, параллельно
 * фоном обновляется. Для навигации без сети возвращается закэшированный
 * корень `/`, для прочих запросов без кэша - ответ `503 Offline`.
 *
 * Не-GET запросы воркер не трогает: они уходят сетью без вмешательства.
 */

/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = 'foodcourt-cache-v2';

/**
 * Обработчик `install`: предзагружает оболочку приложения.
 *
 * Кладёт в кэш корень `/` и `/index.html`, чтобы первая офлайн-навигация уже
 * имела точку входа. `skipWaiting()` форсирует переход новой версии воркера
 * в активное состояние, не дожидаясь закрытия всех клиентов.
 */
sw.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(['/', '/index.html']);
        }),
    );
    sw.skipWaiting();
});

/**
 * Обработчик `activate`: чистит устаревшие кэши и забирает управление.
 *
 * Удаляет все кэши, чьё имя не совпадает с текущим `CACHE_NAME`, чтобы не
 * раздавать ассеты прошлых версий приложения. `clients.claim()` заставляет
 * уже открытые вкладки начать общаться с новым воркером сразу, без перезагрузки.
 */
sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                }),
            );
        }),
    );
    sw.clients.claim();
});

/**
 * Обработчик `fetch`: применяет стратегию кэширования к исходящим запросам.
 *
 * Не-GET запросы пропускаются без вмешательства, чтобы мутации шли только
 * сетью. Запросы к `/api/` идут по network-first: успешный ответ клонируется
 * в кэш, при сетевой ошибке отдаётся последний закэшированный. Прочие GET
 * идут по stale-while-revalidate: при наличии кэшированного ответа он
 * возвращается сразу, а сеть тихо обновляет кэш фоном; при отсутствии кэша
 * запрос уходит в сеть и его ответ кладётся в кэш. Если сети нет и в кэше
 * пусто, навигационный запрос получает закэшированный `/`, остальные -
 * синтетический ответ `503 Offline`.
 */
sw.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request) as Promise<Response>),
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request)
                    .then((response) => {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
                    })
                    .catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/') as Promise<Response>;
                    }
                    return new Response('Offline', { status: 503 });
                });
        }),
    );
});
