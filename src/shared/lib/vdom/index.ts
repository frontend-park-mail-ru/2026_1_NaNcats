/**
 * Публичный барель ядра VDOM.
 *
 * Здесь собраны все экспорты, которыми пользуется внешний код (в первую
 * очередь jsx-runtime из Unit 5 и реактивные привязки из Unit 4). Внутренние
 * модули (diff-children, отдельные хелперы render/patch) намеренно не
 * экспортируются: точкой входа для них является сама функция patch.
 */

export { DynamicType, Fragment, PortalType, h, normalizeChildren } from './h';
export { render, mount, unmount, mountChild } from './render';
export { patch, isSameVNode, patchText } from './patch';
export { diffChildren } from './diff-children';
export { createPortal } from './portal';
export { patchProps, setProps, applyRef, removeAllListeners } from './props';
export { onMount, onCleanup } from './component';
export { createContext } from './context';
export type { Context, ContextProviderProps } from './context';
export { Show } from './show';
export type { ShowProps } from './show';
export { For } from './for';
export type { ForProps } from './for';
export { Suspense } from './suspense';
export type { SuspenseProps } from './suspense';
export type {
    Component,
    ComponentChildren,
    Key,
    NormalizedChild,
    RawProps,
    Ref,
    RefCallback,
    RefObject,
    VNode,
    VNodeChild,
    VNodeProps,
} from './types';
