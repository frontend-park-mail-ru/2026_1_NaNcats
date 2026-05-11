/**
 * Dev JSX runtime для Babel automatic-runtime.
 *
 * Отличается от production-runtime тем, что Babel в dev-режиме передаёт две
 * дополнительные позиции: source (имя файла и координаты вызова) и self
 * (контекст вызова). Здесь они принимаются и игнорируются: ядро VDOM пока
 * не использует их. Если в будущем потребуется DevTools-интеграция, source
 * можно класть в метаданные VNode без правок Babel-конфига.
 *
 * Семантика делегирования совпадает с jsx-runtime: тип, пропсы и key
 * передаются в общую фабрику jsx, которая внутри уже вызывает h из ядра VDOM.
 */

import { Fragment } from './jsx-runtime';
import { jsx } from './jsx-runtime';
import type { Component, VNodeProps } from '@shared/lib/vdom';

export { Fragment };

/**
 * Описание координат JSX-вызова, которые Babel automatic передаёт в dev-режиме.
 *
 * Поля заполняются плагином автоматически, пользователь их не пишет.
 */
interface JsxDevSource {
    /** Полное имя файла исходника. */
    fileName: string;
    /** Номер строки JSX-выражения. */
    lineNumber: number;
    /** Номер колонки JSX-выражения. */
    columnNumber: number;
}

/**
 * Dev-вариант фабрики VNode.
 *
 * Делегирует в общую jsx-фабрику: extra-аргументы (isStaticChildren, source,
 * self) на текущем этапе игнорируются. Это нормально, потому что в нашей
 * реализации между статическими и динамическими массивами детей разницы нет.
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
