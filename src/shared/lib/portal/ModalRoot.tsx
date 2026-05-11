/**
 * Компонент ModalRoot: реактивный приёмник стека модалок.
 *
 * Каждый layout-shell (RootLayout, AuthLayout) рендерит у себя ровно один
 * ModalRoot прямо после своего `<div id="modal-root"/>`. ModalRoot подписан на
 * сигнальный modalStack через <For> и для каждой записи создаёт createPortal
 * в `#modal-root`. Когда запись пушится или попается, <For> сам аккуратно
 * монтирует или размонтирует соответствующий портал, не трогая остальные.
 *
 * Порядок монтирования. JSX-дерево layout-а сначала кладёт `<div id="modal-root"/>`,
 * а уже потом `<ModalRoot/>`. Дети VDOM монтируются по порядку, поэтому к
 * моменту, когда ModalRoot отрабатывает свой первый эффект и пытается найти
 * `#modal-root` через document.querySelector, div уже находится в документе.
 * Без этой раскладки createPortal кинул бы исключение про ненайденный селектор.
 */

import { For, createPortal } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { modalStack } from './modalStack';
import type { ModalEntry } from './modalStack';

/**
 * Селектор контейнера, в который ModalRoot отправляет каждую модалку.
 *
 * Один и тот же селектор используется обоими layout-ами: одновременно
 * существует ровно один `<div id="modal-root"/>`, потому что layout-shell-ы
 * peer-эксклюзивны (см. App.tsx и Router.currentLayout).
 */
const MODAL_ROOT_SELECTOR = '#modal-root';

/**
 * Компонент-приёмник: рендерит стек модалок в `#modal-root` через порталы.
 *
 * Сам по себе ModalRoot не создаёт видимых узлов в обычном потоке layout-а:
 * <For> ставит anchor-комментарий, а его дети это порталы, которые уходят в
 * другой контейнер. То есть позиция `<ModalRoot/>` в JSX layout-а влияет
 * только на момент монтирования, не на визуальный поток.
 *
 * @returns VNode с реактивным <For> над modalStack.
 */
export function ModalRoot(): VNode {
    return (
        <For each={modalStack} key={(entry: ModalEntry) => entry.id}>
            {(entry: ModalEntry) => createPortal(MODAL_ROOT_SELECTOR, entry.vnode)}
        </For>
    ) as VNode;
}
