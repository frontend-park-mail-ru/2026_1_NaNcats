/**
 * Сигнальный клиентский роутер.
 *
 * Публикует два сигнала, на которые реагируют Outlet и App:
 *  - currentRoute: состояние перехода (pending/ready/error, params, query, дескриптор, props);
 *  - currentLayout: идентификатор активного layout-shell-а, меняется только при переходе
 *    между peer-layouts (root <-> auth).
 *
 * go(path): pushState -> currentRoute в pending -> параллельно import компонента и loader
 * через Promise.all -> после resolve внутри startViewTransition синхронно меняем
 * currentLayout (если другой) и currentRoute (ready), чтобы View Transitions API
 * успел снять snapshot. Document-level click handler не регистрируется: переходы
 * инициирует компонент Link.
 */

import { signal } from '@shared/lib/signals';
import type { Signal } from '@shared/lib/signals';
import type { Component, VNodeProps } from '@shared/lib/vdom';
import { startViewTransition } from '@shared/lib/transitions';

import { matchPath } from './matchPath';
import type { RouteDescriptor, LayoutKind, ComponentChunk } from './routes';

/** Стадия асинхронной загрузки роута: 'pending' (идёт import/loader), 'ready' (готово), 'error'. */
export type RouteStatus = 'pending' | 'ready' | 'error';

/**
 * Снимок текущего состояния роутера.
 *
 * component и props заполняются только в статусе 'ready', error только в 'error'.
 * Open-форма (не дискриминированный union): потребители сначала проверяют status.
 */
export interface RouteState {
    /** Стадия загрузки. */
    status: RouteStatus;
    /** Полный путь перехода, включая query (например, '/restaurant?id=1'). */
    path: string;
    /** Параметры пути из динамических сегментов; сейчас всегда пусто. */
    params: Record<string, string>;
    /** Разобранные ключ-значения из query-строки. */
    query: Record<string, string>;
    /** Найденный дескриптор; undefined, если matchPath не нашёл совпадений. */
    route?: RouteDescriptor;
    /** Готовый компонент страницы (выставляется только в статусе 'ready'). */
    component?: Component<VNodeProps>;
    /** Результат loader (выставляется только в статусе 'ready'). */
    props?: unknown;
    /** Причина ошибки (выставляется только в статусе 'error'). */
    error?: unknown;
}

/**
 * Сигнальный роутер.
 *
 * Конструктор принимает таблицу роутов и инициализирует currentRoute начальным
 * pending-состоянием с текущим URL. Загрузка стартует только при вызове start():
 * это даёт App-у возможность сначала смонтировать shell.
 */
export class Router {
    /** Реактивный снимок текущего перехода; читается Outlet-ом и пр. */
    readonly currentRoute: Signal<RouteState>;

    /** Реактивный идентификатор активного layout-shell-а. */
    readonly currentLayout: Signal<LayoutKind>;

    /** Таблица роутов; задаётся через register или конструктор. */
    private routes: readonly RouteDescriptor[] = [];

    /**
     * Создаёт роутер с начальным pending-стейтом и подписывается на popstate.
     *
     * popstate подключается сразу: пользователь может нажать "назад" в любой момент
     * после первой отрисовки.
     *
     * @param routes Начальная таблица роутов; можно дополнить через register.
     */
    constructor(routes: readonly RouteDescriptor[] = []) {
        this.routes = routes;

        const initialPath = window.location.pathname + window.location.search;
        const { route, params, query } = matchPath(initialPath, this.routes);

        this.currentRoute = signal<RouteState>({
            status: 'pending',
            path: initialPath,
            params,
            query,
            route,
        });
        this.currentLayout = signal<LayoutKind>(route?.layout ?? 'root');

        window.addEventListener('popstate', this.handlePopState);
    }

    /**
     * Регистрирует таблицу роутов, полностью заменяя прежний список.
     *
     * Сигналы при этом не пересчитываются: первый go/start подхватит новую таблицу.
     *
     * @param routes Новая таблица роутов в порядке приоритета.
     */
    register(routes: readonly RouteDescriptor[]): void {
        this.routes = routes;
    }

    /**
     * Запускает первый переход по текущему URL. Вызывается один раз после монтирования shell-а.
     *
     * Делает то же, что go(path), но без pushState: запись в history уже есть.
     *
     * @returns Промис, разрешающийся после коммита первого роута.
     */
    start(): Promise<void> {
        const initialPath = window.location.pathname + window.location.search;
        return this.navigate(initialPath, false);
    }

    /**
     * Программный переход на новый URL.
     *
     * pushState, затем стандартный жизненный цикл загрузки. Если путь совпадает с
     * текущим, переход всё равно выполнится; дедупликацию оставляем вызывающему коду.
     *
     * @param path Целевой путь (с query-частью или без).
     * @returns Промис, разрешающийся после коммита (или после обработки ошибки).
     */
    go(path: string): Promise<void> {
        return this.navigate(path, true);
    }

    /** Обрабатывает popstate (кнопки браузера "назад"/"вперёд"): то же, что go, но без pushState. */
    private handlePopState = () => {
        const path = window.location.pathname + window.location.search;
        void this.navigate(path, false);
    };

    /** Снимает системные обработчики, привязанные роутером к окну (нужно для тестов и hot-reload). */
    dispose(): void {
        window.removeEventListener('popstate', this.handlePopState);
    }

    /**
     * Внутренняя точка перехода: общая логика go и popstate.
     *
     * pushState (если push) -> matchPath -> currentRoute в pending -> параллельно
     * import и loader -> внутри startViewTransition синхронно меняем currentLayout
     * (если другой) и currentRoute (ready); оба set обязаны быть в одном callback.
     * Ошибка loader или import переводит currentRoute в 'error'; View Transitions
     * для ошибочного перехода не запускается.
     *
     * @param path Целевой путь с query.
     * @param push Нужно ли добавить запись в history (true для go, false для popstate/start).
     * @returns Промис, разрешающийся после коммита состояния (ready или error).
     */
    private async navigate(path: string, push: boolean): Promise<void> {
        if (push) {
            window.history.pushState(null, '', path);
        }

        const { route, params, query } = matchPath(path, this.routes);

        this.currentRoute.set({
            status: 'pending',
            path,
            params,
            query,
            route,
        });

        if (!route) {
            // Соответствия нет: оставляем pending, чтобы вызывающий слой решил,
            // как обработать промах (редирект на /404 или заглушка в Outlet).
            return;
        }

        try {
            const [mod, props] = await Promise.all([route.component(), route.loader?.()]);
            const component = extractComponent(mod);

            if (!component) {
                throw new Error(
                    `router: чанк по пути "${path}" не содержит ни default-, ни именованного экспорта компонента`,
                );
            }

            const nextLayout: LayoutKind = route.layout ?? 'root';
            const nextState: RouteState = {
                status: 'ready',
                path,
                params,
                query,
                route,
                component,
                props,
            };

            startViewTransition(() => {
                if (this.currentLayout.peek() !== nextLayout) {
                    this.currentLayout.set(nextLayout);
                }
                this.currentRoute.set(nextState);
            });
        } catch (error) {
            this.currentRoute.set({
                status: 'error',
                path,
                params,
                query,
                route,
                error,
            });
        }
    }
}

/**
 * Достаёт компонент из модуля-чанка страницы.
 *
 * Поддерживает default-экспорт и первый именованный экспорт-функцию. Если ничего
 * не нашлось, возвращает null: вызывающий слой выбросит понятную ошибку.
 *
 * @param mod Распакованный модуль чанка (результат await import).
 * @returns Найденный компонент или null.
 */
function extractComponent(mod: ComponentChunk) {
    if (typeof mod.default === 'function') {
        return mod.default;
    }
    for (const key of Object.keys(mod)) {
        const value = mod[key];
        if (typeof value === 'function') {
            return value;
        }
    }
    return null;
}
