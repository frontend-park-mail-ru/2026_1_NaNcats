import { enqueueBatch, isBatching } from './batch';
import type { Owner } from './owner';
import { getListener } from './owner';

/**
 * Подписчик через subscribe: получает текущее значение сигнала. В отличие
 * от effect, не участвует в авто-tracking и не привязан к owner.
 *
 * @template T Тип значения сигнала.
 */
export type SignalListener<T> = (value: T) => void;

/**
 * Функциональный апдейтер: получает предыдущее значение, возвращает следующее.
 *
 * @template T Тип значения сигнала.
 */
export type SignalUpdater<T> = (prev: T) => T;

/**
 * Сигнал в SolidJS-стиле: аксессор-функция со вспомогательными методами. Вызов
 * аксессора внутри effect/computed подписывает текущий reactive-узел на
 * изменения; вне reactive-контекста аксессор работает как обычный getter.
 *
 * @template T Тип хранимого значения.
 */
export type Signal<T> = {
    (): T;
    /**
     * Меняет значение. Аргумент: либо новое значение, либо функция-апдейтер.
     * Если новое значение Object.is-равно предыдущему, нотификация не идёт.
     */
    set(next: T | SignalUpdater<T>): void;
    /** Возвращает текущее значение без авто-tracking. */
    peek(): T;
    /**
     * Прямая подписка без авто-tracking. Не вызывает fn при подписке,
     * только при последующих изменениях. Возвращает функцию отписки.
     */
    subscribe(fn: SignalListener<T>): () => void;
};

/**
 * Создаёт сигнал: ячейку с реактивным значением.
 *
 * Чтение аксессора внутри effect/computed создаёт зависимость: при set, не
 * равном текущему значению по Object.is, зависимые узлы перезапускаются (или
 * ставятся в очередь внутри batch). Прямые подписчики subscribe уведомляются
 * синхронно после set, вне очереди batch: это канал для адаптера Store.
 *
 * @template T Тип значения сигнала.
 * @param initial Начальное значение.
 * @returns Аксессор-функция с методами set, peek, subscribe.
 */
export function signal<T>(initial: T): Signal<T> {
    let value = initial;

    /** Reactive-зависимые узлы (effect/computed), отслеживаемые авто-tracking. */
    const reactiveSubs: Set<Owner> = new Set();

    /** Прямые подписчики через subscribe (без авто-tracking, без owner). */
    const directSubs: Set<SignalListener<T>> = new Set();

    const read = () => {
        const listener = getListener();
        if (listener && listener.sources) {
            reactiveSubs.add(listener);
            listener.sources.push(reactiveSubs);
        }
        return value;
    };

    const set = (next: T | SignalUpdater<T>) => {
        const resolved = typeof next === 'function' ? (next as SignalUpdater<T>)(value) : next;
        if (Object.is(resolved, value)) return;
        value = resolved;

        if (reactiveSubs.size > 0) {
            if (isBatching()) {
                for (const node of reactiveSubs) {
                    enqueueBatch(node);
                }
            } else {
                const snapshot = Array.from(reactiveSubs);
                for (const node of snapshot) {
                    if (node.disposed) continue;
                    const fn = node.fn;
                    if (fn) fn();
                }
            }
        }

        if (directSubs.size > 0) {
            const snapshot = Array.from(directSubs);
            for (const listener of snapshot) {
                try {
                    listener(value);
                } catch (err) {
                    console.error('[signals] subscribe listener throw:', err);
                }
            }
        }
    };

    const peek = () => value;

    const subscribe = (fn: SignalListener<T>) => {
        directSubs.add(fn);
        return () => {
            directSubs.delete(fn);
        };
    };

    return Object.assign(read, { set, peek, subscribe }) as Signal<T>;
}
