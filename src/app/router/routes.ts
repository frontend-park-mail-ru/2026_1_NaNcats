/**
 * Форма записи в таблице роутов и сама таблица.
 *
 * Отделено от Router.ts: Router занимается жизненным циклом, routes описывает
 * связь URL-путь -> чанк страницы. Все страницы импортируются динамически
 * (`() => import('@pages/...')`), чтобы каждая попала в отдельный chunk.
 */

import { ROUTES } from '@shared/config/routes';
import type { Component, VNodeProps } from '@shared/lib/vdom';

/** Идентификатор layout-shell-а страницы: 'root' (Header, Outlet, OfflineBanner) или 'auth' (центр-форма, логотип). */
export type LayoutKind = 'root' | 'auth';

/**
 * Форма результата динамического import-а чанка страницы.
 *
 * Допускает обе формы экспорта компонента (default или именованный): фактический
 * компонент извлекает Router через extractComponent.
 */
export type ComponentChunk = {
    /** Компонент страницы, если экспортирован как default. */
    default?: Component<VNodeProps>;
    /** Произвольные именованные экспорты; первый встречный компонент будет извлечён. */
    [key: string]: Component<VNodeProps> | undefined;
};

/**
 * Загрузчик чанка страницы: фабрика динамического import-а.
 *
 * Форму `() => import('...')` понимают сборщики (webpack, vite) и выделяют код
 * в отдельный chunk; Router запускает import параллельно с loader через Promise.all.
 */
export type ChunkLoader = () => Promise<ComponentChunk>;

/**
 * Дескриптор одного роута в таблице.
 *
 * loader опционален: его результат сохраняется в currentRoute.props и
 * пробрасывается в компонент Outlet-ом. layout по умолчанию 'root'. Все поля
 * readonly: таблица регистрируется один раз при старте.
 */
export interface RouteDescriptor {
    /** URL-путь без query-части (например, '/login'). */
    readonly path: string;
    /** Фабрика динамического import-а чанка с компонентом страницы. */
    readonly component: ChunkLoader;
    /** Опциональный загрузчик props; вызывается параллельно с component. */
    readonly loader?: () => Promise<unknown>;
    /** Идентификатор layout-shell-а; если опущен, считается 'root'. */
    readonly layout?: LayoutKind;
}

/**
 * Таблица роутов приложения.
 *
 * Семь путей: главная, ресторан, вход, регистрация, профиль, оформление заказа, 404.
 * Для страниц auth-layout-а (login, register) loader отсутствует: данные собирает форма.
 * matchPath ищет по точному значению path, без приоритета по позиции.
 */
export const ROUTES_TABLE: RouteDescriptor[] = [
    {
        path: ROUTES.home,
        layout: 'root',
        component: () => import('@pages/home') as unknown as Promise<ComponentChunk>,
        loader: async () => (await import('@pages/home')).load(),
    },
    {
        path: ROUTES.restaurant,
        layout: 'root',
        component: () => import('@pages/restaurant') as unknown as Promise<ComponentChunk>,
        loader: async () => (await import('@pages/restaurant')).load(),
    },
    {
        path: ROUTES.login,
        layout: 'auth',
        component: () => import('@pages/login') as unknown as Promise<ComponentChunk>,
    },
    {
        path: ROUTES.register,
        layout: 'auth',
        component: () => import('@pages/register') as unknown as Promise<ComponentChunk>,
    },
    {
        path: ROUTES.profile,
        layout: 'root',
        component: () => import('@pages/profile') as unknown as Promise<ComponentChunk>,
        loader: async () => (await import('@pages/profile')).load(),
    },
    {
        path: ROUTES.checkout,
        layout: 'root',
        component: () => import('@pages/checkout') as unknown as Promise<ComponentChunk>,
        loader: async () => (await import('@pages/checkout')).load(),
    },
    {
        path: ROUTES.notFound,
        layout: 'root',
        component: () => import('@pages/not-found') as unknown as Promise<ComponentChunk>,
    },
];
