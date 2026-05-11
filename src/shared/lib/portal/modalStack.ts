/**
 * Сигнал-стек модальных окон уровня приложения.
 *
 * Подход: вместо императивного аппенда оверлеев в document.body (как делали
 * прежние Modal/Popup) приложение пушит VNode в этот сигнальный массив.
 * Компонент ModalRoot в каждом layout-shell-е реактивно рендерит элементы
 * стека в свой `<div id="modal-root"/>`, используя createPortal.
 *
 * Стек обновляется иммутабельно: каждый push создаёт новый массив, чтобы
 * сигнальный equality (Object.is) видел изменение и уведомил подписчиков.
 * Идентификаторы записей выдаются монотонным счётчиком: возвращённая функция
 * close ищет запись по id, поэтому позиция записи в массиве может меняться,
 * если соседняя модалка закроется первой.
 */

import { signal } from '@shared/lib/signals';
import type { Signal } from '@shared/lib/signals';
import type { VNode } from '@shared/lib/vdom';

/**
 * Описание одной модалки в стеке.
 *
 * Поле onClose опционально: некоторые потребители (например, Popup.alert) сами
 * закрывают себя через возвращённую close и не нуждаются во внешнем колбэке,
 * другие (Modal.open с overlay-click) полагаются именно на onClose.
 */
export interface ModalEntry {
    /** Уникальный идентификатор записи, выдаётся при push. */
    id: number;
    /** VNode-содержимое модалки, который ModalRoot отправит в портал. */
    vnode: VNode;
    /** Опциональный обработчик, который вызывается при закрытии записи. */
    onClose?: () => void;
}

/**
 * Реактивный массив активных модалок.
 *
 * Порядок: первый элемент это самая ранняя открытая модалка, последний это
 * самая верхняя по визуальной иерархии. Стек растёт вправо: push добавляет
 * в конец, pop удаляет по id.
 */
export const modalStack: Signal<ModalEntry[]> = signal<ModalEntry[]>([]);

/**
 * Монотонный счётчик id для записей модалок.
 *
 * Сбрасывается только при перезагрузке страницы. Гарантирует уникальность id в
 * пределах одной сессии и независимо от порядка закрытия записей.
 */
let nextId = 1;

/**
 * Результат вызова pushModal: id записи и функция её закрытия.
 *
 * Возвращать close-функцию удобнее, чем заставлять потребителя помнить id и
 * звать popModal самому: типичный случай это `const { close } = pushModal(...);`
 * с последующим `onClick={close}`.
 */
export interface PushResult {
    /** Идентификатор созданной записи в стеке. */
    id: number;
    /** Удаляет именно эту запись (идемпотентно: повторный вызов ничего не делает). */
    close: () => void;
}

/**
 * Добавляет модалку в стек и возвращает её id вместе с функцией закрытия.
 *
 * Запись пушится в конец массива (визуально модалка появляется поверх всех
 * предыдущих). Если потребитель передал onClose, он вызовется ровно один раз
 * в момент удаления записи (через close или через popModal).
 *
 * @param vnode VNode-содержимое модалки, которое ModalRoot отрендерит в портал.
 * @param onClose Опциональный колбэк, вызываемый при удалении записи.
 * @returns Идентификатор записи и идемпотентная функция её закрытия.
 */
export function pushModal(vnode: VNode, onClose?: () => void): PushResult {
    const id = nextId;
    nextId += 1;
    const entry: ModalEntry = { id, vnode, onClose };
    modalStack.set((prev) => [...prev, entry]);
    return {
        id,
        close: () => popModal(id),
    };
}

/**
 * Удаляет запись с заданным id из стека и вызывает её onClose, если был.
 *
 * Идемпотентна: если запись уже удалена (или id не существовал), функция
 * молча выходит. Это важно для двойного закрытия: оверлей-клик и Escape могут
 * сработать почти одновременно, оба пути зовут popModal, и второй вызов не
 * должен вызвать onClose повторно.
 *
 * @param id Идентификатор записи, выданный pushModal.
 */
export function popModal(id: number): void {
    const current = modalStack.peek();
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    const removed = current[index];
    const next = current.slice(0, index).concat(current.slice(index + 1));
    modalStack.set(next);
    if (removed.onClose) {
        try {
            removed.onClose();
        } catch (err) {
            console.error('[portal] onClose throw:', err);
        }
    }
}
