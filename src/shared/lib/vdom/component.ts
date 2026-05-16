/**
 * Хуки жизненного цикла функционального компонента: onMount и реэкспорт
 * onCleanup из пакета сигналов.
 */

import { getOwner, onCleanup as ownerOnCleanup, runWithOwner } from '@shared/lib/signals';

/**
 * Планирует колбэк, который будет вызван после завершения текущего mount-кадра.
 *
 * Колбэк ставится в очередь микротасков и исполняется под тем же owner, под
 * которым был зарегистрирован onMount: к этому моменту DOM-дерево уже
 * вставлено в документ. Ошибки внутри колбэка логируются и не валят остальные
 * mount-эффекты.
 *
 * @param cb Колбэк, который надо вызвать после mount.
 */
export function onMount(cb: () => void): void {
    const owner = getOwner();
    queueMicrotask(() => {
        if (owner && owner.disposed) {
            return;
        }
        try {
            if (owner) {
                runWithOwner(owner, cb);
            } else {
                cb();
            }
        } catch (err) {
            console.error('[vdom] onMount throw:', err);
        }
    });
}

export { ownerOnCleanup as onCleanup };
