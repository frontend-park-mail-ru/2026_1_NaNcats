/**
 * Фабрика VNode и связанные нормализаторы детей.
 *
 * Дисциплина реактивных выражений. Этот VDOM работает без compile-time-перезаписи
 * JSX (в отличие от SolidJS, где babel-plugin-jsx-dom-expressions заворачивает
 * выражения в эффекты автоматически). Поэтому правило простое: реактивно
 * ровно одно из четырёх:
 *   1. аксессор сигнала: <div>{count}</div>, где count это signal-аксессор;
 *   2. аксессор computed: <div class={isActive}>, где isActive это computed;
 *   3. inline-фабрика-аксессор: <div>{() => count() * 2}</div>;
 *   4. блоки <Show when={...}> и <For each={...}>, у которых when/each это
 *      аксессоры.
 *
 * Голое выражение <div>{count() * 2}</div> вычисляется ОДИН раз при mount и
 * больше не обновляется. Это сознательная цена за отсутствие compile-time-
 * перезаписи: реактивно ровно то, что является функцией.
 */

import type {
    Component,
    Key,
    NormalizedChild,
    RawProps,
    Ref,
    VNode,
    VNodeChild,
    VNodeProps,
} from './types';

/**
 * Маркер фрагмента: служит значением VNode.type для узла-обёртки, который
 * сам по себе не порождает DOM-элемента, а только группирует детей.
 *
 * Сравнение по ссылке через Symbol гарантирует, что фрагменты не пересекаются
 * с пользовательскими типами (строковыми тегами или функциями-компонентами).
 */
export const Fragment: unique symbol = Symbol('vdom.Fragment');

/**
 * Внутренний маркер портала: используется фабрикой createPortal и узнаётся
 * рендером, чтобы спустить детей в указанный target вместо текущего контейнера.
 *
 * Экспортируется только внутри пакета vdom; для пользовательского кода точкой
 * входа остаётся createPortal.
 */
export const PortalType: unique symbol = Symbol('vdom.Portal');

/**
 * Маркер динамического (реактивного) поддерева: используется Show, For и
 * Suspense, чтобы заводить эффект-управляемое поддерево с известной позицией
 * в родителе. Узел такого типа описывает не статическую разметку, а пару
 * mount/disposer: ядро при mount вызывает props.mount(parent, anchor) и
 * запоминает возвращённый disposer, а при unmount вызывает его, чтобы снять
 * эффекты и DOM.
 *
 * Контракт пропсов узла, согласованный с реализацией в render.ts:
 *   mount: (parent: Node, anchor: Node | null) => () => void
 * Возвращаемый callback должен снять все DOM-узлы и реактивные подписки.
 */
export const DynamicType: unique symbol = Symbol('vdom.Dynamic');

/**
 * Разворачивает сырое значение ребёнка в плоский массив нормализованных детей.
 *
 * Правила нормализации:
 * - null, undefined, true и false выкидываются (это позволяет писать
 *   условные вставки `{cond && <X/>}` без явных обёрток).
 * - Массивы разворачиваются рекурсивно, чтобы фабрика принимала и одиночные
 *   значения, и группы.
 * - string и number сохраняются как есть: на стадии render они станут
 *   текстовыми DOM-узлами без отдельного VNode.
 * - VNode копируется в выход без изменений.
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
 * Нормализует произвольное значение детей в плоский массив.
 *
 * Используется и фабрикой h, и адаптером jsx-runtime: оба сценария отдают
 * children в едином виде, чтобы render/patch не разбирались с особыми
 * формами.
 *
 * @param raw Сырое значение детей.
 * @returns Плоский массив нормализованных детей (без null, undefined, true, false).
 */
export function normalizeChildren(raw: VNodeChild): NormalizedChild[] {
    const out: NormalizedChild[] = [];
    flattenInto(raw, out);
    return out;
}

/**
 * Создаёт VNode по сырому набору пропсов и переменному списку детей.
 *
 * Поведение:
 * - Извлекает поля key и ref из props в одноимённые поля VNode; в итоговые
 *   VNode.props они не попадают.
 * - Если children передан переменным списком (вариативные аргументы), он
 *   побеждает над props.children: это совпадает с поведением classic React,
 *   но автоматическому JSX-рантайму ничего не мешает класть children в props.
 * - Возвращаемый VNode имеет неизменяемые children-массив и props-карту в
 *   плане ссылок: ядро не мутирует их, только использует.
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

    const ref: Ref<Element> | undefined = raw.ref;

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
