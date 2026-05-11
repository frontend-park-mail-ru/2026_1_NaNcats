/**
 * Owner это узел реактивного дерева. Через owner-стек организовано:
 * каскадная очистка (cleanup для дочерних owner'ов вызывается до родителя),
 * привязка ресурсов к жизненному циклу (через onCleanup), а также авто-tracking
 * читаемых сигналов внутри effect/computed.
 *
 * Поля помечены как internal: их видят signal/computed/effect/batch, но из
 * пользовательского кода ими манипулировать не нужно.
 */
export interface Owner {
    /** Родитель в дереве владения. null у root-owner. */
    parent: Owner | null;
    /** Дочерние owner'ы: уничтожаются перед колбэками очистки родителя. */
    owned: Owner[];
    /** Колбэки, зарегистрированные через onCleanup в пределах этого owner. */
    cleanups: Array<() => void>;
    /**
     * Для effect/computed: множества подписчиков сигналов, в которых сидит
     * этот узел. Нужно для отвязки от сигналов при повторном запуске и при
     * уничтожении. Для обычного owner-scope не используется.
     */
    sources: Array<Set<Owner>> | null;
    /**
     * Для effect/computed: функция, которая будет перезапущена при изменении
     * любого источника. Для обычного owner-scope null.
     */
    fn: (() => void) | null;
    /** Флаг: узел уничтожен. После true перезапускать его нельзя. */
    disposed: boolean;
}

/** Текущий owner: используется onCleanup и созданием дочерних owner'ов. */
let currentOwner: Owner | null = null;

/**
 * Текущий listener: узел, в чьи sources будут добавлены сигналы при чтении.
 * Отделён от owner, потому что есть кейсы (peek, runWithOwner), когда нужно
 * вести owner-контекст без авто-tracking.
 */
let currentListener: Owner | null = null;

/**
 * Возвращает текущий owner. Используется внешними обёртками вроде
 * useStoreSignal, чтобы привязать снятие подписки к жизненному циклу
 * компонента через runWithOwner или onCleanup.
 *
 * @returns Текущий owner или null, если кода вне реактивного контекста.
 */
export function getOwner(): Owner | null {
    return currentOwner;
}

/**
 * Возвращает текущий listener (узел, активный для авто-tracking).
 * Внутренний хелпер для signal.ts.
 *
 * @returns Узел, который нужно подписать на читаемый сигнал, либо null.
 */
export function getListener(): Owner | null {
    return currentListener;
}

/**
 * Создаёт новый owner-узел и привязывает его как дочерний к текущему owner.
 * Не делает push в стек: только конструирует узел и регистрирует связь.
 *
 * @param fn Функция реактивной задачи (для effect/computed). Для обычного
 *           owner-scope null.
 * @returns Свежий узел владения.
 */
export function createOwner(fn: (() => void) | null): Owner {
    const node: Owner = {
        parent: currentOwner,
        owned: [],
        cleanups: [],
        sources: fn ? [] : null,
        fn,
        disposed: false,
    };
    if (currentOwner) {
        currentOwner.owned.push(node);
    }
    return node;
}

/**
 * Запускает fn под заданным owner. И owner, и listener подменяются на owner
 * на время вызова, восстанавливаются после. Если owner это reactive-узел
 * (effect или computed), то читаемые сигналы привяжутся именно к нему.
 *
 * Используется внутри signal-модуля для перезапуска effect и при создании
 * effect/computed. Также экспортируется для внешних адаптеров.
 *
 * @template T Тип возвращаемого значения fn.
 * @param owner Owner-узел, под которым выполнять fn.
 * @param fn Функция, чтения сигналов внутри которой будут tracked под owner.
 * @returns Значение, возвращённое fn.
 */
export function runWithOwner<T>(owner: Owner | null, fn: () => T): T {
    const prevOwner = currentOwner;
    const prevListener = currentListener;
    currentOwner = owner;
    currentListener = owner;
    try {
        return fn();
    } finally {
        currentOwner = prevOwner;
        currentListener = prevListener;
    }
}

/**
 * Запускает fn без авто-tracking: owner-контекст сохраняется, а listener
 * временно сбрасывается. Используется в signal.peek и при отписке от
 * сигналов внутри cleanup.
 *
 * @template T Тип возвращаемого значения fn.
 * @param fn Функция, чтения сигналов внутри которой НЕ будут tracked.
 * @returns Значение, возвращённое fn.
 */
export function untrack<T>(fn: () => T): T {
    const prev = currentListener;
    currentListener = null;
    try {
        return fn();
    } finally {
        currentListener = prev;
    }
}

/**
 * Регистрирует колбэк, который вызовется при уничтожении текущего owner.
 * Если owner отсутствует (код выполнен вне реактивного контекста), колбэк
 * не привязан ни к чему: тогда вызывающая сторона должна позаботиться о
 * нём сама. В таком сценарии колбэк просто проигнорирован, без побочных
 * эффектов: молчаливый no-op в духе SolidJS.
 *
 * @param cb Колбэк, который надо вызвать при очистке owner.
 */
export function onCleanup(cb: () => void): void {
    if (currentOwner) {
        currentOwner.cleanups.push(cb);
    }
}

/**
 * Отвязывает reactive-узел от всех сигналов, на которые он сейчас подписан.
 * Идёт по sources (множества подписчиков) и удаляет узел из каждого.
 *
 * @param node Узел effect/computed, который надо отвязать.
 */
export function cleanupSources(node: Owner): void {
    if (!node.sources) return;
    for (const subs of node.sources) {
        subs.delete(node);
    }
    node.sources.length = 0;
}

/**
 * Уничтожает owner: рекурсивно уничтожает дочерние owner'ы (в обратном
 * порядке, чтобы более поздно созданные ушли первыми), затем вызывает
 * свои cleanups (тоже в обратном порядке: LIFO), затем отвязывается от
 * sources.
 *
 * Идемпотентно: повторный вызов на уже уничтоженном узле ничего не делает.
 *
 * @param node Owner, который нужно уничтожить.
 */
export function disposeOwner(node: Owner): void {
    if (node.disposed) return;
    node.disposed = true;

    for (let i = node.owned.length - 1; i >= 0; i--) {
        disposeOwner(node.owned[i]);
    }
    node.owned.length = 0;

    for (let i = node.cleanups.length - 1; i >= 0; i--) {
        try {
            node.cleanups[i]();
        } catch (err) {
            console.error('[signals] cleanup throw:', err);
        }
    }
    node.cleanups.length = 0;

    cleanupSources(node);
}

/**
 * Перед перезапуском effect/computed: уничтожает дочерних owner'ов и
 * сбрасывает cleanups, чтобы новая итерация начала с чистого листа. От
 * источников тоже отписываемся, потому что после повторного запуска набор
 * зависимостей может измениться. Сам узел НЕ уничтожается: он
 * переиспользуется.
 *
 * @param node Узел effect/computed перед перезапуском.
 */
export function resetOwner(node: Owner): void {
    for (let i = node.owned.length - 1; i >= 0; i--) {
        disposeOwner(node.owned[i]);
    }
    node.owned.length = 0;

    for (let i = node.cleanups.length - 1; i >= 0; i--) {
        try {
            node.cleanups[i]();
        } catch (err) {
            console.error('[signals] cleanup throw:', err);
        }
    }
    node.cleanups.length = 0;

    cleanupSources(node);
}
