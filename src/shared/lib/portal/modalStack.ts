/**
 * Сигнал-стек модальных окон уровня приложения. Приложение пушит VNode в этот
 * массив, ModalRoot в каждом layout-shell-е рендерит элементы в свой
 * `<div id="modal-root"/>` через createPortal. Стек обновляется иммутабельно
 * (каждый push создаёт новый массив, чтобы Object.is видел изменение); id
 * записей выдаются монотонным счётчиком, close ищет запись по id.
 */

import { signal } from '@shared/lib/signals';
import type { Signal } from '@shared/lib/signals';
import type { VNode } from '@shared/lib/vdom';

/** Описание одной модалки в стеке. */
export interface ModalEntry {
    /** Уникальный идентификатор записи, выдаётся при push. */
    id: number;
    /** VNode-содержимое модалки, который ModalRoot отправит в портал. */
    vnode: VNode;
    /** Опциональный обработчик, который вызывается при закрытии записи. */
    onClose?: () => void;
}

/**
 * Реактивный массив активных модалок: первый элемент самая ранняя открытая
 * модалка, последний самая верхняя. push добавляет в конец, pop удаляет по id.
 */
export const modalStack: Signal<ModalEntry[]> = signal<ModalEntry[]>([]);

/** Монотонный счётчик id для записей модалок (сбрасывается при перезагрузке страницы). */
let nextId = 1;

/** Результат вызова pushModal: id записи и функция её закрытия. */
export interface PushResult {
    /** Идентификатор созданной записи в стеке. */
    id: number;
    /** Удаляет именно эту запись (идемпотентно: повторный вызов ничего не делает). */
    close: () => void;
}

/**
 * Добавляет модалку в конец стека и возвращает её id и функцию закрытия. Если
 * передан onClose, он вызовется один раз при удалении записи.
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
 * Идемпотентна: повторный вызов (после удаления или при чужом id) молча
 * выходит, поэтому overlay-клик и Escape не вызовут onClose дважды.
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
