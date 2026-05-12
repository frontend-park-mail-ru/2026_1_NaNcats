import { diffChildren } from './diff-children';
import { DynamicType, Fragment, PortalType, normalizeChildren } from './h';
import { applyRef, patchProps } from './props';
import { firstDom, flatDom, getComponentOwner, mount, setComponentOwner, unmount } from './render';
import type { NormalizedChild, VNode, VNodeChild } from './types';

/** Пропсы портала (дубль типа из render.ts, чтобы не плодить циклические импорты). */
interface PortalProps {
    target: Element;
}

/**
 * Совпадает ли пара VNode по type и key: если да, узел можно патчить в-месте,
 * иначе его нужно заменить.
 *
 * @param a Предыдущий VNode.
 * @param b Новый VNode.
 * @returns Признак того, что узлы можно патчить в-месте.
 */
export function isSameVNode(a: VNode, b: VNode): boolean {
    return a.type === b.type && a.key === b.key;
}

/**
 * Возвращает родительский DOM-узел поддерева (parentNode его первого DOM-узла)
 * или null, если поддерево не смонтировано.
 *
 * @param vnode Узел, для которого ищется parent.
 * @returns parentNode первого DOM-узла поддерева или null.
 */
function parentOf(vnode: VNode): Node | null {
    const first = firstDom(vnode);
    return first ? first.parentNode : null;
}

/**
 * Обновляет nodeValue текстового узла, если примитивное значение поменялось.
 *
 * @param textNode Текстовый DOM-узел, который ранее представлял prev.
 * @param prev Предыдущее примитивное значение.
 * @param next Новое примитивное значение.
 */
export function patchText(textNode: Text, prev: string | number, next: string | number): void {
    if (prev === next) return;
    textNode.nodeValue = String(next);
}

/**
 * Заменяет поддерево prev на поддерево next в том же родителе: запоминает
 * якорь (сосед после последнего DOM-узла prev), размонтирует prev, затем
 * монтирует next перед якорем. Fallback для родителя это container.
 *
 * @param prev Старый VNode (смонтированный).
 * @param next Новый VNode (ещё не смонтированный).
 * @param container DOM-контейнер, в котором живёт prev (используется как fallback).
 */
function replaceVNode(prev: VNode, next: VNode, container: Node): void {
    const firstPrevDom = firstDom(prev);
    const lastPrevDom = (() => {
        const dom = prev.__dom;
        if (!dom) return null;
        if (Array.isArray(dom)) return dom.length > 0 ? dom[dom.length - 1] : null;
        return dom;
    })();
    const parent = (firstPrevDom?.parentNode) ?? container;
    const anchorAfter = lastPrevDom ? lastPrevDom.nextSibling : null;
    unmount(prev);
    mount(next, parent, anchorAfter);
}

/**
 * Патч между двумя VNode одного типа и ключа: переносит __dom и __instance из
 * prev в next и обновляет их по дельте props/children. Ветвится по type
 * (Fragment, DynamicType, PortalType, функция-компонент, строка-тег).
 *
 * @param prev Предыдущий VNode (смонтированный).
 * @param next Новый VNode того же type и key.
 * @param container DOM-контейнер для случаев, когда у prev нет смонтированных DOM-узлов.
 */
function patchSame(prev: VNode, next: VNode, container: Node): void {
    const { type } = next;

    if (type === Fragment) {
        next.__dom = prev.__dom ?? [];
        const parent = (firstDom(prev)?.parentNode) ?? container;
        const scanFrom = firstDom(prev);
        diffChildren(prev.children, next.children, parent, getAnchorAfter(prev), scanFrom);
        next.__dom = collectFragmentDom(next.children, parent, scanFrom);
        return;
    }

    if (type === DynamicType) {
        const sentinel = firstDom(prev);
        const parent = sentinel?.parentNode ?? container;
        const anchorAfter = sentinel ? sentinel.nextSibling : null;
        unmount(prev);
        mount(next, parent, anchorAfter);
        return;
    }

    if (type === PortalType) {
        const prevTarget = (prev.props as unknown as PortalProps).target;
        const nextTarget = (next.props as unknown as PortalProps).target;
        if (prevTarget !== nextTarget) {
            for (const child of prev.children) {
                if (typeof child === 'string' || typeof child === 'number') continue;
                unmount(child);
            }
            for (const child of next.children) {
                if (typeof child === 'string' || typeof child === 'number') {
                    nextTarget.appendChild(document.createTextNode(String(child)));
                    continue;
                }
                mount(child, nextTarget, null);
            }
            next.__dom = [];
            return;
        }
        diffChildren(prev.children, next.children, prevTarget, null);
        next.__dom = [];
        return;
    }

    if (typeof type === 'function') {
        // Переносим owner с prev на next, чтобы последующий unmount по новой
        // ссылке корректно его уничтожил. Тело компонента ниже вызывается без
        // подмены owner: компонентные тела не перевыполняются (реактивность
        // сидит на сигналах), поэтому подмена owner здесь не нужна.
        const reusedOwner = getComponentOwner(prev);
        if (reusedOwner) setComponentOwner(next, reusedOwner);
        const renderedRaw = type(next.props);
        const renderedInner = normalizeInner(renderedRaw);
        const prevInner = prev.__instance ?? null;
        if (prevInner && renderedInner && isSameVNode(prevInner, renderedInner)) {
            patchSame(prevInner, renderedInner, container);
            next.__instance = renderedInner;
            next.__dom = renderedInner.__dom ?? null;
        } else if (prevInner && renderedInner) {
            const parent = parentOf(prevInner) ?? container;
            const dom = prevInner.__dom;
            const lastNode = Array.isArray(dom)
                ? dom.length > 0
                    ? dom[dom.length - 1]
                    : null
                : dom ?? null;
            const anchorAfter = lastNode ? lastNode.nextSibling : null;
            unmount(prevInner);
            mount(renderedInner, parent, anchorAfter);
            next.__instance = renderedInner;
            next.__dom = renderedInner.__dom ?? null;
        } else if (!prevInner && renderedInner) {
            mount(renderedInner, container, null);
            next.__instance = renderedInner;
            next.__dom = renderedInner.__dom ?? null;
        } else if (prevInner && !renderedInner) {
            unmount(prevInner);
            next.__instance = null;
            next.__dom = null;
        } else {
            next.__instance = null;
            next.__dom = null;
        }
        return;
    }

    if (typeof type === 'string') {
        const el = prev.__dom as Element;
        next.__dom = el;
        patchProps(el, prev.props, next.props);
        diffChildren(prev.children, next.children, el, null);
        if (prev.ref !== next.ref) {
            if (prev.ref) applyRef(prev.ref, null);
            if (next.ref) applyRef(next.ref, el);
        }
        return;
    }
}

/**
 * Возвращает следующий за поддеревом prev DOM-узел в общем родителе. Нужен
 * diffChildren у Fragment, чтобы новые дети в конце оказались до соседних с
 * фрагментом узлов.
 *
 * @param vnode Узел, после которого ищется anchor.
 * @returns DOM-узел-сосед или null, если фрагмент в конце родителя.
 */
function getAnchorAfter(vnode: VNode): Node | null {
    const dom = vnode.__dom;
    if (!dom) return null;
    if (Array.isArray(dom)) {
        if (dom.length === 0) return null;
        return dom[dom.length - 1].nextSibling;
    }
    return dom.nextSibling;
}

/**
 * Собирает верхнеуровневые DOM-узлы фрагмента после diffChildren: для
 * детей-VNode берёт их свежие __dom, для примитивов ищет ближайший текстовый
 * узел после курсора (курсор стартует со scanFrom).
 *
 * @param children Нормализованные дети фрагмента.
 * @param parent DOM-родитель, в котором лежат верхнеуровневые узлы фрагмента.
 * @param scanFrom Узел-якорь, относительно которого ищутся примитивные дети.
 * @returns Массив верхнеуровневых DOM-узлов фрагмента.
 */
function collectFragmentDom(children: NormalizedChild[], parent: Node, scanFrom: Node | null): Node[] {
    if (children.length === 0) return [];

    let cursor: Node | null = scanFrom ?? parent.firstChild;
    const out: Node[] = [];

    for (const child of children) {
        if (typeof child === 'string' || typeof child === 'number') {
            while (cursor && cursor.nodeType !== 3) {
                cursor = cursor.nextSibling;
            }
            if (cursor) {
                out.push(cursor);
                cursor = cursor.nextSibling;
            }
            continue;
        }
        const nodes = flatDom(child);
        if (nodes.length > 0) {
            for (const n of nodes) out.push(n);
            cursor = nodes[nodes.length - 1].nextSibling;
        }
    }
    return out;
}

/**
 * Приводит сырой результат функции-компонента к VNode: null для пустых
 * результатов, обёртка в Fragment для примитива или массива, иначе сам VNode.
 *
 * @param raw Сырой результат вызова функции-компонента.
 * @returns Готовый VNode или null для пустого результата.
 */
function normalizeInner(raw: VNodeChild): VNode | null {
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
 * Точка входа патча между двумя VNode (или их отсутствием): mount при
 * prev=null, unmount при next=null, patchSame при isSameVNode, иначе
 * replaceVNode.
 *
 * @param prev Предыдущий VNode (или null при первичном монтировании).
 * @param next Новый VNode (или null при размонтировании).
 * @param container DOM-контейнер, в котором живёт поддерево.
 * @param anchor Опциональный якорь для insertBefore при mount.
 */
export function patch(prev: VNode | null, next: VNode | null, container: Node, anchor: Node | null = null): void {
    if (prev === null && next === null) return;
    if (prev === null && next !== null) {
        mount(next, container, anchor);
        return;
    }
    if (prev !== null && next === null) {
        unmount(prev);
        return;
    }
    if (prev !== null && next !== null) {
        if (isSameVNode(prev, next)) {
            patchSame(prev, next, container);
        } else {
            replaceVNode(prev, next, container);
        }
    }
}
