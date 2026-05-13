import { createOwner, disposeOwner, effect, onCleanup, runWithOwner } from '@shared/lib/signals';
import type { Owner } from '@shared/lib/signals';

import { DynamicType, Fragment, PortalType, normalizeChildren } from './h';
import { applyRef, removeAllListeners, setProps } from './props';
import type { NormalizedChild, VNode, VNodeChild } from './types';

/**
 * Контракт пропсов узла-DynamicType: пара mount/disposer (реализуется
 * фабриками Show, For и Suspense). mount возвращает sentinel-узел, помечающий
 * границу динамического контента; disposer снимает свой DOM и владельцев
 * реактивных подписок.
 */
interface DynamicProps {
    mount: (parent: Node, anchor: Node | null) => DynamicMountResult;
}

/**
 * Результат mount у DynamicType: sentinel-узел границы (обычно Comment,
 * остаётся на месте между перезапусками поддерева) и disposer.
 */
interface DynamicMountResult {
    /** Sentinel-узел, помечающий границу динамического контента в parent. */
    sentinel: Node;
    /** Disposer: снимает DOM динамического поддерева и реактивные ресурсы. */
    dispose: () => void;
}

/** Карта DynamicType VNode -> disposer, зарегистрированный при mount. */
const dynamicDisposers: WeakMap<VNode, () => void> = new WeakMap();

/**
 * Карта функция-компонент VNode -> его owner-узел реактивного дерева.
 *
 * Owner создаётся при монтировании компонента и подменяет currentOwner на
 * время вызова тела: onCleanup/effect и прочее, заведённое внутри, привязано
 * к жизненному циклу компонента. При размонтировании owner уничтожается
 * каскадом. WeakMap, а не поле VNode, чтобы не заводить служебное поле мутацией.
 */
const componentOwners: WeakMap<VNode, Owner> = new WeakMap();

/**
 * Возвращает owner-узел, привязанный к function-component VNode.
 *
 * @param vnode Function-component VNode.
 * @returns Owner-узел или undefined, если VNode не функциональный или ещё не смонтирован.
 */
export function getComponentOwner(vnode: VNode): Owner | undefined {
    return componentOwners.get(vnode);
}

/**
 * Привязывает owner-узел к function-component VNode (используется патчем при
 * переносе owner с prev на next в patchSame).
 *
 * @param vnode Function-component VNode.
 * @param owner Owner-узел реактивного scope компонента.
 */
export function setComponentOwner(vnode: VNode, owner: Owner): void {
    componentOwners.set(vnode, owner);
}

/**
 * Предикат: ребёнок это функция-аксессор (монтируется как Text-узел, чьё
 * значение пересчитывается через effect). Форма функции-ребёнка не входит в
 * NormalizedChild, поэтому детектим через typeof и кастуем через unknown.
 *
 * @param child Произвольный нормализованный ребёнок.
 * @returns true, если ребёнок это аксессор-функция.
 */
function isAccessorChild(child: unknown): child is () => unknown {
    return typeof child === 'function';
}

/**
 * Монтирует ребёнка-аксессора через Text-узел и effect: создаёт текстовый
 * узел перед anchor, при каждом изменении читаемых сигналов перезаписывает
 * nodeValue. Disposer и удаление узла регистрируются через onCleanup owner.
 *
 * @param accessor Функция-аксессор, возвращающая текущее значение текстового ребёнка.
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

/** Пропсы портала: target это DOM-элемент, в который монтируются дети портала. */
interface PortalProps {
    target: Element;
}

/**
 * Возвращает первый верхнеуровневый DOM-узел VNode (для использования как
 * anchor при insertBefore) или null, если поддерево пустое.
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
 * Возвращает плоский список верхнеуровневых DOM-узлов поддерева VNode (для
 * тегов и текстов один узел, для фрагмента/компонента/портала все
 * верхнеуровневые).
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
 * @param value Сырое примитивное значение ребёнка.
 * @returns Текстовый DOM-узел со строковым представлением значения.
 */
export function createTextNode(value: string | number): Text {
    return document.createTextNode(String(value));
}

/**
 * Монтирует одного ребёнка (VNode, примитив или аксессор) в указанный
 * родитель.
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
 * DOM-узел или массив корневых узлов поддерева. Ветвится по type: Fragment,
 * PortalType, DynamicType, функция-компонент, строка-тег.
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
        const el = inSvg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
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
 * Приводит результат вызова функции-компонента к VNode: null для пустого
 * результата, обёртка в Fragment для примитива или массива.
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
 * Размонтирует VNode: unmount для всех детей, удаление корневых DOM-узлов; для
 * тегов сбрасывает ref в null и снимает слушатели; для функции-компонента
 * уничтожает owner; для DynamicType вызывает disposer.
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
 * Первичный рендер VNode в DOM-контейнер: очищает контейнер, монтирует дерево
 * и возвращает disposer для размонтирования.
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
