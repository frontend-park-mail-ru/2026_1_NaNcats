import { createOwner, disposeOwner, effect, onCleanup, runWithOwner } from '@shared/lib/signals';
import type { Owner } from '@shared/lib/signals';

import { DynamicType, Fragment, PortalType, normalizeChildren } from './h';
import { applyRef, removeAllListeners, setProps } from './props';
import type { NormalizedChild, VNode, VNodeChild } from './types';

/**
 * Контракт пропсов узла-DynamicType: пара mount/disposer.
 *
 * Соглашение реализуется фабриками Show, For и Suspense; ядро доверяет
 * сигнатуре. Disposer должен снять собственный DOM (вынуть узлы из родителя)
 * и уничтожить владельцев реактивных подписок. mount возвращает sentinel-узел
 * (как правило, Comment), который помечает границу динамического контента в
 * DOM и используется ядром как stable-anchor для соседей по фрагменту и для
 * патч-операций.
 */
interface DynamicProps {
    mount: (parent: Node, anchor: Node | null) => DynamicMountResult;
}

/**
 * Результат mount у DynamicType: пара disposer и sentinel-узел границы.
 *
 * sentinel это DOM-узел (обычно Comment), который остаётся на месте между
 * перезапусками внутреннего поддерева. Ядро держит его в vnode.__dom: тогда
 * соседи по фрагменту корректно находят свою позицию, а замена через
 * patchSame знает, куда вставлять новое поддерево.
 */
interface DynamicMountResult {
    /** Sentinel-узел, помечающий границу динамического контента в parent. */
    sentinel: Node;
    /** Колбэк-disposer: снимает DOM динамического поддерева и реактивные ресурсы. */
    dispose: () => void;
}

/** Карта DynamicType VNode -> disposer, зарегистрированный при mount. */
const dynamicDisposers: WeakMap<VNode, () => void> = new WeakMap();

/**
 * Карта функция-компонент VNode -> его owner-узел реактивного дерева.
 *
 * Owner создаётся в момент монтирования функционального компонента и
 * подменяет currentOwner на время вызова тела компонента: благодаря этому
 * любой onCleanup, effect или другой реактивный примитив, заведённый внутри
 * тела компонента, привязывается к жизненному циклу компонента. При
 * размонтировании компонента owner уничтожается каскадом: дочерние effect/owner
 * (включая, например, привязки реактивных пропов и Show/For/Suspense)
 * подчищаются автоматически.
 *
 * WeakMap, а не поле VNode, потому что форма VNode зафиксирована в types.ts
 * и за ним владеет Unit 5: не хочется заводить служебное поле через мутацию.
 */
const componentOwners: WeakMap<VNode, Owner> = new WeakMap();

/**
 * Возвращает owner-узел, привязанный к данному function-component VNode.
 *
 * Используется патчем, чтобы при сохранении VNode в-месте передать существующий
 * owner новому экземпляру: тогда повторный unmount дисциплинированно
 * уничтожит реактивные привязки.
 *
 * @param vnode Function-component VNode.
 * @returns Owner-узел или undefined, если VNode не функциональный или ещё не смонтирован.
 */
export function getComponentOwner(vnode: VNode): Owner | undefined {
    return componentOwners.get(vnode);
}

/**
 * Привязывает owner-узел к function-component VNode.
 *
 * Используется патчем при переносе owner-узла с prev на next в ходе patchSame:
 * новый VNode перенимает существующий реактивный scope, и unmount по новой
 * ссылке корректно его уничтожит.
 *
 * @param vnode Function-component VNode.
 * @param owner Owner-узел реактивного scope компонента.
 */
export function setComponentOwner(vnode: VNode, owner: Owner): void {
    componentOwners.set(vnode, owner);
}

/**
 * Внутренний предикат: ребёнок это функция-аксессор сигнала или computed.
 *
 * Такой ребёнок монтируется как одиночный Text-узел, чьё значение пересчитывается
 * через effect при каждом изменении читаемых внутри аксессора сигналов.
 * Реализация типов в types.ts не знает про функцию-ребёнка (его форма не
 * входит в NormalizedChild), поэтому мы детектим функцию через typeof и
 * аккуратно кастуем через unknown.
 *
 * @param child Произвольный нормализованный ребёнок.
 * @returns true, если ребёнок это аксессор-функция.
 */
function isAccessorChild(child: unknown): child is () => unknown {
    return typeof child === 'function';
}

/**
 * Монтирует одного ребёнка-аксессора (функцию) в parent через Text-узел и
 * effect.
 *
 * Создаёт текстовый DOM-узел, вставляет его перед anchor, запускает effect,
 * который при каждом изменении читаемых сигналов перезаписывает nodeValue.
 * Через onCleanup текущего owner регистрируется disposer effect: при
 * размонтировании родительского scope (Show/For/Suspense/корневой компонент)
 * подписка снимется и узел будет удалён из DOM, если он ещё там.
 *
 * @param accessor Функция-аксессор, возвращающая текущее значение текстового
 *                 ребёнка.
 * @param parent Родительский DOM-узел.
 * @param anchor Опциональный якорь: новые узлы вставляются перед ним.
 * @returns Созданный Text-узел.
 */
function mountAccessorChild(accessor: () => unknown, parent: Node, anchor: Node | null): Text {
    const textNode = document.createTextNode('');
    parent.insertBefore(textNode, anchor);

    const dispose = effect(() => {
        const raw = accessor();
        textNode.nodeValue = raw === null || raw === undefined || raw === false ? '' : String(raw);
    });

    onCleanup(() => {
        dispose();
        if (textNode.parentNode) {
            textNode.parentNode.removeChild(textNode);
        }
    });

    return textNode;
}

/**
 * Контракт пропсы портала, согласованный с реализацией createPortal.
 *
 * Внутреннее поле target указывает на DOM-элемент, в который монтируются дети
 * портала. Поле задаётся фабрикой createPortal и читается рендером.
 */
interface PortalProps {
    target: Element;
}

/**
 * Возвращает первый ненулевой верхнеуровневый DOM-узел узла VNode для
 * использования в качестве anchor при последующем insertBefore.
 *
 * Для обычных узлов это сам __dom (Node). Для фрагментов и компонентов это
 * первый элемент массива __dom. Для пустых фрагментов возвращает null.
 *
 * @param vnode Узел, на DOM которого ссылаемся.
 * @returns Первый DOM-узел поддерева или null, если поддерево пустое.
 */
export function firstDom(vnode: VNode): Node | null {
    const dom = vnode.__dom;
    if (!dom) return null;
    if (Array.isArray(dom)) return dom.length > 0 ? dom[0] : null;
    return dom;
}

/**
 * Возвращает плоский список верхнеуровневых DOM-узлов поддерева VNode.
 *
 * Для тегов и текстов это один узел в массиве. Для фрагмента, компонента или
 * портала это все верхнеуровневые DOM-дети поддерева. Помогает при сносе
 * узла и при вычислении anchor для соседа.
 *
 * @param vnode Узел, DOM которого собирается.
 * @returns Список верхнеуровневых DOM-узлов поддерева.
 */
export function flatDom(vnode: VNode): Node[] {
    const dom = vnode.__dom;
    if (!dom) return [];
    return Array.isArray(dom) ? dom.slice() : [dom];
}

/**
 * Создаёт Text-узел для примитивного ребёнка (строка или число).
 *
 * Используется как ядром при монтировании, так и diff-children при вставке
 * новых текстовых детей.
 *
 * @param value Сырое примитивное значение ребёнка.
 * @returns Текстовый DOM-узел со строковым представлением значения.
 */
export function createTextNode(value: string | number): Text {
    return document.createTextNode(String(value));
}

/**
 * Монтирует одного ребёнка (VNode или примитив) в указанный родитель.
 *
 * Для примитивов создаётся Text-узел и сразу вставляется в parent (перед
 * anchor, если anchor задан). Для VNode вызывается mount, который сам
 * вставляет получившиеся узлы.
 *
 * @param child Нормализованный ребёнок.
 * @param parent Родительский DOM-узел.
 * @param anchor Опциональный якорь: новые узлы вставляются перед ним.
 * @returns Созданный DOM-узел (для примитива) или массив корневых DOM-узлов VNode.
 */
export function mountChild(child: NormalizedChild, parent: Node, anchor: Node | null): Node | Node[] {
    if (isAccessorChild(child)) {
        return mountAccessorChild(child, parent, anchor);
    }
    if (typeof child === 'string' || typeof child === 'number') {
        const text = createTextNode(child);
        parent.insertBefore(text, anchor);
        return text;
    }
    return mount(child, parent, anchor);
}

/**
 * Монтирует VNode в parent (с опциональным anchor) и возвращает корневой
 * DOM-узел или массив корневых узлов поддерева.
 *
 * Алгоритм по type:
 * - Fragment: создаёт каждого ребёнка по очереди, складывает их верхнеуровневые
 *   DOM-узлы и пишет массив в vnode.__dom.
 * - PortalType: вместо вставки в parent смонтирует детей в props.target;
 *   в исходном parent ничего не появляется, __dom это пустой массив.
 * - функция-компонент: вызывает функцию, нормализует результат во внутренний
 *   VNode (через обёртку, если результат это примитив или массив), монтирует
 *   полученное поддерево, переносит __dom в обёртку.
 * - строка-тег: createElement, проставляет пропсы, монтирует детей внутрь,
 *   вставляет в parent, кладёт элемент в __dom.
 *
 * @param vnode Узел для монтирования.
 * @param parent Родительский DOM-узел.
 * @param anchor Опциональный якорь: новые узлы вставляются перед ним.
 * @returns Корневой DOM-узел поддерева либо массив корневых узлов (для Fragment, компонента, портала).
 */
export function mount(vnode: VNode, parent: Node, anchor: Node | null): Node | Node[] {
    const { type } = vnode;

    if (type === Fragment) {
        const nodes: Node[] = [];
        for (const child of vnode.children) {
            const created = mountChild(child, parent, anchor);
            if (Array.isArray(created)) {
                for (const n of created) nodes.push(n);
            } else {
                nodes.push(created);
            }
        }
        vnode.__dom = nodes;
        return nodes;
    }

    if (type === PortalType) {
        const target = (vnode.props as unknown as PortalProps).target;
        for (const child of vnode.children) {
            mountChild(child, target, null);
        }
        vnode.__dom = [];
        return [];
    }

    if (type === DynamicType) {
        const props = vnode.props as unknown as DynamicProps;
        const { sentinel, dispose } = props.mount(parent, anchor);
        dynamicDisposers.set(vnode, dispose);
        vnode.__dom = [sentinel];
        return [sentinel];
    }

    if (typeof type === 'function') {
        const ownerNode = createOwner(null);
        componentOwners.set(vnode, ownerNode);
        const rendered = runWithOwner(ownerNode, () => type(vnode.props));
        const inner = normalizeRenderResult(rendered);
        vnode.__instance = inner;
        if (inner === null) {
            vnode.__dom = [];
            return [];
        }
        const dom = runWithOwner(ownerNode, () => mount(inner, parent, anchor));
        vnode.__dom = dom;
        return dom;
    }

    if (typeof type === 'string') {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const parentNs = (parent as Element).namespaceURI;
        const inSvg = type === 'svg' || parentNs === SVG_NS;
        const el: Element = inSvg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
        setProps(el as HTMLElement, vnode.props);
        for (const child of vnode.children) {
            mountChild(child, el, null);
        }
        parent.insertBefore(el, anchor);
        if (vnode.ref) applyRef(vnode.ref, el);
        vnode.__dom = el;
        return el;
    }

    throw new Error('vdom.mount: неизвестный тип VNode');
}

/**
 * Приводит результат вызова функции-компонента к виду VNode.
 *
 * Если результат это null/undefined/false, поддерево считается пустым и
 * возвращается null. Если результат это примитив или массив, он заворачивается
 * в синтетический Fragment, чтобы внешний вызывающий код всегда работал с
 * единственным VNode.
 *
 * @param raw Сырой результат компонента.
 * @returns VNode либо null для пустого результата.
 */
function normalizeRenderResult(raw: VNodeChild): VNode | null {
    if (raw === null || raw === undefined || raw === false || raw === true) {
        return null;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
        return {
            type: Fragment,
            props: {} as Readonly<Record<string, unknown>>,
            children: [raw],
            __dom: null,
            __instance: null,
        };
    }
    if (Array.isArray(raw)) {
        return {
            type: Fragment,
            props: {} as Readonly<Record<string, unknown>>,
            children: normalizeChildren(raw),
            __dom: null,
            __instance: null,
        };
    }
    return raw;
}

/**
 * Размонтирует VNode: вызывает unmount для всех детей и удаляет корневые
 * DOM-узлы из их родителя; для тегов сбрасывает ref в null и снимает
 * слушатели событий.
 *
 * Для портала дополнительно проходится по детям, чтобы вынуть их из target,
 * потому что в исходном parent узлов портала нет.
 *
 * @param vnode Размонтируемый узел.
 */
export function unmount(vnode: VNode): void {
    const { type } = vnode;

    if (type === DynamicType) {
        const dispose = dynamicDisposers.get(vnode);
        if (dispose) {
            dynamicDisposers.delete(vnode);
            try {
                dispose();
            } catch (err) {
                console.error('[vdom] DynamicType dispose throw:', err);
            }
        }
        vnode.__dom = null;
        return;
    }

    if (type === Fragment) {
        for (const child of vnode.children) {
            if (typeof child === 'string' || typeof child === 'number') continue;
            if (isAccessorChild(child)) continue;
            unmount(child);
        }
        const dom = vnode.__dom;
        if (Array.isArray(dom)) {
            for (const node of dom) {
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        }
        vnode.__dom = null;
        return;
    }

    if (type === PortalType) {
        for (const child of vnode.children) {
            if (typeof child === 'string' || typeof child === 'number') continue;
            if (isAccessorChild(child)) continue;
            unmount(child);
        }
        vnode.__dom = null;
        return;
    }

    if (typeof type === 'function') {
        const inner = vnode.__instance;
        if (inner) unmount(inner);
        vnode.__instance = null;
        vnode.__dom = null;
        const ownerNode = componentOwners.get(vnode);
        if (ownerNode) {
            componentOwners.delete(vnode);
            disposeOwner(ownerNode);
        }
        return;
    }

    if (typeof type === 'string') {
        const el = vnode.__dom as Element | null;
        for (const child of vnode.children) {
            if (typeof child === 'string' || typeof child === 'number') continue;
            if (isAccessorChild(child)) continue;
            unmount(child);
        }
        if (el) {
            removeAllListeners(el);
            if (vnode.ref) applyRef(vnode.ref, null);
            if (el.parentNode) el.parentNode.removeChild(el);
        }
        vnode.__dom = null;
    }
}

/**
 * Первичный рендер VNode в DOM-контейнер.
 *
 * Очищает контейнер от существующего содержимого, монтирует дерево и
 * возвращает функцию-disposer, которая корректно размонтирует поддерево и
 * освобождает связанные с ним слушатели и ссылки.
 *
 * @param vnode Корневой VNode для монтирования.
 * @param container DOM-элемент, в который монтируется дерево.
 * @returns Функция, которая при вызове размонтирует поддерево и очистит контейнер.
 */
export function render(vnode: VNode, container: Element): () => void {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    mount(vnode, container, null);
    return () => {
        unmount(vnode);
    };
}
