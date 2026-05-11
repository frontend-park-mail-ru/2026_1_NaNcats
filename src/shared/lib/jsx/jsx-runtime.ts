/**
 * Production JSX runtime для Babel automatic-runtime.
 *
 * Babel в production-режиме раскрывает каждый JSX-вызов в jsx(type, props, key)
 * или jsxs(type, props, key) и забирает их именно из этого модуля. Здесь обе
 * фабрики делегируют на h() из ядра VDOM: семантически разница между jsx и
 * jsxs (статически известный массив детей против одиночного ребёнка) у нас
 * стирается, потому что normalizeChildren в h всё равно сводит детей к плоскому
 * массиву.
 *
 * Контракт с h из Unit 2: вариативные дети, если переданы, перекрывают
 * props.children. Babel кладёт детей в props.children, поэтому здесь мы
 * вытаскиваем их из props и передаём вариативно, чтобы h получил их в виде
 * одного источника без дублирования. Поле children из props при этом всё
 * равно отбрасывается внутри h, так что в итоговом VNode.props его не будет.
 */

import { Fragment, h } from '@shared/lib/vdom';
import type { Component, RawProps, VNodeChild, VNodeProps } from '@shared/lib/vdom';

export { Fragment };

/**
 * Достаёт детей из props в форму вариативных аргументов для h.
 *
 * Babel automatic кладёт сюда либо одиночное значение, либо массив. Возвращаем
 * массив, который потом разворачивается в варарги. Если children нет, отдаём
 * пустой массив: тогда h получит ноль вариативных аргументов и нормализует
 * пустой список.
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
 * Извлекает key из пропсов, добавляя его на верхний уровень для h.
 *
 * Babel automatic передаёт key отдельным аргументом фабрики, а h ждёт его в
 * RawProps. Чтобы не мутировать чужой объект, копируем поля и дописываем key,
 * только если он определён. То же касается ref: Babel не трогает ref, поэтому
 * он уже лежит в props и не требует отдельной обработки.
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
 * Production-фабрика VNode для одиночного или нестатического ребёнка.
 *
 * Делегирует в h: дети из props.children разворачиваются в варарги, key
 * подмешивается в props, чтобы h положил его на уровень VNode.
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
 * Production-фабрика VNode для статически известного массива детей.
 *
 * Babel automatic зовёт jsxs, когда массив детей известен на этапе компиляции.
 * Нам семантически всё равно: нормализатор детей в h всё равно сведёт всё к
 * плоскому массиву. Реализация делегирует в ту же точку, что и jsx.
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
