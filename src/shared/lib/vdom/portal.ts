import { PortalType, normalizeChildren } from './h';
import type { VNode, VNodeChild } from './types';

/**
 * Создаёт VNode-обёртку, дети которой при монтировании уходят не в
 * окружающий контейнер, а в указанный target.
 *
 * Применение: layout-уровневые модалки, всплывающие подсказки и любые
 * элементы, которые должны жить выше по дереву DOM, чем место, где они
 * описаны в JSX. В исходном контейнере портал не оставляет видимых узлов:
 * его __dom это пустой массив.
 *
 * Параметр target можно передать одним из двух способов: либо готовый
 * Element (например, найденный заранее), либо CSS-селектор, который будет
 * разрешён через document.querySelector в момент создания VNode. Если
 * селектор не нашёл узел, функция кидает исключение, потому что молчаливый
 * пропуск превратился бы в утечку обработчиков и невидимый рендер.
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
