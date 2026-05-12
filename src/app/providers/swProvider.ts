/**
 * Регистрирует сервис-воркер `/sw.js` после события `load`.
 *
 * Пропускается на localhost (чтобы воркер не подменял свежие ассеты при отладке)
 * и при отсутствии Service Worker API. Ошибки регистрации не пробрасываются.
 */
export const initServiceWorker = (): void => {
    if (window.location.hostname === 'localhost') return;
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => console.log('ServiceWorker registered:', reg.scope))
            .catch((err) => console.log('ServiceWorker registration failed:', err));
    });
};
