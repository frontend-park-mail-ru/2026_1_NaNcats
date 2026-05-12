import { PortalType, normalizeChildren } from './h';
import type { VNode, VNodeChild } from './types';

/**
 * Создаёт VNode-обёртку, дети которой при монтировании уходят в указанный
 * target, а не в окружающий контейнер (в нём __dom это пустой массив).
 * Применение: layout-уровневые модалки, всплывающие подсказки и т.п.
 *
 * target это готовый Element либо CSS-селектор для document.querySelector;
 * если селектор ничего не нашёл, функция кидает исключение.
 *
 * @param target DOM-элемент назначения или CSS-селектор для document.querySelector.
 * @param children Содержимое портала: один ребёнок, массив или примитив.
 * @returns VNode со специальным типом-маркером, готовый для render или patch.
 */
export function createPortal(target: Element | string, children: VNodeChild): VNode {
    const resolved: Element | null = typeof target === 'string' ? document.querySelector(target) : target;
    if (!resolved) {
        throw new Error(`vdom.createPortal: целевой элемент не найден по селектору "${String(target)}"`);
    }
    return {
        type: PortalType,
        props: { target: resolved } as Readonly<Record<string, unknown>>,
        children: normalizeChildren(children),
        __dom: null,
        __instance: null,
    };
}
