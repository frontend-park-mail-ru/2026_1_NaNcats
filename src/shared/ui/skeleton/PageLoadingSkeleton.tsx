/**
 * Универсальный скелетон-плейсхолдер для страниц.
 *
 * Показывается Outlet-ом, пока loader текущего роута и dynamic-import чанка
 * страницы ещё не разрешились. Состоит из условной полосы-заголовка и сетки
 * из шести серых плиток с пульс-анимацией. Конкретные стили описаны в
 * `PageLoadingSkeleton.scss` и подключаются глобально, без CSS Modules:
 * скелетон не зависит от страницы и не должен конкурировать с её разметкой.
 *
 * Реализация намеренно статическая: внутри нет ни сигналов, ни effect-ов,
 * поэтому ребрейндинг между переходами обходится дешёво, а unmount при
 * получении ready-стейта не оставляет висящих подписок.
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
