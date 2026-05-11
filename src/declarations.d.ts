declare module '*.scss';
declare module '*.css';

interface Window {
    router: import('./app/router').Router;
}
