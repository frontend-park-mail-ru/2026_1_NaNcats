export type Updater<S> = Partial<S> | ((prev: S) => S);
export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

export class Store<S extends object> {
    private state: S;
    private listeners: Set<Listener<S>> = new Set();

    constructor(initial: S) {
        this.state = initial;
    }

    getState(): S {
        return this.state;
    }

    setState(updater: Updater<S>): void {
        const next =
            typeof updater === 'function' ? (updater as (prev: S) => S)(this.state) : { ...this.state, ...updater };

        if (next === this.state) return;
        this.state = next;
        this.notify();
    }

    subscribe(listener: Listener<S>): Unsubscribe {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    select<T>(selector: (s: S) => T, listener: Listener<T>): Unsubscribe {
        let prev = selector(this.state);
        const wrapped: Listener<S> = (s) => {
            const next = selector(s);
            if (!Object.is(prev, next)) {
                prev = next;
                listener(next);
            }
        };
        return this.subscribe(wrapped);
    }

    private notify(): void {
        const snapshot = Array.from(this.listeners);
        for (const listener of snapshot) {
            listener(this.state);
        }
    }
}
