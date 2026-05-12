/**
 * Универсальный скелетон-плейсхолдер для страниц: показывается Outlet-ом, пока
 * loader роута и dynamic-import чанка страницы не разрешились. Полоса-заголовок
 * и сетка из шести плиток с пульс-анимацией; стили в `PageLoadingSkeleton.scss`
 * подключаются глобально. Статичен: ни сигналов, ни effect-ов.
 */

import './PageLoadingSkeleton.scss';
import type { VNode } from '@shared/lib/vdom';

/**
 * Возвращает VNode-дерево скелетона страницы.
 *
 * @returns VNode с заголовком-плейсхолдером и сеткой из шести плиток.
 */
export function PageLoadingSkeleton(): VNode {
    return (
        <div class="page-loading-skeleton" aria-busy="true" aria-live="polite">
            <div class="page-loading-skeleton__header" />
            <div class="page-loading-skeleton__grid">
                <div class="page-loading-skeleton__tile" />
                <div class="page-loading-skeleton__tile" />
                <div class="page-loading-skeleton__tile" />
                <div class="page-loading-skeleton__tile" />
                <div class="page-loading-skeleton__tile" />
                <div class="page-loading-skeleton__tile" />
            </div>
        </div>
    ) as VNode;
}
