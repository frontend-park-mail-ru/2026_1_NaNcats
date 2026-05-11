/**
 * Реализация контекста для функциональных компонентов.
 *
 * createContext возвращает пару { Provider, use }. Provider это
 * функциональный компонент, который во время выполнения своей функции
 * проталкивает значение в стек, а при размонтировании (через onCleanup
 * текущего owner) снимает его. use() возвращает значение, лежащее на
 * вершине стека, либо defaultValue, если стек пуст.
 *
 * Тонкость рендеринга: Provider это plain-функция, поэтому её тело
 * выполняется при создании VNode-выхода. Это значит, что push в стек
 * происходит до того, как ядро превратит детей в DOM, а pop ставится в
 * cleanup владельца, который держит компонент. Если по какой-то причине
 * use() вызывают вне Provider (например, в верхнеуровневом компоненте),
 * мы возвращаем defaultValue без ошибки: это совпадает с поведением
 * React и SolidJS.
 */

import { onCleanup } from '@shared/lib/signals';

import type { Component, ComponentChildren, VNodeChild } from './types';

/**
 * Пропсы для компонента Provider, который выдаёт createContext.
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
 * Provider оборачивает поддерево и делает value доступным через use().
 * use() читает значение, лежащее на вершине стека, либо defaultValue.
 *
 * @template T Тип хранимого значения контекста.
 */
export interface Context<T> {
    /** Компонент, который вкладывает value в стек контекста для своих детей. */
    Provider: Component<ContextProviderProps<T>>;
    /**
     * Возвращает значение, видимое в текущей точке дерева: ближайший
     * Provider вверх по дереву либо defaultValue, если Provider'а нет.
     */
    use: () => T;
}

/**
 * Создаёт пару { Provider, use } для прокидывания значения по дереву.
 *
 * Provider регистрируется как обычный функциональный компонент: при первом
 * выполнении его тела значение проталкивается в стек контекста, а в
 * onCleanup текущего owner вписывается обратный pop. Дети Provider'а
 * выполняются уже под "поднятым" стеком, поэтому use() в любом из них
 * увидит свежий value. Когда owner Provider'а уничтожается (компонент
 * демонтируется), стек откатывается, и use() вне Provider снова отдаёт
 * defaultValue.
 *
 * Реактивность value: если value это аксессор сигнала, то компоненты-
 * потребители должны вызывать его внутри своих реактивных выражений
 * (например, внутри атрибута или текстового интерполянта). Сам Provider
 * не пересоздаёт стек при изменении value: достаточно, что аксессор
 * всегда лежит на одном и том же месте.
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
