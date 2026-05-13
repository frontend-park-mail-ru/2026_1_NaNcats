/**
 * Фабрика VNode и нормализаторы детей.
 *
 * VDOM работает без compile-time-перезаписи JSX, поэтому реактивно ровно то,
 * что передано функцией: аксессор сигнала/computed, inline-фабрика
 * <div>{() => count() * 2}</div> или when/each у <Show>/<For>. Голое выражение
 * <div>{count() * 2}</div> вычисляется один раз при mount.
 */

import type {
    Component,
    Key,
    NormalizedChild,
    RawProps,
    VNode,
    VNodeChild,
    VNodeProps,
} from './types';

/**
 * Маркер фрагмента: значение VNode.type для узла-обёртки, который сам по себе
 * не порождает DOM-элемента, а только группирует детей.
 */
export const Fragment: unique symbol = Symbol('vdom.Fragment');

/**
 * Внутренний маркер портала: узнаётся рендером, чтобы спустить детей в
 * указанный target вместо текущего контейнера. Точка входа для
 * пользовательского кода это createPortal.
 */
export const PortalType: unique symbol = Symbol('vdom.Portal');

/**
 * Маркер динамического (реактивного) поддерева: используется Show, For и
 * Suspense. Узел описывает пару mount/disposer: ядро при mount вызывает
 * props.mount(parent, anchor) и запоминает disposer, при unmount вызывает его.
 */
export const DynamicType: unique symbol = Symbol('vdom.Dynamic');

/**
 * Разворачивает сырое значение ребёнка в плоский массив нормализованных детей:
 * null/undefined/true/false выкидываются, массивы разворачиваются рекурсивно,
 * string/number и VNode попадают в выход как есть.
 *
 * @param raw Сырое значение, пришедшее из вызова h или из props.children.
 * @param out Аккумулятор плоского списка, в который дописываются результаты.
 */
function flattenInto(raw: VNodeChild, out: NormalizedChild[]): void {
    if (raw === null || raw === undefined || raw === false || raw === true) {
        return;
    }
    if (Array.isArray(raw)) {
        for (const item of raw) {
            flattenInto(item, out);
        }
        return;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
        out.push(raw);
        return;
    }
    if (typeof raw === 'function') {
        out.push(raw as unknown as NormalizedChild);
        return;
    }
    out.push(raw);
}

/**
 * Нормализует произвольное значение детей в плоский массив (без null,
 * undefined, true, false). Используется фабрикой h и адаптером jsx-runtime.
 *
 * @param raw Сырое значение детей.
 * @returns Плоский массив нормализованных детей.
 */
export function normalizeChildren(raw: VNodeChild): NormalizedChild[] {
    const out: NormalizedChild[] = [];
    flattenInto(raw, out);
    return out;
}

/**
 * Создаёт VNode по сырому набору пропсов и переменному списку детей. Поля key
 * и ref выносятся на уровень VNode (в VNode.props не попадают), вариативные
 * дети перекрывают props.children.
 *
 * @template P Тип пропсов узла.
 * @param type Имя HTML-тега, функция-компонент или служебный символ (Fragment, портал).
 * @param props Сырые пропсы (могут содержать key, ref, children); null трактуется как пустой объект.
 * @param children Вариативные дети; если они переданы, перекрывают props.children.
 * @returns Готовый VNode для render или patch.
 */
export function h<P extends VNodeProps = VNodeProps>(
    type: string | symbol | Component<P>,
    props: RawProps | null,
    ...children: VNodeChild[]
): VNode<P> {
    const raw: RawProps = props ?? {};

    let key: Key | undefined;
    if (typeof raw.key === 'string' || typeof raw.key === 'number') {
        key = raw.key;
    }

    const ref = raw.ref;

    const cleanProps: Record<string, unknown> = {};
    for (const propName in raw) {
        if (propName === 'key' || propName === 'ref') {
            continue;
        }
        cleanProps[propName] = raw[propName];
    }

    const childSource: VNodeChild = children.length > 0 ? children : raw.children;
    const normalized = normalizeChildren(childSource);

    return {
        type,
        props: cleanProps as unknown as P,
        children: normalized,
        key,
        ref,
        __dom: null,
        __instance: null,
    };
}
