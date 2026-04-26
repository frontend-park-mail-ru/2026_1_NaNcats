import doT from 'dot';
import type { Store, Unsubscribe, Listener } from '@shared/lib/store';

type DomListener = {
    target: EventTarget;
    type: string;
    fn: EventListener;
};

export abstract class Component<Props extends object = object> {
    protected props!: Props;
    protected root: HTMLElement | null = null;

    protected slots: Record<string, string> = {};

    private readonly renderFunc: (data: Props) => string;
    private readonly domListeners: DomListener[] = [];
    private readonly subscriptions: Unsubscribe[] = [];
    private readonly children: { destroy(): void }[] = [];
    private readonly resolvedSlots: Map<string, HTMLElement> = new Map();
    private mounted = false;

    constructor(templateString: string) {
        this.renderFunc = doT.template(templateString) as (data: Props) => string;
    }

    mount(container: HTMLElement, props: Props): void {
        if (this.mounted) {
            throw new Error(
                `${this.constructor.name}.mount() called on already-mounted instance — call destroy() first.`,
            );
        }
        this.props = props;
        this.root = container;
        container.innerHTML = this.renderFunc(props);
        this.bindSlots();
        this.mounted = true;
        this.onMount();
    }

    update(patch: Partial<Props>): void {
        if (!this.mounted || !this.root) {
            throw new Error(`${this.constructor.name}.update() called before mount().`);
        }
        const nextProps = { ...this.props, ...patch };
        const container = this.root;
        this.teardownInternal();
        this.mount(container, nextProps);
    }

    destroy(): void {
        if (!this.mounted) return;
        this.teardownInternal();
        if (this.root) this.root.innerHTML = '';
        this.root = null;
    }

    protected on<K extends keyof HTMLElementEventMap>(
        target: EventTarget,
        type: K,
        fn: (e: HTMLElementEventMap[K]) => void,
    ): void;
    protected on(target: EventTarget, type: string, fn: EventListener): void;
    protected on(target: EventTarget, type: string, fn: EventListener): void {
        target.addEventListener(type, fn);
        this.domListeners.push({ target, type, fn });
    }

    protected useStore<S extends object, T>(
        store: Store<S>,
        selector: (s: S) => T,
        listener: Listener<T>,
    ): void {
        const unsub = store.select(selector, listener);
        this.subscriptions.push(unsub);
    }

    protected useStoreState<S extends object>(store: Store<S>, listener: Listener<S>): void {
        const unsub = store.subscribe(listener);
        this.subscriptions.push(unsub);
    }

    protected mountChild<P extends object>(
        slotName: string,
        child: Component<P>,
        props: P,
    ): void {
        const el = this.resolvedSlots.get(slotName);
        if (!el) {
            throw new Error(
                `${this.constructor.name}: slot "${slotName}" is not declared in this.slots or its selector did not resolve in the rendered template.`,
            );
        }
        child.mount(el, props);
        this.children.push(child);
    }

    protected onMount(): void {}
    protected onDestroy(): void {}

    private bindSlots(): void {
        this.resolvedSlots.clear();
        if (!this.root) return;
        for (const [name, selector] of Object.entries(this.slots)) {
            const el = this.root.querySelector(selector);
            if (el instanceof HTMLElement) {
                this.resolvedSlots.set(name, el);
            }
        }
    }

    private teardownInternal(): void {
        for (const child of this.children) child.destroy();
        this.children.length = 0;

        for (const { target, type, fn } of this.domListeners) {
            target.removeEventListener(type, fn);
        }
        this.domListeners.length = 0;

        for (const unsub of this.subscriptions) unsub();
        this.subscriptions.length = 0;

        this.resolvedSlots.clear();
        this.onDestroy();
        this.mounted = false;
    }
}
