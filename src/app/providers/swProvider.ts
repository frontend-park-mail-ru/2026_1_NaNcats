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
