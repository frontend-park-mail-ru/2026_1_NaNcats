/**
 * Компонент <For>: реактивный keyed-список.
 *
 * Читает массив через аксессор each, для каждого нового элемента один раз
 * вызывает children-callback, при изменениях массива применяет keyed-
 * реконсиляцию: переставляет существующие узлы через insertBefore, монтирует
 * новые и размонтирует ушедшие. Callback не перевызывается для существующего
 * ключа: меняющиеся поля элемента оборачивайте в сигналы или computed.
 *
 * Проп each должен быть функцией-аксессором, иначе массив зафиксируется при
 * mount: <For each={items}> или <For each={() => store().items}>, но не
 * <For each={items()}>.
 *
 * На каждый элемент заводится свой owner: effect/computed/onCleanup внутри
 * children-callback привязываются к нему и снимаются, когда элемент уходит из
 * массива по ключу. По умолчанию ключ это сам item (работает для массивов
 * примитивов); для массивов объектов передавайте key={(item) => item.id}.
 */

import { createOwner, disposeOwner, effect, runWithOwner } from '@shared/lib/signals';
import type { Owner } from '@shared/lib/signals';

import { DynamicType, Fragment, normalizeChildren } from './h';
import { flatDom, mount, unmount } from './render';
import type { Key, VNode, VNodeChild, VNodeProps } from './types';

/**
 * Пропсы компонента For.
 *
 * @template T Тип одного элемента массива each.
 */
export interface ForProps<T> {
    /** Аксессор-функция, возвращающая текущий массив элементов. */
    each: () => readonly T[];
    /** Селектор ключа; по умолчанию ключ это сам элемент. */
    key?: (item: T, index: number) => Key;
    /**
     * Callback построения VNode по элементу. Запускается один раз при первом
     * появлении элемента (по ключу); effect/computed/onCleanup внутри него
     * привязываются к owner элемента.
     */
    children: (item: T, index: number) => VNodeChild;
}

/**
 * Преобразует сырой результат children-callback в одиночный VNode: примитивы и
 * массивы заворачиваются в Fragment, чтобы у элемента была единая корневая
 * ссылка для unmount и flatDom.
 *
 * @param raw Сырой результат callback (VNode, примитив, массив или null).
 * @returns VNode для монтирования либо null, если ветка пустая.
 */
function toItemVNode(raw: VNodeChild): VNode | null {
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
 * Запись об одном элементе списка: его ключ, текущий VNode и собственный owner.
 *
 * @template T Тип элемента массива each.
 */
interface ForEntry<T> {
    /** Ключ элемента, по которому идёт keyed-reconcile. */
    key: Key;
    /** Снимок элемента, который сейчас в массиве. */
    item: T;
    /** VNode, построенный children-callback для этого элемента. */
    vnode: VNode;
    /** Owner элемента, под которым заведены реактивные ресурсы children. */
    owner: Owner;
}

/**
 * Компонент For: реактивный keyed-список.
 *
 * @template T Тип одного элемента массива each.
 * @param props Конфигурация списка: each, key, children-callback.
 * @returns VNode-маркер DynamicType для дальнейшего монтирования ядром.
 */
export function For<T>(props: ForProps<T>): VNode {
    const dynamicProps = {
        mount(parent: Node, anchor: Node | null): { sentinel: Node; dispose: () => void } {
            const forAnchor: Comment = document.createComment('for');
            parent.insertBefore(forAnchor, anchor);

            const outerOwner: Owner = createOwner(null);

            let entries: Array<ForEntry<T>> = [];

            const buildEntry = (item: T, index: number, key: Key): ForEntry<T> | null => {
                const itemOwner = createOwner(null);
                let raw: VNodeChild;
                try {
                    raw = runWithOwner(itemOwner, () => props.children(item, index));
                } catch (err) {
                    console.error('[vdom] <For> children callback throw:', err);
                    disposeOwner(itemOwner);
                    return null;
                }
                const vnode = toItemVNode(raw);
                if (!vnode) {
                    disposeOwner(itemOwner);
                    return null;
                }
                return { key, item, vnode, owner: itemOwner };
            };

            const disposeEffect = runWithOwner(outerOwner, () =>
                effect(() => {
                    const items = props.each();
                    const keyFn = props.key ?? ((it: T): Key => it as unknown as Key);

                    const oldByKey: Map<Key, ForEntry<T>> = new Map();
                    for (const entry of entries) {
                        oldByKey.set(entry.key, entry);
                    }

                    const nextEntries: Array<ForEntry<T>> = [];

                    for (let i = 0; i < items.length; i += 1) {
                        const item = items[i];
                        const key = keyFn(item, i);
                        const existing = oldByKey.get(key);
                        if (existing) {
                            oldByKey.delete(key);
                            existing.item = item;
                            nextEntries.push(existing);
                            continue;
                        }
                        const fresh = buildEntry(item, i, key);
                        if (fresh) nextEntries.push(fresh);
                    }

                    // Сначала сносим ушедшие элементы (до перестановок, чтобы
                    // их узлы не оказались в неверной позиции при insertBefore).
                    for (const removed of oldByKey.values()) {
                        unmount(removed.vnode);
                        disposeOwner(removed.owner);
                    }

                    // Расставляем сохранившиеся и новые элементы справа налево.
                    // Якорь для очередного элемента это первый DOM-узел уже
                    // расставленного следующего соседа либо forAnchor (конец списка).
                    let cursorAnchor: Node | null = forAnchor;
                    for (let i = nextEntries.length - 1; i >= 0; i -= 1) {
                        const entry = nextEntries[i];
                        const dom = entry.vnode.__dom;
                        if (dom === null) {
                            // Новый элемент: монтируем под owner элемента, чтобы
                            // вложенные function-component effect'ы привязались к нему.
                            runWithOwner(entry.owner, () => mount(entry.vnode, parent, cursorAnchor));
                        } else {
                            // Уже смонтированный: при необходимости двигаем его
                            // DOM-узлы перед cursorAnchor.
                            const nodes = flatDom(entry.vnode);
                            if (nodes.length > 0) {
                                const first = nodes[0];
                                if (first !== cursorAnchor && first.nextSibling !== cursorAnchor) {
                                    for (const node of nodes) {
                                        parent.insertBefore(node, cursorAnchor);
                                    }
                                }
                            }
                        }
                        const updatedDom = flatDom(entry.vnode);
                        if (updatedDom.length > 0) {
                            cursorAnchor = updatedDom[0];
                        }
                    }

                    entries = nextEntries;
                }),
            );

            const dispose = (): void => {
                disposeEffect();
                for (const entry of entries) {
                    unmount(entry.vnode);
                    disposeOwner(entry.owner);
                }
                entries = [];
                if (forAnchor.parentNode) {
                    forAnchor.parentNode.removeChild(forAnchor);
                }
                disposeOwner(outerOwner);
            };

            return { sentinel: forAnchor, dispose };
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
