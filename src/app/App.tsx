/**
 * Корневой компонент приложения: переключает layout-shell-ы по router.currentLayout.
 *
 * RootLayout и AuthLayout не вложены друг в друга, переход между ними размонтирует
 * один и монтирует другой, что нужно для морфа логотипа через View Transitions API.
 * Условие у `<Show>` обязательно функция, иначе переключение перестанет работать.
 */

import { router } from '@app/router';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { AuthLayout, RootLayout } from './layout';

/** Корневой компонент: рендерит RootLayout или AuthLayout по currentLayout. */
export function App(): VNode {
    return (
        <Show when={() => router.currentLayout() === 'root'} fallback={<AuthLayout />}>
            <RootLayout />
        </Show>
    ) as VNode;
}
