/**
 * Публичный барель портал-модуля.
 *
 * Снаружи модуля доступны: сигнальный стек modalStack, функции push/pop, тип
 * записи ModalEntry и сам приёмник ModalRoot. Реализационные детали (счётчик
 * id, селектор `#modal-root`) намеренно остаются внутренними.
 */

export { modalStack, pushModal, popModal } from './modalStack';
export type { ModalEntry, PushResult } from './modalStack';
export { ModalRoot } from './ModalRoot';
