/**
 * Публичный барель портал-модуля: стек modalStack, функции push/pop, тип
 * ModalEntry и приёмник ModalRoot.
 */

export { modalStack, pushModal, popModal } from './modalStack';
export type { ModalEntry, PushResult } from './modalStack';
export { ModalRoot } from './ModalRoot';
