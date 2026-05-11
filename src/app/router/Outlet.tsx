/**
 * Компонент Outlet: точка, в которую layout-shell вставляет текущую страницу.
 *
 * Читает сигнал currentRoute глобального роутера. Пока статус 'pending',
 * показывает универсальный {@link PageLoadingSkeleton}; после ready рендерит
 * компонент страницы с применёнными props. Обёртка через Suspense нужна,
 * чтобы Outlet сам не делал условный рендер: Suspense уже умеет в-месте
 * подменять поддерево по аксессору, и заодно укореняет owner-scope для
 * текущей страницы (onCleanup её эффектов корректно отрабатывает при
 * следующем переходе).
 *
 * Принципиальный момент: pending передаётся в Suspense как аксессор-функция,
 * а не как уже посчитанное boolean. Без этой обёртки реактивная дисциплина
 * нарушится и Suspense зафиксирует первое значение навсегда. См. JSDoc на
 * Suspense.tsx.
 */

import { Suspense } from '@shared/lib/vdom';
import type { Component, VNode, VNodeProps } from '@shared/lib/vdom';
import { PageLoadingSkeleton } from '@shared/ui/skeleton';

import { router } from './index';

/**
 * Рендерит текущую страницу из currentRoute, либо ничего, если статус не 'ready'.
 *
 * Помещается внутрь Suspense: когда pending переключится в false, Suspense
 * заменит fallback на эту ветку, и здесь будет создан VNode-инстанс компонента
 * страницы. На каждом переходе Suspense размонтирует прежнюю ветку и
 * смонтирует новую: компонент страницы получает фрешные props и владеет
 * собственным owner-scope.
 *
 * Если статус 'error' либо route не нашёлся, рендерится пустая заглушка:
 * визуализация ошибки и 404 это ответственность App/layout-shell-а, а не Outlet.
 *
 * @returns VNode с активной страницей либо пустой div.
 */
function ActiveRoute(): VNode {
    const state = router.currentRoute();
    if (state.status !== 'ready' || !state.component) {
        return (<div class="page-empty" />) as VNode;
    }
    const PageComponent: Component<VNodeProps> = state.component;
    const props = (state.props ?? {}) as VNodeProps;
    return (<PageComponent {...props} />) as VNode;
}

/**
 * Компонент Outlet: точка вставки активной страницы в layout-shell.
 *
 * Внутри сразу обёрнут в Suspense с локальным pending-аксессором. App или
 * layout-shell просто пишут `<Outlet/>` в нужном месте; вся переключающая
 * логика остаётся в одном файле.
 *
 * @returns VNode с Suspense, переключающимся между скелетоном и активной страницей.
 */
export function Outlet(): VNode {
    return (
        <Suspense
            pending={() => router.currentRoute().status === 'pending'}
            fallback={<PageLoadingSkeleton />}
        >
            <ActiveRoute />
        </Suspense>
    ) as VNode;
}
