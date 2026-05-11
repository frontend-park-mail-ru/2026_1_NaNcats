/**
 * Корневой компонент приложения: переключатель peer-layout-shell-ов.
 *
 * App монтируется один раз в `#root` и подписывается на router.currentLayout
 * через `<Show>`. Когда currentLayout равен 'root', активен RootLayout;
 * иначе (значение 'auth') активен AuthLayout. Эти shell-ы являются peer-ами,
 * не вложены друг в друга: переход между ними размонтирует один и монтирует
 * другой, что и есть нужное поведение для shared-element-морфа логотипа
 * через View Transitions API.
 *
 * Реактивная дисциплина. Аксессор-условие у `<Show>` обязательно функция
 * `() => router.currentLayout() === 'root'`: голое выражение в JSX
 * `when={router.currentLayout() === 'root'}` зафиксирует значение один раз
 * при mount, и переключение перестанет работать. См. JSDoc на Show.tsx.
 */

import { router } from '@app/router';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { AuthLayout, RootLayout } from './layout';

/**
 * Компонент App: вершина дерева приложения.
 *
 * Возвращает Show, переключающий peer-layout-shell-ы по сигналу
 * router.currentLayout. Никакой собственной разметки выше этого Show нет:
 * `<div id="modal-root"/>` живёт внутри активного shell-а, а не на уровне App.
 *
 * @returns VNode со Show, переключающимся между RootLayout и AuthLayout.
 */
export function App(): VNode {
    return (
        <Show when={() => router.currentLayout() === 'root'} fallback={<AuthLayout />}>
            <RootLayout />
        </Show>
    ) as VNode;
}
