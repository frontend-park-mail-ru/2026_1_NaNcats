import { createOwner, disposeOwner, resetOwner, runWithOwner } from './owner';
import type { Owner } from './owner';

/**
 * Запускает побочный эффект с авто-tracking: fn вызывается сразу и
 * перезапускается при изменении любого из читаемых внутри сигналов. Перед
 * каждым перезапуском дочерние owner'ы уничтожаются, колбэки очистки
 * вызываются, подписки на прошлые сигналы снимаются. Если effect создан
 * внутри другого reactive-контекста, он становится дочерним.
 *
 * @param fn Функция эффекта. Может читать сигналы и регистрировать onCleanup.
 * @returns Функция остановки: ручная очистка effect и его ресурсов.
 */
export function effect(fn: () => void): () => void {
    const node: Owner = createOwner(() => {
        if (node.disposed) return;
        resetOwner(node);
        runWithOwner(node, fn);
    });

    runWithOwner(node, fn);

    return () => {
        disposeOwner(node);
    };
}
