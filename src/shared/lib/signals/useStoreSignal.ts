import type { Store } from '@shared/lib/store';
import { signal } from './signal';
import type { Signal } from './signal';
import { onCleanup } from './owner';

/**
 * Адаптер: проецирует срез {@link Store} в {@link Signal}, чтобы JSX-консьюмеры
 * могли потреблять стор как реактивный источник. Подписка на `store.select`
 * пересылает новые значения в сигнал; отписка регистрируется через
 * {@link onCleanup} текущего owner (вне реактивного контекста onCleanup молча
 * игнорирует регистрацию).
 *
 * @template S Тип состояния стора.
 * @template T Тип значения, возвращаемого селектором.
 * @param store Стор, из которого читается состояние.
 * @param selector Чистая функция, выделяющая нужный срез состояния.
 * @returns Аксессор сигнала с текущим значением среза.
 */
export function useStoreSignal<S extends object, T>(store: Store<S>, selector: (s: S) => T): () => T {
    const sig: Signal<T> = signal(selector(store.getState()));
    const unsubscribe = store.select(selector, (v) => sig.set(v));
    onCleanup(unsubscribe);
    return sig;
}
