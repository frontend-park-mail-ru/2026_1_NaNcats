/**
 * Публичный барель peer-layout-shell-ов приложения.
 *
 * Снаружи доступны ровно два компонента: RootLayout и AuthLayout. App.tsx
 * переключается между ними через router.currentLayout, никакой третий shell
 * на этом уровне не предусмотрен.
 */

export { RootLayout } from './RootLayout';
export { AuthLayout } from './AuthLayout';
