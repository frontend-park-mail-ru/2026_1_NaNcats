/**
 * Компонент <Show>: ленивое условное переключение поддерева.
 *
 * Поведение. <Show when={accessor} fallback={vnode}>{vnode}</Show> подписывается
 * на аксессор when через effect; пока when() истина, в DOM висят children, как
 * только when() ложь, дети отмонтируются и вместо них монтируется fallback (если
 * задан). Каждая ветка лениво построится только при первом входе в неё.
 *
 * Дисциплина реактивных выражений. Проп when ДОЛЖЕН быть функцией-аксессором,
 * а не уже-вычисленным значением: иначе условие зафиксируется один раз при
 * mount и переключение перестанет работать. Это специфика VDOM без compile-
 * time-перезаписи JSX: реактивно ровно то, что является функцией. Допустимые
 * формы:
 *   <Show when={isActive}>...</Show>
 *   <Show when={() => count() > 0}>...</Show>
 * НЕдопустимая форма (фиксируется один раз при mount):
 *   <Show when={isActive()}>...</Show>
 *
 * Реализация. Show отдаёт ядру VNode-маркер DynamicType c заранее заданной
 * парой mount/disposer. Внутри mount мы кладём comment-anchor в DOM и
 * заводим effect, который читает when() и переключает поддерево. Все
 * собственные ресурсы (effect, child-VNode, anchor) убираются disposer'ом,
 * который ядро вызовет при unmount узла-Show.
 */

import { createOwner, disposeOwner, effect, runWithOwner } from '@shared/lib/signals';
import type { Owner } from '@shared/lib/signals';

import { DynamicType, Fragment, normalizeChildren } from './h';
import { mount, unmount } from './render';
import type { VNode, VNodeChild, VNodeProps } from './types';

/**
 * Пропсы компонента Show.
 *
 * @template T Тип значения, возвращаемого аксессором when. На условие
 *             проверяется через truthy-семантику JS.
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
 * Приводит сырой VNodeChild к одиночному VNode либо null. null означает,
 * что для текущей ветки ничего рисовать не надо.
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
 * Компонент Show: ленивое условное переключение поддерева.
 *
 * Возвращает VNode-маркер DynamicType, чьи props.mount при монтировании
 * заводят anchor-комментарий и effect, который переключает дочернее
 * поддерево в зависимости от when().
 *
 * @template T Тип значения аксессора when.
 * @param props Конфигурация показа: when, fallback, children.
 * @returns VNode-маркер DynamicType для дальнейшего монтирования ядром.
 */
export function Show<T = unknown>(props: ShowProps<T>): VNode {
    const dynamicProps = {
        mount(parent: Node, anchor: Node | null): { sentinel: Node; dispose: () => void } {
            const showAnchor: Comment = document.createComment('show');
            parent.insertBefore(showAnchor, anchor);

            const ownerNode: Owner = createOwner(null);

            let currentVNode: VNode | null = null;
            let currentBranchTruthy: boolean | null = null;

            const swap = (truthy: boolean): void => {
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

            const dispose = (): void => {
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
