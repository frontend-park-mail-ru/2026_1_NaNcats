import type { Store } from '@shared/lib/store';
import { signal } from './signal';
import type { Signal } from './signal';
import { onCleanup } from './owner';

/**
 * Адаптер: проецирует срез {@link Store} в {@link Signal}, чтобы JSX-консьюмеры
 * могли потреблять стор как реактивный источник. Внутри создаётся сигнал с
 * начальным значением селектора, далее подписка на `store.select` пересылает
 * новые значения в сигнал. Отписка регистрируется через {@link onCleanup}
 * текущего owner, поэтому утечек подписки при размонтировании компонента не
 * будет.
 *
 * Если функция вызвана вне реактивного контекста (owner отсутствует),
 * `onCleanup` молча игнорирует регистрацию: в этом случае ответственность за
 * жизненный цикл подписки лежит на вызывающей стороне.
 *
 * @template S Тип состояния стора.
 * @template T Тип значения, возвращаемого селектором.
 * @param store Стор, из которого читается состояние.
 * @param selector Чистая функция, выделяющая нужный срез состояния.
 * @returns Аксессор сигнала: вызов возвращает текущее значение среза и
 *          создаёт реактивную зависимость внутри effect/computed.
 */
export function useStoreSignal<S extends object, T>(store: Store<S>, selector: (s: S) => T): () => T {
    const sig: Signal<T> = signal(selector(store.getState()));
    const unsubscribe = store.select(selector, (v) => sig.set(v));
    onCleanup(unsubscribe);
    return sig;
}
