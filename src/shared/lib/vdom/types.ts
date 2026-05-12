/**
 * Ядро типов VDOM: форма VNode, виды детей, ссылки на DOM и контракт
 * функционального компонента. Только декларации, без реализации.
 */

/**
 * Колбэк-ссылка: получает смонтированный DOM-узел или null при размонтировании.
 *
 * @template T Тип целевого DOM-узла, который удерживает ссылка.
 */
export type RefCallback<T> = (el: T | null) => void;

/**
 * Объектная ссылка с полем current: заполняется при монтировании, зануляется
 * при размонтировании.
 *
 * @template T Тип целевого DOM-узла, который удерживает ссылка.
 */
export interface RefObject<T> {
    current: T | null;
}

/**
 * Объединённая форма ссылки на DOM-узел: либо колбэк, либо объект с current.
 *
 * @template T Тип целевого DOM-узла, который удерживает ссылка.
 */
export type Ref<T> = RefCallback<T> | RefObject<T>;

/** Значение ключа дочернего VNode для keyed-diff в diff-children. */
export type Key = string | number;

/**
 * Сырые формы, которые фабрика h принимает в качестве ребёнка: VNode, строка
 * или число (станет Text-узлом), null/undefined/false/true (игнорируется при
 * нормализации) или вложенный массив.
 */
export type VNodeChild =
    | VNode
    | string
    | number
    | boolean
    | null
    | undefined
    | VNodeChild[];

/** Псевдоним для пропа children (по форме совпадает с VNodeChild). */
export type ComponentChildren = VNodeChild;

/**
 * Нормализованный ребёнок после прохода через h: VNode или примитив. Примитивы
 * не оборачиваются в текстовые VNode; текстовые DOM-узлы создаются на стадии
 * render/patch.
 */
export type NormalizedChild = VNode | string | number;

/**
 * Сырые пропсы на входе h: произвольная карта плюс поля key, ref, children.
 * После прохода через h key и ref выносятся на уровень VNode, children
 * нормализуется в массив; в VNode.props эти поля не попадают.
 */
export interface RawProps {
    key?: Key;
    ref?: Ref<Element>;
    children?: ComponentChildren;
    [prop: string]: unknown;
}

/**
 * Карта пропсов внутри VNode: без key, ref, children. Открытая карта со
 * значением unknown; известные ключи (class, style, on*) разбирает props.ts.
 */
export type VNodeProps = Readonly<Record<string, unknown>>;

/**
 * Дескриптор виртуального узла. Поля __dom и __instance внутренние:
 * выставляются ядром при монтировании и патче, пользовательский код их не
 * трогает.
 */
export interface VNode<P extends VNodeProps = VNodeProps> {
    /** Тип узла: имя HTML-тега, функция-компонент или маркер-символ (Fragment, портал). */
    type: string | symbol | Component<P>;
    /** Пропсы без служебных полей key, ref и children. */
    props: P;
    /** Нормализованный массив детей: VNode либо примитив (string/number). */
    children: NormalizedChild[];
    /** Ключ для согласования списков; отсутствует для не-ключевых узлов. */
    key?: Key;
    /** Ссылка на DOM, заполняется при монтировании. */
    ref?: Ref<Element>;
    /**
     * Связанный DOM-узел: для тега-строки Element, для Fragment/компонента
     * массив верхнеуровневых узлов поддерева, для портала пустой массив.
     * У текстовых детей-примитивов отдельного VNode нет.
     */
    __dom?: Node | Node[] | null;
    /**
     * Внутреннее поддерево, в которое раскрылся функциональный компонент или
     * портал. При стабильном type+key ядро патчит его, не пересоздавая внешний
     * VNode.
     */
    __instance?: VNode | null;
}

/**
 * Функциональный компонент: чистая функция, принимающая пропсы и возвращающая
 * VNode (или примитив, либо null/false для пустого рендера). P ограничен
 * object, а не VNodeProps, чтобы в сигнатуре компонента было удобно описывать
 * пропсы интерфейсом с конкретными полями.
 *
 * @template P Тип пропсов компонента.
 */
export type Component<P extends object = VNodeProps> = (props: P) => VNode;
