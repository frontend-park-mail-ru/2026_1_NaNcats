/**
 * Компонент <For>: реактивный keyed-список.
 *
 * Поведение. <For each={accessor} key={(item) => K}>{(item, index) => VNode}</For>
 * читает массив через аксессор each, для каждого нового элемента вызывает callback
 * children один раз (на создание), и при изменениях массива применяет keyed-
 * реконсиляцию: переставляет существующие узлы DOM через insertBefore, монтирует
 * новые элементы и размонтирует ушедшие. Callback children по умолчанию не
 * перевызывается для существующего ключа: если поля элемента меняются и должны
 * влиять на DOM, оборачивайте их в сигналы или computed.
 *
 * Дисциплина реактивных выражений. Проп each ДОЛЖЕН быть функцией-аксессором,
 * иначе массив зафиксируется один раз при mount. Допустимые формы:
 *   <For each={items}>{(item) => <Item ... />}</For>
 *   <For each={() => store().items}>{(item) => <Item ... />}</For>
 * НЕдопустимая форма (фиксируется один раз при mount):
 *   <For each={items()}>{(item) => <Item ... />}</For>
 *
 * Per-item owner. На каждый элемент списка заводится отдельный owner-узел
 * реактивного дерева. Любой effect, computed или onCleanup, заведённые внутри
 * children-callback для этого элемента, привязываются к этому owner. Когда
 * элемент уходит из массива по ключу, owner уничтожается каскадом, и все
 * подписки этого элемента корректно снимаются.
 *
 * Ключи. По умолчанию ключом считается сам item: это работает для массивов
 * примитивов (числа, строки, идентификаторы). Для массивов объектов передавайте
 * key={(item) => item.id} явно, иначе keyed-reconcile не сможет различить
 * элементы.
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
    /**
     * Опциональный селектор ключа: уникальный идентификатор элемента в массиве.
     * По умолчанию ключ это сам элемент (работает для массивов примитивов).
     */
    key?: (item: T, index: number) => Key;
    /**
     * Callback построения VNode по элементу. Запускается один раз при первом
     * появлении элемента (по ключу) в массиве. Любые effect/computed/onCleanup
     * внутри callback'а привязываются к per-item owner и снимутся, когда
     * элемент покинет массив.
     */
    children: (item: T, index: number) => VNodeChild;
}

/**
 * Преобразует сырой результат children-callback в одиночный VNode.
 *
 * Примитивы и массивы заворачиваются в синтетический Fragment, чтобы у каждого
 * элемента списка была единая корневая ссылка VNode для unmount и для
 * вычисления его DOM-узлов через flatDom.
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
    /** Уникальный ключ элемента, по которому идёт keyed-reconcile. */
    key: Key;
    /** Снимок элемента, который сейчас в массиве (обновляется при каждом проходе). */
    item: T;
    /** VNode, построенный children-callback для этого элемента. */
    vnode: VNode;
    /** Per-item owner, под которым заведены реактивные ресурсы children. */
    owner: Owner;
}

/**
 * Компонент For: реактивный keyed-список.
 *
 * Возвращает VNode-маркер DynamicType, чьи props.mount заводят anchor-комментарий
 * и effect, который читает массив через each() и применяет ручную keyed-реконсиляцию
 * над текущим набором смонтированных элементов. Узлы существующих элементов
 * переставляются insertBefore без повторного вызова children, чтобы их
 * внутренние signal-привязки оставались живыми.
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

                    // Сначала сносим ушедшие элементы: высвобождаем DOM и
                    // per-item owner. Делается до перестановок, чтобы их узлы
                    // не оказались в неверной позиции при insertBefore.
                    for (const removed of oldByKey.values()) {
                        unmount(removed.vnode);
                        disposeOwner(removed.owner);
                    }

                    // Расставляем сохранившиеся и новые элементы в обратном
                    // порядке. Якорь для очередного элемента это либо первый
                    // DOM-узел уже расставленного следующего соседа, либо
                    // forAnchor (комментарий, помечающий конец списка). Идём
                    // справа налево, чтобы цепочка якорей строилась
                    // консистентно.
                    let cursorAnchor: Node | null = forAnchor;
                    for (let i = nextEntries.length - 1; i >= 0; i -= 1) {
                        const entry = nextEntries[i];
                        const dom = entry.vnode.__dom;
                        if (dom === null) {
                            // Новый элемент: монтируем перед текущим cursorAnchor.
                            // Mount запустим под owner элемента, чтобы вложенные
                            // function-component effect'ы привязались к нему.
                            runWithOwner(entry.owner, () => mount(entry.vnode, parent, cursorAnchor));
                        } else {
                            // Уже смонтированный элемент: при необходимости
                            // двигаем его DOM-узлы перед cursorAnchor через
                            // insertBefore. Если первый узел уже на месте,
                            // не трогаем (insertBefore самого себя в ту же
                            // позицию неявно no-op, но проверка дешевле).
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
