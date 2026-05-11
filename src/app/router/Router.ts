/**
 * Сигнальный клиентский роутер.
 *
 * Заменяет прежнюю class-based реализацию на сигнальную: вместо ручного
 * destroy/mount при каждом переходе роутер публикует два сигнала, а Outlet и
 * App уже сами реагируют на их изменения через VDOM-патч. Это даёт persistent
 * layout (Header не моргает между переходами внутри одного shell-а), валидный
 * Suspense-режим (Outlet видит pending до и после загрузки), и аккуратную
 * точку для запуска View Transitions API.
 *
 * Сигналы роутера:
 *  - currentRoute: полное состояние перехода (pending/ready/error, разобранные
 *    параметры, ссылка на найденный дескриптор, готовые props).
 *  - currentLayout: идентификатор активного layout-shell-а; меняется только
 *    при переходе между peer-layouts (root <-> auth).
 *
 * Жизненный цикл go(path):
 *  1. history.pushState с переданным path.
 *  2. currentRoute переключается в pending, чтобы Outlet немедленно показал
 *     скелетон (Header при этом не размонтируется).
 *  3. Параллельно запускаются dynamic-import компонента и loader. Дожидаемся
 *     обоих через Promise.all.
 *  4. Только после resolve вызывается startViewTransition: внутри его callback
 *     синхронно меняются currentLayout (если другой) и currentRoute (ready).
 *     Атомарный коммит позволяет View Transitions API корректно снять snapshot
 *     целевого DOM.
 *
 * Document-level click handler намеренно не регистрируется: переходы
 * инициирует компонент Link через свой onClick. Снимается зависимость от
 * CSS-класса .router-link и упрощается тестирование (event-bubbling из jsdom
 * не требуется).
 */

import { signal } from '@shared/lib/signals';
import type { Signal } from '@shared/lib/signals';
import type { Component, VNodeProps } from '@shared/lib/vdom';
import { startViewTransition } from '@shared/lib/transitions';

import { matchPath } from './matchPath';
import type { RouteDescriptor, LayoutKind, ComponentChunk } from './routes';

/**
 * Состояние асинхронной загрузки роута.
 *
 * - 'pending': роутер начал переход, компонент или loader ещё в процессе.
 * - 'ready': оба await-а завершились, props и компонент готовы к отрисовке.
 * - 'error': loader или dynamic-import выбросили ошибку; поле error содержит
 *   причину, props/component не выставляются.
 */
export type RouteStatus = 'pending' | 'ready' | 'error';

/**
 * Снимок текущего состояния роутера.
 *
 * Все поля кроме status описывают целевой переход. component и props
 * заполняются только в статусе 'ready'; error только в 'error'. Это
 * сознательная open-форма (без дискриминированного union): Outlet и
 * остальные потребители всегда сначала проверяют status, и компилятор
 * заставляет это делать через optional-поля.
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
 * pending-состоянием с текущим URL. Реальная загрузка стартует, только когда
 * вызывающий код позовёт start(): это даёт App-у возможность сначала смонтировать
 * shell, а уже потом начать первый переход. Такой порядок исключает гонку, при
 * которой Outlet пытался бы прочитать currentRoute до того, как ROUTES_TABLE
 * будет зарегистрирована.
 */
export class Router {
    /** Реактивный снимок текущего перехода; читается Outlet-ом и пр. */
    readonly currentRoute: Signal<RouteState>;

    /** Реактивный идентификатор активного layout-shell-а. */
    readonly currentLayout: Signal<LayoutKind>;

    /** Таблица роутов; задаётся через register или конструктор. */
    private routes: readonly RouteDescriptor[] = [];

    /**
     * Создаёт роутер с пустыми сигналами и заранее подписывается на popstate.
     *
     * Начальный currentRoute это pending-стейт с location.pathname плюс search;
     * настоящий go() ещё не запускался, и Outlet видит pending до тех пор, пока
     * App не позовёт start(). popstate-обработчик подключается сразу: пользователь
     * может нажать "назад" в любой момент после первой отрисовки, и важно не
     * упустить это событие.
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
     * Регистрирует таблицу роутов.
     *
     * Полностью заменяет ранее зарегистрированный список. Вызов идемпотентен в
     * смысле сигналов: ни currentRoute, ни currentLayout не пересчитываются
     * автоматически (этого ожидать стоит от первого go/start, не от register).
     *
     * @param routes Новая таблица роутов в порядке приоритета.
     */
    register(routes: readonly RouteDescriptor[]): void {
        this.routes = routes;
    }

    /**
     * Запускает первый переход по текущему URL.
     *
     * Должен вызываться один раз после монтирования shell-а. Внутри читает
     * location.pathname + location.search и выполняет ту же логику, что и
     * go(path), но без pushState: запись в history уже существует.
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
     * Добавляет запись в history через pushState, после чего инициирует
     * стандартный жизненный цикл загрузки роута (pending -> import + loader ->
     * startViewTransition -> ready). Если путь совпадает с текущим, переход
     * всё равно выполнится: пользователь мог явно запросить перезагрузку
     * данных страницы. Дедупликацию таких случаев оставляем компоненту Link
     * или вызывающему коду.
     *
     * @param path Целевой путь (с query-частью или без).
     * @returns Промис, разрешающийся после коммита (или после обработки ошибки).
     */
    go(path: string): Promise<void> {
        return this.navigate(path, true);
    }

    /**
     * Обрабатывает событие popstate (кнопки браузера "назад"/"вперёд").
     *
     * Отличается от go только отсутствием pushState: запись истории уже
     * подменена браузером, дублировать её было бы дефектом. Связь this
     * жёстко зафиксирована arrow-функцией, чтобы listener корректно
     * регистрировался и снимался независимо от контекста вызова.
     */
    private handlePopState = (): void => {
        const path = window.location.pathname + window.location.search;
        void this.navigate(path, false);
    };

    /**
     * Снимает все системные обработчики, привязанные роутером к окну.
     *
     * Метод нужен для тестов и для гипотетического hot-reload: в production
     * роутер живёт ровно столько, сколько живёт страница, поэтому в обычном
     * сценарии вызов не требуется.
     */
    dispose(): void {
        window.removeEventListener('popstate', this.handlePopState);
    }

    /**
     * Внутренняя точка перехода: общая логика go и popstate.
     *
     * Шаги:
     *  1. Если нужен pushState, обновляем history.
     *  2. Парсим путь через matchPath; выставляем currentRoute в pending.
     *  3. Параллельно стартуем dynamic-import и loader (если есть).
     *  4. Дожидаемся обоих; вытаскиваем компонент из чанка через
     *     `mod.default ?? Object.values(mod)[0]`.
     *  5. Внутри startViewTransition синхронно меняем currentLayout (если
     *     другой) и currentRoute (ready). Эти два set должны быть в одном
     *     callback, иначе View Transitions API не успеет связать snapshot.
     *
     * Ошибка loader или import-а ловится: currentRoute переключается в
     * статус 'error' с приложенной причиной. View Transitions для ошибочного
     * перехода не запускается: дискомфорт смены анимации при белом экране
     * больше, чем польза.
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
            // как обработать промах (редирект на /404 или показ заглушки в Outlet).
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
 * Поддерживает обе формы экспорта: default-экспорт и любой первый именованный.
 * Если ни одно поле модуля не оказалось функцией, возвращает null: вызывающий
 * слой должен сразу выбросить понятную ошибку, потому что попытка отрисовать
 * undefined приведёт к падению где-то глубоко в VDOM-патче.
 *
 * @param mod Распакованный модуль чанка (результат await import).
 * @returns Найденный компонент или null.
 */
function extractComponent(mod: ComponentChunk): Component<VNodeProps> | null {
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
