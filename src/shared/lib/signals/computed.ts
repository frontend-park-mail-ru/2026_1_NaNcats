import { signal } from './signal';
import type { Signal } from './signal';
import { createOwner, resetOwner, runWithOwner, untrack } from './owner';
import type { Owner } from './owner';
import { getListener } from './owner';

/**
 * Производный сигнал, мемоизированный по входным сигналам. fn вызывается
 * сразу для получения начального значения и затем пересчитывается, когда
 * любой из читаемых внутри fn сигналов изменился. Аксессор computed
 * сам ведёт себя как сигнал: его чтение внутри другого effect/computed
 * добавит подписку.
 *
 * Тонкость кеширования: значение хранится в обычном signal под капотом.
 * При пересчёте новое значение проходит через signal.set, который сравнит
 * по Object.is и не уведомит подписчиков, если результат не изменился.
 * Это даёт ожидаемую мемоизацию.
 *
 * Эквивалентность пересчёта: вызов аксессора возвращает закешированное
 * значение без перевычисления fn (читает базовый signal). Подписка идёт
 * на базовый signal, а перевычисление в фоне инициируется любым из
 * настоящих источников fn.
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

    return (): T => {
        const listener = getListener();
        if (listener) {
            return cache!();
        }
        return cache!.peek();
    };
}
