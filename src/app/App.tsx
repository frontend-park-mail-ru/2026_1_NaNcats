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

import { AuthLayout, BareLayout, RootLayout } from './layout';

/** Корневой компонент: рендерит RootLayout, AuthLayout или BareLayout по currentLayout. */
export function App(): VNode {
    return (
        <Show when={() => router.currentLayout() === 'bare'} fallback={<RootOrAuthLayout />}>
            <BareLayout />
        </Show>
    ) as VNode;
}

/** Развилка между основным (root) и авторизационным (auth) layout-шеллами. */
function RootOrAuthLayout(): VNode {
    return (
        <Show when={() => router.currentLayout() === 'root'} fallback={<AuthLayout />}>
            <RootLayout />
        </Show>
    ) as VNode;
}
