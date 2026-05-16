/**
 * Контекст для функциональных компонентов: createContext возвращает пару
 * { Provider, use }. Provider при выполнении тела проталкивает значение в
 * стек, а при размонтировании снимает его; use() читает значение с вершины
 * стека либо defaultValue, если стек пуст.
 */

import { onCleanup } from '@shared/lib/signals';

import type { Component, ComponentChildren, VNodeChild } from './types';

/**
 * Пропсы компонента Provider.
 *
 * @template T Тип хранимого значения контекста.
 */
export interface ContextProviderProps<T> {
    /** Значение, которое будет видно потомкам через use(). */
    value: T;
    /** Дети, которым станет доступен value. */
    children?: ComponentChildren;
}

/**
 * Пара { Provider, use }, которую возвращает createContext.
 *
 * @template T Тип хранимого значения контекста.
 */
export interface Context<T> {
    /** Компонент, который вкладывает value в стек контекста для своих детей. */
    Provider: Component<ContextProviderProps<T>>;
    /** Возвращает значение ближайшего Provider вверх по дереву либо defaultValue. */
    use: () => T;
}

/**
 * Создаёт пару { Provider, use } для прокидывания значения по дереву.
 *
 * Если value это аксессор сигнала, потребители должны вызывать его внутри
 * своих реактивных выражений: сам Provider при изменении value стек не
 * пересоздаёт.
 *
 * @template T Тип хранимого значения контекста.
 * @param defaultValue Значение, которое вернёт use вне любого Provider.
 * @returns Объект { Provider, use } для использования в JSX.
 */
export function createContext<T>(defaultValue: T): Context<T> {
    const stack: T[] = [];

    const Provider: Component<ContextProviderProps<T>> = (props) => {
        stack.push(props.value);
        onCleanup(() => {
            const idx = stack.lastIndexOf(props.value);
            if (idx !== -1) {
                stack.splice(idx, 1);
            }
        });
        return <>{props.children as VNodeChild}</>;
    };

    function use(): T {
        if (stack.length === 0) {
            return defaultValue;
        }
        return stack[stack.length - 1];
    }

    return { Provider, use };
}
