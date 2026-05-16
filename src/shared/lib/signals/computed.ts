import { signal } from './signal';
import type { Signal } from './signal';
import { createOwner, resetOwner, runWithOwner, untrack } from './owner';
import type { Owner } from './owner';
import { getListener } from './owner';

/**
 * Производный сигнал, мемоизированный по входным сигналам. fn вызывается сразу
 * для начального значения и пересчитывается, когда любой из читаемых внутри fn
 * сигналов изменился. Значение хранится в обычном signal: пересчёт идёт через
 * signal.set с дедупликацией по Object.is. Чтение аксессора возвращает кеш без
 * перевычисления fn; внутри другого effect/computed оно добавляет подписку.
 *
 * @template T Тип производного значения.
 * @param fn Функция-вычислитель. Может читать сигналы.
 * @returns Аксессор-функция, возвращающая текущее значение computed.
 */
export function computed<T>(fn: () => T): () => T {
    let cache: Signal<T> | null = null;

    const node: Owner = createOwner(() => {
        if (node.disposed) return;
        resetOwner(node);
        const next = runWithOwner(node, fn);
        if (cache) {
            untrack(() => {
                cache!.set(next);
            });
        }
    });

    const initial = runWithOwner(node, fn);
    cache = signal<T>(initial);

    return () => {
        const listener = getListener();
        if (listener) {
            return cache!();
        }
        return cache!.peek();
    };
}
