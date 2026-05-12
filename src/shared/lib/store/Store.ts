import { signal } from '@shared/lib/signals';
import type { Signal } from '@shared/lib/signals';

/** Функциональный апдейтер: получает предыдущее состояние, возвращает следующее. */
export type UpdaterFn<S> = (prev: S) => S;

/**
 * Аргумент {@link Store#setState}: частичный патч (сливается с текущим
 * состоянием на верхнем уровне) либо функция, возвращающая новое состояние.
 */
export type Updater<S> = Partial<S> | UpdaterFn<S>;

/** Подписчик, который Store вызывает при изменении значения. */
export type Listener<T> = (value: T) => void;

/** Функция отписки: однократный вызов снимает соответствующего подписчика. */
export type Unsubscribe = () => void;

/**
 * Контейнер наблюдаемого состояния: единственный источник правды для общего
 * куска UI-состояния плюс подписка. Обновление объектом сливает поля на
 * верхнем уровне, обновление функцией заменяет состояние её результатом;
 * подписчики уведомляются только при смене ссылки. Внутри состояние держится в
 * {@link Signal}, поэтому JSX-консьюмеры могут подписываться через
 * {@link useStoreSignal}.
 *
 * @template S Тип хранимого состояния (всегда объект).
 */
export class Store<S extends object> {
    private state: Signal<S>;

    /**
     * @param initial Начальное состояние.
     */
    constructor(initial: S) {
        this.state = signal(initial);
    }

    /**
     * Возвращает текущий снимок состояния. Чтение идёт через `peek`, поэтому
     * вызов из реактивного контекста не создаёт зависимости от сигнала.
     *
     * @returns Текущее состояние.
     */
    getState(): S {
        return this.state.peek();
    }

    /**
     * Заменяет или патчит текущее состояние: функция возвращает следующее
     * состояние из предыдущего, объект сливается с текущим на верхнем уровне.
     * Подписчики уведомляются только при смене ссылки (дедупликация по
     * `Object.is` на стороне сигнала).
     *
     * @param updater Функциональный апдейтер или частичный патч.
     */
    setState(updater: Updater<S>): void {
        const prev = this.state.peek();
        const next =
            typeof updater === 'function' ? (updater as UpdaterFn<S>)(prev) : { ...prev, ...updater };

        this.state.set(next);
    }

    /**
     * Подписывает слушателя на любые изменения состояния. В момент привязки
     * `listener` не вызывается.
     *
     * @param listener Колбэк, вызываемый с новым состоянием.
     * @returns Функция, снимающая подписку при вызове.
     */
    subscribe(listener: Listener<S>): Unsubscribe {
        return this.state.subscribe((next) => listener(next));
    }

    /**
     * Подписывает слушателя на производный срез состояния: селектор
     * выполняется на каждом изменении, но `listener` вызывается только при
     * смене ссылки среза (`Object.is`). В момент подписки не вызывается.
     *
     * @template T Тип значения, возвращаемого селектором.
     * @param selector Чистая функция, выделяющая срез состояния.
     * @param listener Колбэк, вызываемый с новым значением среза.
     * @returns Функция, снимающая подписку при вызове.
     */
    select<T>(selector: (s: S) => T, listener: Listener<T>): Unsubscribe {
        let prev = selector(this.state.peek());
        return this.state.subscribe((next) => {
            const nextSel = selector(next);
            if (!Object.is(prev, nextSel)) {
                prev = nextSel;
                listener(nextSel);
            }
        });
    }
}
