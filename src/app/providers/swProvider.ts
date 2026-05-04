/**
 * Регистрирует сервис-воркер `/sw.js` после события `load`.
 *
 * Регистрация пропускается на `localhost`, чтобы воркер не мешал отладке и не
 * подменял свежие ассеты закэшированными, а также при отсутствии поддержки
 * Service Worker API в браузере. Ошибки регистрации не пробрасываются:
 * приложение продолжает работать без офлайн-кэша.
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
