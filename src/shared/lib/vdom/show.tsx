/**
 * Компонент <Show>: ленивое условное переключение поддерева.
 *
 * <Show when={accessor} fallback={vnode}>{vnode}</Show> подписывается на
 * аксессор when через effect: пока when() истина, в DOM висят children, иначе
 * монтируется fallback (если задан). Каждая ветка строится лениво при первом
 * входе.
 *
 * Проп when должен быть функцией-аксессором, иначе условие зафиксируется при
 * mount: <Show when={isActive}> или <Show when={() => count() > 0}>, но не
 * <Show when={isActive()}>.
 */

import { createOwner, disposeOwner, effect, runWithOwner } from '@shared/lib/signals';

import { DynamicType, Fragment, normalizeChildren } from './h';
import { mount, unmount } from './render';
import type { VNode, VNodeChild, VNodeProps } from './types';

/**
 * Пропсы компонента Show.
 *
 * @template T Тип значения аксессора when (проверяется на truthy).
 */
export interface ShowProps<T = unknown> {
    /** Аксессор-функция, чьё текущее значение определяет, какую ветку показать. */
    when: () => T;
    /** Поддерево, которое показывается, когда when() ложь. */
    fallback?: VNodeChild;
    /** Поддерево, которое показывается, когда when() истина. */
    children?: VNodeChild;
}

/**
 * Приводит сырой VNodeChild к одиночному VNode либо null (ничего не рисуем).
 * Примитивы и массивы заворачиваются в Fragment.
 *
 * @param raw Сырое содержимое ветки (children или fallback).
 * @returns VNode для монтирования либо null, если ветка пустая.
 */
function toBranchVNode(raw: VNodeChild): VNode | null {
    if (raw === null || raw === undefined || raw === false || raw === true) {
        return null;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
        return {
            type: Fragment,
            props: {} as VNodeProps,
            children: [raw],
            __dom: null,
            __instance: null,
        };
    }
    if (Array.isArray(raw)) {
        return {
            type: Fragment,
            props: {} as VNodeProps,
            children: normalizeChildren(raw),
            __dom: null,
            __instance: null,
        };
    }
    return raw;
}

/**
 * Компонент Show: ленивое условное переключение поддерева.
 *
 * @template T Тип значения аксессора when.
 * @param props Конфигурация показа: when, fallback, children.
 * @returns VNode-маркер DynamicType для дальнейшего монтирования ядром.
 */
export function Show<T = unknown>(props: ShowProps<T>): VNode {
    const dynamicProps = {
        mount(parent: Node, anchor: Node | null) {
            const showAnchor = document.createComment('show');
            parent.insertBefore(showAnchor, anchor);

            const ownerNode = createOwner(null);

            let currentVNode: VNode | null = null;
            let currentBranchTruthy: boolean | null = null;

            const swap = (truthy: boolean) => {
                if (currentVNode) {
                    unmount(currentVNode);
                    currentVNode = null;
                }
                const branch = truthy ? props.children : props.fallback;
                const branchNode = toBranchVNode(branch ?? null);
                if (branchNode) {
                    mount(branchNode, parent, showAnchor);
                    currentVNode = branchNode;
                }
                currentBranchTruthy = truthy;
            };

            const disposeEffect = runWithOwner(ownerNode, () =>
                effect(() => {
                    const truthy = Boolean(props.when());
                    if (truthy === currentBranchTruthy) return;
                    swap(truthy);
                }),
            );

            const dispose = () => {
                disposeEffect();
                if (currentVNode) {
                    unmount(currentVNode);
                    currentVNode = null;
                }
                if (showAnchor.parentNode) {
                    showAnchor.parentNode.removeChild(showAnchor);
                }
                disposeOwner(ownerNode);
            };

            return { sentinel: showAnchor, dispose };
        },
    };

    return {
        type: DynamicType,
        props: dynamicProps as unknown as VNodeProps,
        children: [],
        __dom: null,
        __instance: null,
    };
}
