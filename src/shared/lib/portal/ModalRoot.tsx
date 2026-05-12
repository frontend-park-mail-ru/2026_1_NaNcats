/**
 * Компонент ModalRoot: реактивный приёмник стека модалок. Каждый layout-shell
 * рендерит у себя один ModalRoot сразу после своего `<div id="modal-root"/>`.
 * ModalRoot подписан на modalStack через <For> и для каждой записи создаёт
 * createPortal в `#modal-root`.
 *
 * Порядок в JSX важен: layout сначала кладёт `<div id="modal-root"/>`, потом
 * `<ModalRoot/>`, чтобы к первому эффекту ModalRoot div уже был в документе
 * (иначе createPortal кинет исключение про ненайденный селектор).
 */

import { For, createPortal } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { modalStack } from './modalStack';
import type { ModalEntry } from './modalStack';

/**
 * Селектор контейнера, в который ModalRoot отправляет каждую модалку.
 * Одновременно существует ровно один `<div id="modal-root"/>`, потому что
 * layout-shell-ы peer-эксклюзивны.
 */
const MODAL_ROOT_SELECTOR = '#modal-root';

/**
 * Компонент-приёмник: рендерит стек модалок в `#modal-root` через порталы. Сам
 * видимых узлов в потоке layout-а не создаёт (<For> ставит anchor-комментарий,
 * дети это порталы в другой контейнер).
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
