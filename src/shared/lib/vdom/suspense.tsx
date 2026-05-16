/**
 * Компонент <Suspense>: показывает fallback, пока pending() истина, и children,
 * пока pending() ложь. Структурно повторяет <Show> с инвертированным условием;
 * глобального Suspense-контекста нет, pending всегда передаётся пропом.
 *
 * Проп pending должен быть функцией-аксессором, иначе условие зафиксируется
 * при mount:
 *   <Suspense fallback={<Skeleton/>} pending={() => route().status === 'pending'}>
 *     <Page/>
 *   </Suspense>
 */

import { createOwner, disposeOwner, effect, resetOwner, runWithOwner } from '@shared/lib/signals';
import type { Owner } from '@shared/lib/signals';

import { DynamicType, Fragment, normalizeChildren } from './h';
import { mount, unmount } from './render';
import type { VNode, VNodeChild, VNodeProps } from './types';

/**
 * Пропсы компонента Suspense.
 */
export interface SuspenseProps {
    /** Аксессор-функция, чьё текущее значение определяет режим: true это fallback. */
    pending: () => boolean;
    /** Поддерево, показываемое, пока pending() истина (скелетон, спиннер и т.д.). */
    fallback?: VNodeChild;
    /** Поддерево, показываемое, когда pending() ложь (реальное содержимое). */
    children?: VNodeChild;
}

/**
 * Приводит сырой VNodeChild к одиночному VNode либо null. Примитивы и массивы
 * заворачиваются в Fragment.
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
 * Компонент Suspense: переключение между fallback и children по аксессору pending.
 *
 * @param props Конфигурация: pending, fallback, children.
 * @returns VNode-маркер DynamicType для дальнейшего монтирования ядром.
 */
export function Suspense(props: SuspenseProps): VNode {
    const dynamicProps = {
        mount(parent: Node, anchor: Node | null) {
            const suspenseAnchor = document.createComment('suspense');
            parent.insertBefore(suspenseAnchor, anchor);

            const ownerNode = createOwner(null);
            // Owner содержимого ветки, дочерний к ownerNode, а не к owner-у
            // effect-а: перезапуск effect-а (resetOwner) не должен уничтожать
            // реактивные подписки внутри ветки, когда ветка не менялась.
            const branchOwner: Owner = runWithOwner(ownerNode, () => createOwner(null));

            let currentVNode: VNode | null = null;
            let currentPending: boolean | null = null;

            const swap = (pending: boolean) => {
                if (currentVNode) {
                    unmount(currentVNode);
                    currentVNode = null;
                }
                resetOwner(branchOwner);
                const branch = pending ? props.fallback : props.children;
                const branchNode = toBranchVNode(branch ?? null);
                if (branchNode) {
                    runWithOwner(branchOwner, () => mount(branchNode, parent, suspenseAnchor));
                    currentVNode = branchNode;
                }
                currentPending = pending;
            };

            const disposeEffect = runWithOwner(ownerNode, () =>
                effect(() => {
                    const pending = Boolean(props.pending());
                    if (pending === currentPending) return;
                    swap(pending);
                }),
            );

            const dispose = () => {
                disposeEffect();
                if (currentVNode) {
                    unmount(currentVNode);
                    currentVNode = null;
                }
                if (suspenseAnchor.parentNode) {
                    suspenseAnchor.parentNode.removeChild(suspenseAnchor);
                }
                disposeOwner(ownerNode);
            };

            return { sentinel: suspenseAnchor, dispose };
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
