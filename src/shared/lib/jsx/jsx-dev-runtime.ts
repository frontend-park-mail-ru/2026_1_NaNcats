/**
 * Dev JSX runtime для Babel automatic. Babel в dev-режиме передаёт ещё source
 * и self: здесь они принимаются и игнорируются. Делегирует в jsx из
 * jsx-runtime.
 */

import { Fragment } from './jsx-runtime';
import { jsx } from './jsx-runtime';
import type { Component, VNodeProps } from '@shared/lib/vdom';

export { Fragment };

/** Координаты JSX-вызова, которые Babel automatic передаёт в dev-режиме. */
interface JsxDevSource {
    /** Полное имя файла исходника. */
    fileName: string;
    /** Номер строки JSX-выражения. */
    lineNumber: number;
    /** Номер колонки JSX-выражения. */
    columnNumber: number;
}

/**
 * Dev-вариант фабрики VNode: делегирует в jsx, extra-аргументы игнорируются.
 *
 * @param type Имя HTML-тега, функция-компонент или символ-маркер.
 * @param props Объект пропсов; Babel кладёт детей в props.children.
 * @param key Опциональный ключ для согласования списка.
 * @param _isStaticChildren Подсказка Babel о статическом массиве детей; не используется.
 * @param _source Координаты JSX-выражения в исходнике; не используются.
 * @param _self Контекст вызова JSX; не используется.
 * @returns Готовый VNode.
 */
export function jsxDEV(
    type: string | symbol | Component<VNodeProps>,
    props: Record<string, unknown> | null,
    key?: unknown,
    _isStaticChildren?: boolean,
    _source?: JsxDevSource,
    _self?: unknown,
): unknown {
    return jsx(type, props, key);
}
