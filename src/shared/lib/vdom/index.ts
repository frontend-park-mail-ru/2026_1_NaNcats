/**
 * Публичный барель ядра VDOM: всё, чем пользуется внешний код. Внутренние
 * хелперы render/patch наружу не выводятся.
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
