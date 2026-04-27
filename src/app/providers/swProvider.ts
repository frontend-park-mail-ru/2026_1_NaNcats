export const initServiceWorker = (): void => {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => console.log('ServiceWorker registered:', reg.scope))
            .catch((err) => console.log('ServiceWorker registration failed:', err));
    });
};
