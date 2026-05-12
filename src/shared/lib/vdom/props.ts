/**
 * Применение пропсов к DOM-элементам: class, style, on*-обработчики, прочие
 * атрибуты и реактивные привязки.
 *
 * Реактивен проп, переданный функцией-аксессором: если значение это функция и
 * имя пропа не on*, оно вызывается через effect и атрибут обновляется при
 * изменении читаемых внутри сигналов. <div class={isActive}> реактивно,
 * <div class={isActive()}> вычисляется один раз при mount.
 */

import { effect, onCleanup } from '@shared/lib/signals';

import type { Ref, VNodeProps } from './types';

/**
 * Карта слушателей событий для одного DOM-узла (имя события -> обработчик).
 * Хранится на элементе как __vdomListeners, чтобы патч мог обновлять
 * обработчик без перевешивания.
 */
type ListenerMap = Map<string, EventListener>;

/** Расширение DOM-элемента с картой слушателей ядра. */
interface ElementWithListeners extends Element {
    __vdomListeners?: ListenerMap;
}

/** Обработчик пропсы on*: функция от события либо undefined. */
type PropEventHandler = ((event: Event) => void) | undefined;

/**
 * Возвращает (создавая при необходимости) карту слушателей, привязанную к
 * данному DOM-элементу.
 *
 * @param el Целевой DOM-элемент.
 * @returns Карта (имя события -> текущий слушатель).
 */
function ensureListenerMap(el: ElementWithListeners): ListenerMap {
    if (!el.__vdomListeners) {
        el.__vdomListeners = new Map();
    }
    return el.__vdomListeners;
}

/**
 * Возвращает true, если ключ пропса описывает on*-обработчик (имя начинается
 * с "on" и есть хотя бы ещё один символ).
 *
 * @param name Имя пропа.
 * @returns Признак того, что проп описывает on*-обработчик.
 */
function isEventProp(name: string): boolean {
    return name.length > 2 && name[0] === 'o' && name[1] === 'n';
}

/**
 * Извлекает имя DOM-события из имени пропа: onClick -> click.
 *
 * @param propName Имя пропа, прошедшее isEventProp.
 * @returns Имя события для addEventListener.
 */
function eventNameFromProp(propName: string): string {
    return propName.slice(2).toLowerCase();
}

/**
 * Преобразует ключ CSS-свойства из camelCase в kebab-case (для пропа style как
 * объекта: backgroundColor -> background-color).
 *
 * @param key CSS-ключ в camelCase.
 * @returns Ключ в kebab-case.
 */
function camelToKebab(key: string): string {
    return key.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

/**
 * Применяет проп style: строка (готовый CSS) либо объект с CSS-свойствами в
 * camelCase. Атрибут переустанавливается целиком, без точечного diff.
 *
 * @param el Целевой DOM-элемент.
 * @param value Значение пропа style.
 */
function applyStyle(el: Element, value: unknown): void {
    const htmlEl = el as HTMLElement;
    if (value === null || value === undefined || value === false) {
        htmlEl.removeAttribute('style');
        return;
    }
    if (typeof value === 'string') {
        htmlEl.setAttribute('style', value);
        return;
    }
    if (typeof value === 'object') {
        const parts: string[] = [];
        for (const key in value as Record<string, unknown>) {
            const cssValue = (value as Record<string, unknown>)[key];
            if (cssValue === null || cssValue === undefined || cssValue === false) continue;
            parts.push(`${camelToKebab(key)}: ${String(cssValue)}`);
        }
        if (parts.length === 0) {
            htmlEl.removeAttribute('style');
        } else {
            htmlEl.setAttribute('style', parts.join('; '));
        }
        return;
    }
    htmlEl.removeAttribute('style');
}

/**
 * Применяет проп class: только строка (или число) либо отсутствие значения.
 * Объектная форма class={{ name: bool }} не поддерживается.
 *
 * @param el Целевой DOM-элемент.
 * @param value Значение пропа class.
 */
function applyClass(el: Element, value: unknown): void {
    if (value === null || value === undefined || value === false) {
        el.removeAttribute('class');
        return;
    }
    if (typeof value === 'string') {
        if (value === '') {
            el.removeAttribute('class');
        } else {
            el.setAttribute('class', value);
        }
        return;
    }
    if (typeof value === 'number') {
        el.setAttribute('class', String(value));
        return;
    }
    el.removeAttribute('class');
}

/**
 * Применяет проп ref: вызывает колбэк или заполняет поле current объекта.
 * При монтировании передаётся DOM-элемент, при размонтировании или смене ref
 * передаётся null.
 *
 * @param ref Ссылка (колбэк или объект с current); может отсутствовать.
 * @param value Текущий DOM-элемент или null при размонтировании.
 */
export function applyRef(ref: Ref<Element> | undefined, value: Element | null): void {
    if (!ref) return;
    if (typeof ref === 'function') {
        ref(value);
        return;
    }
    ref.current = value;
}

/**
 * Применяет одно конкретное (не функциональное) значение пропа: свитч по
 * class/style с откатом на setAttribute. on*-обработчики сюда не доходят.
 *
 * @param el Целевой DOM-элемент.
 * @param name Имя пропа.
 * @param next Новое значение пропа (или undefined при удалении).
 */
function writeValue(el: Element, name: string, next: unknown): void {
    if (name === 'class' || name === 'className') {
        applyClass(el, next);
        return;
    }
    if (name === 'style') {
        applyStyle(el, next);
        return;
    }
    if (next === null || next === undefined || next === false) {
        el.removeAttribute(name);
        return;
    }
    if (next === true) {
        el.setAttribute(name, '');
        return;
    }
    el.setAttribute(name, String(next));
}

/**
 * Привязывает функциональный (аксессорный) проп к DOM-элементу через effect:
 * при изменении читаемых сигналов effect перезапускается и переустанавливает
 * атрибут. Disposer регистрируется через onCleanup текущего owner.
 *
 * @param el Целевой DOM-элемент.
 * @param name Имя пропа.
 * @param accessor Функция-аксессор, возвращающая текущее значение пропа.
 */
function bindReactiveProp(el: Element, name: string, accessor: () => unknown): void {
    const dispose = effect(() => {
        writeValue(el, name, accessor());
    });
    onCleanup(dispose);
}

/**
 * Применяет один проп: свитч по class/style/on* с откатом на setAttribute.
 * Если значение это функция и имя не on*, оно трактуется как аксессор и
 * оборачивается в effect. Для on*: при смене ссылки старый обработчик
 * снимается, новый вешается; на элемент одна функция-слушатель на событие.
 *
 * @param el Целевой DOM-элемент.
 * @param name Имя пропа.
 * @param prev Предыдущее значение пропа (или undefined при первичном проставлении).
 * @param next Новое значение пропа (или undefined при удалении).
 */
function applyProp(el: Element, name: string, prev: unknown, next: unknown): void {
    if (prev === next) return;

    // children обрабатывается через VNode.children и не должен попадать в DOM
    // как атрибут (иначе на элементах появится children="[object Object]").
    if (name === 'children') return;

    if (isEventProp(name)) {
        const evName = eventNameFromProp(name);
        const map = ensureListenerMap(el as ElementWithListeners);
        const oldFn = map.get(evName);
        if (oldFn) {
            el.removeEventListener(evName, oldFn);
            map.delete(evName);
        }
        const handler = next as PropEventHandler;
        if (typeof handler === 'function') {
            const listener: EventListener = (event) => handler(event);
            el.addEventListener(evName, listener);
            map.set(evName, listener);
        }
        return;
    }

    if (typeof next === 'function') {
        bindReactiveProp(el, name, next as () => unknown);
        return;
    }

    writeValue(el, name, next);
}

/**
 * Проставляет все пропсы при первичном монтировании элемента (проход только
 * по новым ключам, без шага снятия отсутствующих).
 *
 * @param el Целевой DOM-элемент.
 * @param props Карта пропсов нового VNode (без key, ref, children).
 */
export function setProps(el: Element, props: VNodeProps): void {
    for (const name in props) {
        applyProp(el, name, undefined, props[name]);
    }
}

/**
 * Согласует пропсы при патче: проходит по новым пропсам с парой (старое,
 * новое), затем снимает те старые ключи, которых нет в nextProps.
 *
 * @param el Целевой DOM-элемент.
 * @param prevProps Пропсы предыдущего VNode.
 * @param nextProps Пропсы нового VNode.
 */
export function patchProps(el: Element, prevProps: VNodeProps, nextProps: VNodeProps): void {
    for (const name in nextProps) {
        applyProp(el, name, prevProps[name], nextProps[name]);
    }
    for (const name in prevProps) {
        if (name in nextProps) continue;
        applyProp(el, name, prevProps[name], undefined);
    }
}

/**
 * Снимает все известные ядру слушатели событий с DOM-элемента (при
 * размонтировании, чтобы не оставлять висящих обработчиков).
 *
 * @param el Целевой DOM-элемент.
 */
export function removeAllListeners(el: Element): void {
    const target = el as ElementWithListeners;
    const map = target.__vdomListeners;
    if (!map) return;
    for (const [evName, listener] of map) {
        el.removeEventListener(evName, listener);
    }
    map.clear();
}
