/**
 * Публичный барель обёрток над браузерными API анимаций переходов.
 *
 * Сейчас здесь живёт только startViewTransition: обёртка над View Transitions
 * API с graceful fallback для рантаймов без поддержки. По мере роста потребностей
 * (например, поддержка scoped-view-transitions или Web Animations API helpers)
 * новые экспорты добавляются сюда же.
 */

export { startViewTransition } from './startViewTransition';
