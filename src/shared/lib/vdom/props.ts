/**
 * Применение пропсов к DOM-элементам: class, style, on*-обработчики и
 * остальные атрибуты, плюс реактивные привязки через сигналы.
 *
 * Дисциплина реактивных выражений в этом фреймворке. JSX-компилятора, который
 * бы автоматически переписывал выражения в эффекты (как делает SolidJS через
 * babel-plugin-jsx-dom-expressions), у нас нет. Поэтому правило простое:
 * реактивно ровно то, что пользователь передал как функцию-аксессор. Если
 * проп-значение это функция и при этом имя пропа не описывает обработчик
 * события (не начинается на on*), функция вызывается через effect, и
 * атрибут обновляется при каждом изменении читаемых внутри неё сигналов.
 *
 * Допустимые формы реактивного пропа: <div class={isActive}> (где isActive
 * это аксессор сигнала или computed), <div style={() => ({ color: c() })}>.
 * НЕдопустимая форма: <div class={isActive()}> вычисляется один раз при
 * mount и больше не обновляется. Это сознательная цена за отсутствие
 * compile-time-перезаписи: реактивно ровно то, что является функцией.
 */

import { effect, onCleanup } from '@shared/lib/signals';

import type { Ref, VNodeProps } from './types';

/**
 * Внутренняя карта подвешенных слушателей события для одного DOM-узла.
 *
 * Хранится прямо на элементе в виде свойства __vdomListeners, чтобы патч
 * мог обновлять обработчик без перевешивания внешнего listener-обвеса.
 * Ключ это нормализованное имя события ("click", "input"), значение это
 * текущая функция-обработчик.
 */
type ListenerMap = Map<string, EventListener>;

/**
 * Внутренний интерфейс расширения DOM-элемента: на него ядро вешает свою
 * карту слушателей. Используется только внутри props.ts.
 */
interface ElementWithListeners extends Element {
    __vdomListeners?: ListenerMap;
}

/**
 * Внешний обработчик пропсы on*: либо обычная функция от события, либо
 * undefined для отсутствия обработчика.
 *
 * Сам тип события намеренно ослаблен до Event: на уровне ядра VDOM мы не
 * различаем виды событий, конкретные типы задаются в типах JSX (Unit 5).
 */
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
 * Возвращает true, если ключ пропса описывает обработчик события вида onClick.
 *
 * Конвенция: имя начинается с "on", за которым идёт хотя бы один символ.
 * Регистр следующего символа не важен, ядро всё равно приводит хвост к
 * нижнему регистру для имени события.
 *
 * @param name Имя пропа.
 * @returns Признак того, что проп описывает on*-обработчик.
 */
function isEventProp(name: string): boolean {
    return name.length > 2 && name[0] === 'o' && name[1] === 'n';
}

/**
 * Извлекает нормализованное имя DOM-события из имени пропа.
 *
 * Пример: onClick превращается в click, onPointerDown в pointerdown.
 *
 * @param propName Имя пропа, прошедшее isEventProp.
 * @returns Имя события для addEventListener.
 */
function eventNameFromProp(propName: string): string {
    return propName.slice(2).toLowerCase();
}

/**
 * Преобразует ключ CSS-свойства из camelCase в kebab-case.
 *
 * Это нужно для пропа style как объекта: пишем backgroundColor, в DOM ставим
 * background-color. Регулярка вставляет дефис перед каждой заглавной буквой
 * и переводит её в нижний регистр.
 *
 * @param key CSS-ключ в camelCase.
 * @returns Ключ в kebab-case.
 */
function camelToKebab(key: string): string {
    return key.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

/**
 * Применяет проп style: принимает строку (как готовый CSS) либо объект
 * с CSS-свойствами в camelCase.
 *
 * При смене формы или содержимого функция полностью переустанавливает атрибут
 * style: точечный diff на этом уровне не нужен, переустановка дешева и не
 * вызывает реакцию браузера сверх минимально необходимой.
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
 * Применяет проп class: принимается только строка либо отсутствие значения.
 *
 * Объектная форма class={{ name: bool }} в этой итерации не поддерживается:
 * по плану Unit 2 (см. файл с планом миграции на JSX) большинство мест в
 * коде пишут готовые строковые литералы из CSS Modules-классов или из BEM.
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
 *
 * При монтировании передаётся сам DOM-элемент, при размонтировании или при
 * смене ref передаётся null, чтобы старый держатель ссылки мог корректно
 * очиститься.
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
 * Применяет одно конкретное (не функциональное) значение пропа к DOM-элементу.
 *
 * Внутренний свитч по известным ключам (class, style) с откатом на setAttribute
 * для остального. on*-обработчики сюда не попадают: их забирает отдельная
 * ветка ещё в applyProp до вызова writeValue.
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
 * Привязывает функциональный (аксессорный) проп к DOM-элементу через effect.
 *
 * Каждый вызов аксессора внутри effect добавляет подписку: при изменении
 * любого из читаемых сигналов effect перезапустится и переустановит атрибут.
 * Через onCleanup текущего owner регистрируется disposer эффекта, чтобы при
 * размонтировании родительского компонента (или ветки Show/For) подписка
 * корректно снялась.
 *
 * Это и есть один из четырёх допустимых способов реактивного выражения в
 * нашем VDOM: проп-значение это функция-аксессор. Голое значение (`value`)
 * один раз выставляется и не обновляется.
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
 * Применяет один проп к DOM-элементу: внутренний свитч по известным ключам
 * (class, style, on*-обработчики) с откатом на setAttribute для остального.
 *
 * Реактивные пропсы. Если значение это функция и при этом имя пропа не
 * описывает обработчик события (не начинается на on*), функция трактуется
 * как аксессор сигнала или computed и её применение оборачивается в effect.
 * Это сознательное решение: компилятора JSX, который бы автоматически
 * оборачивал реактивные выражения, у нас нет, поэтому реактивно ровно
 * то, что пользователь явно передал как функцию-аксессор. Голое выражение
 * `<div class={classes()}>` вычисляется один раз при mount.
 *
 * Алгоритм для on*: при смене ссылки на обработчик старый снимается через
 * removeEventListener, новый вешается через addEventListener; на каждый
 * элемент кладётся одна функция-слушатель на одно имя события.
 *
 * @param el Целевой DOM-элемент.
 * @param name Имя пропа.
 * @param prev Предыдущее значение пропа (или undefined при первичном проставлении).
 * @param next Новое значение пропа (или undefined при удалении).
 */
function applyProp(el: Element, name: string, prev: unknown, next: unknown): void {
    if (prev === next) return;

    /**
     * children это специальный проп: для функциональных компонентов он передаётся
     * как параметр (Show, For, Suspense читают props.children), а на intrinsic-тегах
     * children обрабатывается через VNode.children (массив) и не должен попадать
     * в DOM как HTML-атрибут. Пропускаем тут, чтобы не получить мусорные
     * `children="[object Object]"` на каждом элементе.
     */
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
 * Проставляет все пропсы при первичном монтировании элемента.
 *
 * Эквивалентно patchProps с пустым набором предыдущих значений, но избегает
 * лишних сравнений и удалений: применяется только проход по новым ключам
 * (без шага снятия отсутствующих).
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
 * Согласует пропсы при патче: применяет дифф между prevProps и nextProps.
 *
 * Алгоритм:
 * 1. Проходит по новым пропсам и для каждого ключа вызывает applyProp с
 *    парой (старое, новое).
 * 2. Затем проходит по старым пропсам и для тех ключей, которых нет в
 *    nextProps, вызывает applyProp(old, undefined) для снятия атрибута или
 *    слушателя.
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
 * Снимает все известные ядру слушатели событий с DOM-элемента.
 *
 * Используется при размонтировании, чтобы не оставлять висящих обработчиков
 * на удаляемых из DOM узлах (на случай, если в DOM-узел держится внешняя
 * ссылка).
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
