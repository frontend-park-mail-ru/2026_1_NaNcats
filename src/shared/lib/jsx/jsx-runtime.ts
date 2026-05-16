/**
 * Production JSX runtime для Babel automatic. Обе фабрики делегируют в h из
 * ядра VDOM: разница между jsx и jsxs у нас стирается, normalizeChildren всё
 * равно сводит детей к плоскому массиву. Дети из props.children передаются в h
 * вариативно (там они перекрывают props.children, а ключ children из props
 * отбрасывается).
 */

import { Fragment, h } from '@shared/lib/vdom';
import type { Component, RawProps, VNodeChild, VNodeProps } from '@shared/lib/vdom';

export { Fragment };

/**
 * Приводит props.children к массиву для передачи в h вариативно (одиночное
 * значение оборачивается в массив, отсутствие даёт пустой массив).
 *
 * @param children Сырое значение props.children.
 * @returns Массив, который безопасно разворачивать в варарги h.
 */
function arrayifyChildren(children: VNodeChild | undefined): VNodeChild[] {
    if (children === undefined) {
        return [];
    }
    if (Array.isArray(children)) {
        return children;
    }
    return [children];
}

/**
 * Копирует пропсы и дописывает в них key из отдельного аргумента фабрики (ref
 * Babel не трогает, он уже в props).
 *
 * @param props Исходные пропсы от Babel.
 * @param key Опциональный key из аргумента фабрики.
 * @returns Сырые пропсы для передачи в h.
 */
function mergeKey(props: Record<string, unknown> | null, key: unknown): RawProps {
    const out: Record<string, unknown> = props ? { ...props } : {};
    if (key !== undefined && key !== null && (typeof key === 'string' || typeof key === 'number')) {
        out.key = key;
    }
    return out as RawProps;
}

/**
 * Production-фабрика VNode: делегирует в h, дети разворачиваются в варарги, key
 * подмешивается в props.
 *
 * @param type Имя HTML-тега, функция-компонент или символ-маркер (Fragment, портал).
 * @param props Объект пропсов; Babel automatic кладёт детей в props.children.
 * @param key Опциональный ключ для согласования списка.
 * @returns Готовый VNode.
 */
export function jsx(
    type: string | symbol | Component<VNodeProps>,
    props: Record<string, unknown> | null,
    key?: unknown,
): unknown {
    const raw = mergeKey(props, key);
    const children = arrayifyChildren(raw.children);
    return h(type, raw, ...children);
}

/**
 * Production-фабрика VNode для статически известного массива детей. Делегирует
 * в jsx: нормализатор в h всё равно сведёт детей к плоскому массиву.
 *
 * @param type Имя HTML-тега, функция-компонент или символ-маркер.
 * @param props Объект пропсов; props.children это массив детей.
 * @param key Опциональный ключ.
 * @returns Готовый VNode.
 */
export function jsxs(
    type: string | symbol | Component<VNodeProps>,
    props: Record<string, unknown> | null,
    key?: unknown,
): unknown {
    return jsx(type, props, key);
}
