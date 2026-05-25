/**
 * Компонент Outlet: точка, в которую layout-shell вставляет текущую страницу.
 *
 * Читает сигнал currentRoute. При статусе 'pending' показывает PageLoadingSkeleton,
 * при 'ready' рендерит компонент страницы с props. Обёрнут в Suspense, чтобы тот
 * сам подменял поддерево и укоренял owner-scope страницы. pending передаётся в
 * Suspense аксессором-функцией, иначе он зафиксирует первое значение навсегда.
 */

import { Suspense } from '@shared/lib/vdom';
import type { VNode, VNodeProps } from '@shared/lib/vdom';
import { PageLoadingSkeleton } from '@shared/ui/skeleton';

import { router } from './index';

/** Рендерит текущую страницу из currentRoute; при не-'ready' статусе или промахе route отдаёт пустой div. */
function ActiveRoute() {
    const state = router.currentRoute();
    if (state.status !== 'ready' || !state.component) {
        return (<div class="page-empty" />) as VNode;
    }
    const PageComponent = state.component;
    const props = (state.props ?? {}) as VNodeProps;
    return (<PageComponent {...props} />) as VNode;
}

/**
 * Pending-плейсхолдер. Suspense вызывает функцию-фолбэк при каждом изменении
 * статуса, поэтому скелетон зависит от текущего матча: для /profile — профильный,
 * для /restaurant — ресторанный и т.д. Если матча нет — общий PageLoadingSkeleton.
 */
function PendingFallback(): VNode {
    const state = router.currentRoute();
    const skel = state.route?.skeleton;
    return (skel ? skel() : <PageLoadingSkeleton />) as VNode;
}

export function Outlet(): VNode {
    return (
        <Suspense pending={() => router.currentRoute().status === 'pending'} fallback={<PendingFallback />}>
            <ActiveRoute />
        </Suspense>
    ) as VNode;
}
