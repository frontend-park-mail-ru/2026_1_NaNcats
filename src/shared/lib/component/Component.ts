import doT from 'dot';
import type { Store, Unsubscribe, Listener } from '@shared/lib/store';

/**
 * Запись об установленном DOM-обработчике, которую база умеет снимать при
 * перерисовке и уничтожении компонента.
 */
type DomListener = {
    /** Цель, на которую был навешен слушатель. */
    target: EventTarget;
    /** Тип DOM-события. */
    type: string;
    /** Сама функция-слушатель, чтобы передать её в removeEventListener. */
    fn: EventListener;
};

/**
 * Базовый класс UI-компонента приложения.
 *
 * Управляет жизненным циклом одного куска UI: рендерит шаблон doT в
 * переданный контейнер, привязывает декларативные слоты для дочерних
 * компонентов, копит DOM-слушатели и подписки на сторы, а потом снимает
 * всё это разом при destroy или update. Жизненный цикл: mount задаёт
 * пропсы и вызывает onMount, update перемонтирует с обновлёнными пропсами
 * (через teardown + mount), destroy чистит слушателей и зануляет корень.
 *
 * @template Props Тип пропсов компонента; должен быть объектом, чтобы doT мог
 *   обращаться к полям.
 */
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

    /**
     * @param templateString Исходный шаблон doT, по которому компонент рендерит
     *   свою разметку.
     */
    constructor(templateString: string) {
        this.renderFunc = doT.template(templateString) as (data: Props) => string;
    }

    /**
     * Монтирует компонент в указанный контейнер.
     *
     * Сохраняет ссылку на контейнер и пропсы, рендерит шаблон, разбирает
     * слоты и вызывает onMount для подкласса. Повторный mount без destroy
     * запрещён и приводит к исключению, чтобы случайно не утечь предыдущие
     * слушатели.
     *
     * @param container DOM-элемент, в который рендерится разметка компонента.
     * @param props Пропсы для шаблона и подкласса.
     */
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

    /**
     * Обновляет компонент новыми пропсами.
     *
     * Реализовано через полный teardown и повторный mount в тот же контейнер;
     * это просто и предсказуемо, так как DOM, слушатели и дети пересобираются
     * с нуля. Если состояние компонента нужно сохранить между апдейтами,
     * подкласс должен хранить его вне Component.
     *
     * @param patch Частичный набор пропсов; смешивается с текущими.
     */
    update(patch: Partial<Props>): void {
        if (!this.mounted || !this.root) {
            throw new Error(`${this.constructor.name}.update() called before mount().`);
        }
        const nextProps = { ...this.props, ...patch };
        const container = this.root;
        this.teardownInternal();
        this.mount(container, nextProps);
    }

    /**
     * Уничтожает компонент: снимает слушатели и подписки, уничтожает детей,
     * очищает контейнер и зануляет корень.
     *
     * Повторный вызов на уже уничтоженном экземпляре безопасен.
     */
    destroy(): void {
        if (!this.mounted) return;
        this.teardownInternal();
        if (this.root) this.root.innerHTML = '';
        this.root = null;
    }

    /**
     * Навешивает DOM-слушатель и регистрирует его для автоматического снятия.
     *
     * @template K Ключ типа события из HTMLElementEventMap.
     * @param target Цель события.
     * @param type Тип события.
     * @param fn Обработчик события.
     */
    protected on<K extends keyof HTMLElementEventMap>(
        target: EventTarget,
        type: K,
        fn: (e: HTMLElementEventMap[K]) => void,
    ): void;
    /**
     * Версия для произвольной строки события (например, кастомных или
     * window-событий вроде online/offline).
     *
     * @param target Цель события.
     * @param type Имя события.
     * @param fn Обработчик события.
     */
    protected on(target: EventTarget, type: string, fn: EventListener): void;
    protected on(target: EventTarget, type: string, fn: EventListener): void {
        target.addEventListener(type, fn);
        this.domListeners.push({ target, type, fn });
    }

    /**
     * Подписывается на срез внешнего стора и регистрирует подписку для
     * автоматического снятия при destroy.
     *
     * @template S Тип состояния стора.
     * @template T Тип значения, возвращаемого селектором.
     * @param store Внешний стор.
     * @param selector Чистая функция, выделяющая срез состояния.
     * @param listener Колбэк, вызываемый при изменении среза.
     */
    protected useStore<S extends object, T>(store: Store<S>, selector: (s: S) => T, listener: Listener<T>): void {
        const unsub = store.select(selector, listener);
        this.subscriptions.push(unsub);
    }

    /**
     * Подписывается на любые изменения состояния стора и регистрирует подписку
     * для автоматического снятия при destroy.
     *
     * @template S Тип состояния стора.
     * @param store Внешний стор.
     * @param listener Колбэк, вызываемый с новым состоянием стора.
     */
    protected useStoreState<S extends object>(store: Store<S>, listener: Listener<S>): void {
        const unsub = store.subscribe(listener);
        this.subscriptions.push(unsub);
    }

    /**
     * Монтирует дочерний компонент в один из объявленных слотов.
     *
     * Слоты декларируются через поле slots как пары "имя - CSS-селектор".
     * Если селектор не нашёл элемент в отрендеренном DOM, метод бросает
     * исключение, чтобы ошибка декларации не превращалась в "тихий" пропуск.
     *
     * @template P Тип пропсов дочернего компонента.
     * @param slotName Имя слота, объявленное в this.slots.
     * @param child Экземпляр дочернего компонента.
     * @param props Пропсы для child.mount.
     */
    protected mountChild<P extends object>(slotName: string, child: Component<P>, props: P): void {
        const el = this.resolvedSlots.get(slotName);
        if (!el) {
            throw new Error(
                `${this.constructor.name}: slot "${slotName}" is not declared in this.slots or its selector did not resolve in the rendered template.`,
            );
        }
        child.mount(el, props);
        this.children.push(child);
    }

    /** Хук жизненного цикла: вызывается после рендера и привязки слотов. */
    protected onMount(): void {}

    /** Хук жизненного цикла: вызывается перед очисткой DOM при destroy. */
    protected onDestroy(): void {}

    /**
     * Заполняет карту resolvedSlots, прогоняя селекторы из this.slots по
     * текущему DOM компонента. Селекторы, не нашедшие элементов, тихо
     * пропускаются.
     */
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

    /**
     * Снимает все ресурсы, которые набрал смонтированный компонент.
     *
     * Уничтожает детей, удаляет DOM-слушатели, отменяет подписки на сторы,
     * чистит карту слотов и вызывает onDestroy. Используется и из destroy,
     * и из update перед повторным mount.
     */
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
