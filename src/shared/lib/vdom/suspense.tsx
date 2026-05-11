/**
 * Компонент <Suspense>: показывает fallback, пока pending() истина, и children,
 * пока pending() ложь.
 *
 * Структурно повторяет <Show>: anchor-комментарий в родителе, effect, читающий
 * аксессор pending, и пара поддеревьев, которые ленивы и переключаются на лету.
 * Отличается тем, что условие инвертировано (fallback при истине), и
 * предполагается интеграция с роутером в Unit 7: Outlet передаст сюда
 * аксессор pending состояния асинхронной загрузки страницы.
 *
 * Сейчас глобального Suspense-контекста нет: pending всегда передаётся явным
 * пропом. Это позволяет фиксировать локальный pending-источник для каждого
 * Suspense-узла и не делать ошибочных перекрытий по дереву.
 *
 * Дисциплина реактивных выражений. Проп pending ДОЛЖЕН быть функцией-аксессором,
 * иначе условие зафиксируется один раз при mount. Допустимая форма:
 *   <Suspense fallback={<Skeleton/>} pending={() => route().status === 'pending'}>
 *     <Page/>
 *   </Suspense>
 */

import { createOwner, disposeOwner, effect, runWithOwner } from '@shared/lib/signals';
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
 * Приводит сырой VNodeChild к одиночному VNode либо null.
 *
 * Примитивы (строки, числа) и массивы заворачиваются в синтетический Fragment,
 * чтобы mount-логика имела единое представление о ветке.
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
 * Возвращает VNode-маркер DynamicType, чьи props.mount при монтировании заводят
 * anchor-комментарий и effect, который читает pending() и переключает
 * поддерево.
 *
 * @param props Конфигурация: pending, fallback, children.
 * @returns VNode-маркер DynamicType для дальнейшего монтирования ядром.
 */
export function Suspense(props: SuspenseProps): VNode {
    const dynamicProps = {
        mount(parent: Node, anchor: Node | null): { sentinel: Node; dispose: () => void } {
            const suspenseAnchor: Comment = document.createComment('suspense');
            parent.insertBefore(suspenseAnchor, anchor);

            const ownerNode: Owner = createOwner(null);

            let currentVNode: VNode | null = null;
            let currentPending: boolean | null = null;

            const swap = (pending: boolean): void => {
                if (currentVNode) {
                    unmount(currentVNode);
                    currentVNode = null;
                }
                const branch = pending ? props.fallback : props.children;
                const branchNode = toBranchVNode(branch ?? null);
                if (branchNode) {
                    mount(branchNode, parent, suspenseAnchor);
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

            const dispose = (): void => {
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
