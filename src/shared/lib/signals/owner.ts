/**
 * Owner это узел реактивного дерева: через owner-стек организованы каскадная
 * очистка (дочерние owner'ы чистятся до родителя), привязка ресурсов через
 * onCleanup и авто-tracking сигналов внутри effect/computed.
 */
export interface Owner {
    /** Родитель в дереве владения. null у root-owner. */
    parent: Owner | null;
    /** Дочерние owner'ы: уничтожаются перед колбэками очистки родителя. */
    owned: Owner[];
    /** Колбэки, зарегистрированные через onCleanup в пределах этого owner. */
    cleanups: Array<() => void>;
    /**
     * Для effect/computed: множества подписчиков сигналов, в которых сидит этот
     * узел (для отвязки при перезапуске и уничтожении). Для обычного scope null.
     */
    sources: Array<Set<Owner>> | null;
    /** Для effect/computed: функция перезапуска при изменении источника; иначе null. */
    fn: (() => void) | null;
    /** Флаг: узел уничтожен. После true перезапускать его нельзя. */
    disposed: boolean;
}

/** Текущий owner: используется onCleanup и созданием дочерних owner'ов. */
let currentOwner: Owner | null = null;

/**
 * Текущий listener: узел, в чьи sources добавляются сигналы при чтении. Отделён
 * от owner ради кейсов (peek, runWithOwner), где нужен owner-контекст без
 * авто-tracking.
 */
let currentListener: Owner | null = null;

/**
 * Возвращает текущий owner (используется обёртками вроде useStoreSignal для
 * привязки отписки к жизненному циклу компонента).
 *
 * @returns Текущий owner или null, если код вне реактивного контекста.
 */
export function getOwner(): Owner | null {
    return currentOwner;
}

/**
 * Возвращает текущий listener (узел, активный для авто-tracking). Хелпер для
 * signal.ts.
 *
 * @returns Узел, который нужно подписать на читаемый сигнал, либо null.
 */
export function getListener(): Owner | null {
    return currentListener;
}

/**
 * Создаёт новый owner-узел и привязывает его как дочерний к текущему owner (без
 * push в стек).
 *
 * @param fn Функция реактивной задачи (для effect/computed); для обычного scope null.
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
 * Запускает fn под заданным owner: на время вызова owner и listener
 * подменяются на него, после восстанавливаются. Если owner это
 * effect/computed, читаемые сигналы привяжутся к нему.
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
 * Запускает fn без авто-tracking: owner-контекст сохраняется, listener
 * временно сбрасывается.
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
 * Регистрирует колбэк, который вызовется при уничтожении текущего owner. Вне
 * реактивного контекста (owner отсутствует) колбэк молча игнорируется:
 * ответственность за него на вызывающей стороне.
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
 * Уничтожает owner: рекурсивно дочерние owner'ы (в обратном порядке), затем
 * свои cleanups (LIFO), затем отвязка от sources. Идемпотентно.
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
 * Перед перезапуском effect/computed: уничтожает дочерних owner'ов, сбрасывает
 * cleanups и отписывается от источников (набор зависимостей может измениться).
 * Сам узел не уничтожается: он переиспользуется.
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
