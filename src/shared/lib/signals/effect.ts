import { createOwner, disposeOwner, resetOwner, runWithOwner } from './owner';
import type { Owner } from './owner';

/**
 * Запускает побочный эффект с авто-tracking. fn вызывается сразу (иначе
 * сборка зависимостей невозможна), а потом перезапускается каждый раз,
 * когда любой из читаемых внутри fn сигналов меняется.
 *
 * Перед каждым перезапуском: дочерние owner'ы уничтожаются, колбэки
 * очистки (включая зарегистрированные через onCleanup) вызываются, отписка
 * от прошлых сигналов происходит автоматически. Если fn кидает, owner-стек
 * всё равно корректно восстанавливается (runWithOwner делает это через
 * finally).
 *
 * Если effect создан внутри другого reactive-контекста (owner родителя
 * есть), он становится дочерним: при уничтожении родителя уничтожится и он.
 *
 * @param fn Функция эффекта. Может читать сигналы (это формирует зависимости)
 *           и регистрировать колбэки очистки через onCleanup.
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
