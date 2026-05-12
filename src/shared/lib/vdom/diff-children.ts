import { isSameVNode, patch, patchText } from './patch';
import { firstDom, flatDom, mount, mountChild, unmount } from './render';
import type { Key, NormalizedChild, VNode } from './types';

/**
 * Признак того, что список детей пригоден для keyed-алгоритма: не пуст, все
 * элементы это VNode (не примитивы) и у каждого проставлен key.
 *
 * @param children Список детей.
 * @returns Признак того, что весь список keyed.
 */
function isFullyKeyed(children: NormalizedChild[]): boolean {
    if (children.length === 0) return false;
    for (const c of children) {
        if (typeof c === 'string' || typeof c === 'number') return false;
        if (c.key === undefined) return false;
    }
    return true;
}

/** Размонтирует ребёнка-VNode и убирает его DOM из родителя. */
function unmountChild(child: VNode): void {
    unmount(child);
}

/**
 * Индексное (не ключевое) согласование списков детей: пары совпадающих типов
 * патчатся в-месте, разные заменяются; лишний хвост монтируется или
 * размонтируется. Для пар примитивов textNodes хранит ссылки на Text, чтобы
 * патчить nodeValue вместо replaceChild.
 *
 * @param prevChildren Старый список детей.
 * @param nextChildren Новый список детей.
 * @param parent Общий DOM-родитель.
 * @param anchor Якорь для вставки хвоста (узел-сосед после поддерева).
 */
function diffUnkeyed(
    prevChildren: NormalizedChild[],
    nextChildren: NormalizedChild[],
    parent: Node,
    anchor: Node | null,
    scanFrom: Node | null = null,
): void {
    const prevTextNodes = collectTextNodes(prevChildren, parent, scanFrom);
    const common = Math.min(prevChildren.length, nextChildren.length);

    for (let i = 0; i < common; i += 1) {
        const a = prevChildren[i];
        const b = nextChildren[i];
        if ((typeof a === 'string' || typeof a === 'number') && (typeof b === 'string' || typeof b === 'number')) {
            const textNode = prevTextNodes.get(i);
            if (textNode) {
                patchText(textNode, a, b);
            }
            continue;
        }
        if (typeof a !== 'string' && typeof a !== 'number' && typeof b !== 'string' && typeof b !== 'number') {
            patch(a, b, parent, null);
            continue;
        }
        const oldDomNodes = collectDomNodesAt(a, prevTextNodes, i);
        const insertionAnchor = oldDomNodes.length > 0 ? oldDomNodes[0] : anchor;
        if (typeof b === 'string' || typeof b === 'number') {
            const textNode = document.createTextNode(String(b));
            parent.insertBefore(textNode, insertionAnchor);
        } else {
            mount(b, parent, insertionAnchor);
        }
        for (const node of oldDomNodes) {
            if (node.parentNode === parent) parent.removeChild(node);
        }
        if (typeof a !== 'string' && typeof a !== 'number') {
            unmountChild(a);
        }
    }

    if (nextChildren.length > prevChildren.length) {
        for (let i = common; i < nextChildren.length; i += 1) {
            const child = nextChildren[i];
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                parent.insertBefore(textNode, anchor);
            } else {
                mount(child, parent, anchor);
            }
        }
    } else if (prevChildren.length > nextChildren.length) {
        for (let i = common; i < prevChildren.length; i += 1) {
            const child = prevChildren[i];
            if (typeof child === 'string' || typeof child === 'number') {
                const node = prevTextNodes.get(i);
                if (node && node.parentNode === parent) parent.removeChild(node);
            } else {
                unmountChild(child);
            }
        }
    }
}

/**
 * Собирает Map (индекс ребёнка-примитива -> Text-узел) для текущего DOM.
 *
 * У примитивов нет своего VNode, поэтому привязка идёт через позицию в массиве
 * и порядок узлов в parent. startCursor задаёт начало области сканирования:
 * для тегов null (от parent.firstChild), для фрагментов firstDom(prev), чтобы
 * не захватывать соседние с фрагментом текстовые узлы.
 *
 * @param children Нормализованный массив детей.
 * @param parent Их DOM-родитель.
 * @param startCursor Начальный узел сканирования (null означает parent.firstChild).
 * @returns Карта (индекс ребёнка-примитива -> Text-узел).
 */
function collectTextNodes(
    children: NormalizedChild[],
    parent: Node,
    startCursor: Node | null = null,
): Map<number, Text> {
    const map = new Map<number, Text>();
    let cursor: Node | null = startCursor ?? parent.firstChild;

    for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (typeof child !== 'string' && typeof child !== 'number') {
            const nodes = flatDom(child);
            if (nodes.length > 0) {
                cursor = nodes[nodes.length - 1].nextSibling;
            }
            continue;
        }
        while (cursor && cursor.nodeType !== 3) {
            cursor = cursor.nextSibling;
        }
        if (cursor) {
            map.set(i, cursor as Text);
            cursor = cursor.nextSibling;
        }
    }
    return map;
}

/**
 * Возвращает все верхнеуровневые DOM-узлы нормализованного ребёнка: для VNode
 * это flatDom, для примитива один Text-узел из карты textNodes.
 *
 * @param child Нормализованный ребёнок.
 * @param textNodes Карта (индекс примитива в массиве children -> Text-узел).
 * @param index Индекс ребёнка.
 * @returns Список DOM-узлов поддерева.
 */
function collectDomNodesAt(child: NormalizedChild, textNodes: Map<number, Text>, index: number): Node[] {
    if (typeof child === 'string' || typeof child === 'number') {
        const node = textNodes.get(index);
        return node ? [node] : [];
    }
    return flatDom(child);
}

/**
 * Keyed-согласование списков детей в стиле Vue 2: head-sync, tail-sync, затем
 * для середины карта (key -> индекс в prev). Узлы из prev по совпавшему ключу
 * патчатся и при необходимости переставляются через insertBefore, остальные
 * монтируются заново; неиспользованные узлы prev размонтируются.
 *
 * @param prevChildren Старый список детей (все с key).
 * @param nextChildren Новый список детей (все с key).
 * @param parent Общий DOM-родитель.
 * @param fallbackAnchor Якорь для вставки в конце (если фрагмент-родитель имеет соседей).
 */
function diffKeyed(
    prevChildren: VNode[],
    nextChildren: VNode[],
    parent: Node,
    fallbackAnchor: Node | null,
): void {
    let prevStart = 0;
    let prevEnd = prevChildren.length - 1;
    let nextStart = 0;
    let nextEnd = nextChildren.length - 1;

    while (prevStart <= prevEnd && nextStart <= nextEnd) {
        const a = prevChildren[prevStart];
        const b = nextChildren[nextStart];
        if (!isSameVNode(a, b)) break;
        patch(a, b, parent, null);
        prevStart += 1;
        nextStart += 1;
    }

    while (prevStart <= prevEnd && nextStart <= nextEnd) {
        const a = prevChildren[prevEnd];
        const b = nextChildren[nextEnd];
        if (!isSameVNode(a, b)) break;
        patch(a, b, parent, null);
        prevEnd -= 1;
        nextEnd -= 1;
    }

    if (prevStart > prevEnd) {
        const anchor =
            nextEnd + 1 < nextChildren.length ? firstDom(nextChildren[nextEnd + 1]) : fallbackAnchor;
        while (nextStart <= nextEnd) {
            mount(nextChildren[nextStart], parent, anchor);
            nextStart += 1;
        }
        return;
    }

    if (nextStart > nextEnd) {
        while (prevStart <= prevEnd) {
            unmountChild(prevChildren[prevStart]);
            prevStart += 1;
        }
        return;
    }

    const keyToPrevIndex = new Map<Key, number>();
    for (let i = prevStart; i <= prevEnd; i += 1) {
        const k = prevChildren[i].key;
        if (k !== undefined) keyToPrevIndex.set(k, i);
    }

    const used = new Set<number>();
    const anchor =
        nextEnd + 1 < nextChildren.length ? firstDom(nextChildren[nextEnd + 1]) : fallbackAnchor;

    for (let i = nextEnd; i >= nextStart; i -= 1) {
        const nextChild = nextChildren[i];
        const key = nextChild.key;
        const prevIndex = key !== undefined ? keyToPrevIndex.get(key) : undefined;
        const nextAnchor =
            i + 1 < nextChildren.length ? firstDom(nextChildren[i + 1]) : anchor;

        if (prevIndex === undefined) {
            mount(nextChild, parent, nextAnchor);
            continue;
        }

        const prevChild = prevChildren[prevIndex];
        if (prevChild.type !== nextChild.type) {
            mount(nextChild, parent, nextAnchor);
            unmountChild(prevChild);
            used.add(prevIndex);
            continue;
        }

        patch(prevChild, nextChild, parent, null);
        used.add(prevIndex);

        const nodes = flatDom(nextChild);
        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
        if (lastNode && lastNode.nextSibling !== nextAnchor) {
            for (const node of nodes) {
                parent.insertBefore(node, nextAnchor);
            }
        }
    }

    for (let i = prevStart; i <= prevEnd; i += 1) {
        if (!used.has(i)) {
            unmountChild(prevChildren[i]);
        }
    }
}

/**
 * Согласование двух списков детей в общем родителе: keyed-путь, если оба
 * списка целиком из VNode с key, иначе индексное сравнение.
 *
 * scanFrom задаёт стартовую позицию для разрешения примитивных детей в DOM:
 * для тегов null, для фрагментов первый DOM-узел фрагмента (чтобы не путать с
 * соседями).
 *
 * @param prevChildren Старый список детей.
 * @param nextChildren Новый список детей.
 * @param parent Общий DOM-родитель.
 * @param anchor Якорь для вставки хвоста (соседний DOM-узел после блока детей).
 * @param scanFrom Стартовая позиция для определения текстовых детей (null означает parent.firstChild).
 */
export function diffChildren(
    prevChildren: NormalizedChild[],
    nextChildren: NormalizedChild[],
    parent: Node,
    anchor: Node | null = null,
    scanFrom: Node | null = null,
): void {
    if (prevChildren.length === 0 && nextChildren.length === 0) return;
    if (prevChildren.length === 0) {
        for (const child of nextChildren) {
            mountChild(child, parent, anchor);
        }
        return;
    }
    if (nextChildren.length === 0) {
        const textNodes = collectTextNodes(prevChildren, parent, scanFrom);
        for (let i = 0; i < prevChildren.length; i += 1) {
            const child = prevChildren[i];
            if (typeof child === 'string' || typeof child === 'number') {
                const node = textNodes.get(i);
                if (node && node.parentNode === parent) parent.removeChild(node);
            } else {
                unmountChild(child);
            }
        }
        return;
    }

    if (isFullyKeyed(prevChildren) && isFullyKeyed(nextChildren)) {
        diffKeyed(prevChildren as VNode[], nextChildren as VNode[], parent, anchor);
        return;
    }

    diffUnkeyed(prevChildren, nextChildren, parent, anchor, scanFrom);
}
