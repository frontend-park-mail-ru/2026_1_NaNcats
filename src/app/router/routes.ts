/**
 * Описание формы записи в таблице роутов и сама таблица.
 *
 * Файл сознательно отделён от Router.ts. Router занимается жизненным циклом
 * (signal-стейт, popstate, View Transitions); routes описывает связь
 * URL-путь -> чанк страницы. Таблица заполняется один раз при сборке: все
 * страницы импортируются динамически (через `() => import('@pages/...')`)
 * чтобы webpack выделил каждую в отдельный chunk и роутер мог загружать их
 * параллельно с loader-ом.
 */

import { ROUTES } from '@shared/config/routes';
import type { Component, VNodeProps } from '@shared/lib/vdom';

/**
 * Идентификатор layout-shell-а, в котором живёт страница.
 *
 * - 'root': основной shell приложения (Header, Outlet, OfflineBanner).
 * - 'auth': shell страниц авторизации (центр-форма, общий логотип).
 *
 * Дискриминированное объединение строковых литералов нужно, чтобы и Router и
 * App.tsx говорили об одних и тех же значениях, и компилятор подсказывал, если
 * где-то появится новый layout.
 */
export type LayoutKind = 'root' | 'auth';

/**
 * Форма результата динамического import-а чанка страницы.
 *
 * Чанк может экспортировать компонент по-разному в зависимости от стиля
 * исходного модуля:
 *  - `export default function Page(props) { ... }` оставляет компонент в default;
 *  - `export function HomePage(props) { ... }` оставляет его именованным.
 *
 * Чтобы Router не зависел от стиля каждой страницы, тип допускает обе формы.
 * Извлечение фактического компонента делается на стороне Router-а через
 * `mod.default ?? Object.values(mod)[0]`. Это слабая, но достаточная гарантия,
 * пока не введена единая конвенция (например, "только default-export"); тогда
 * этот тип сузится без поломки потребителей.
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
 * Возвращает Promise с модулем, содержащим компонент. Router запускает этот
 * import параллельно с loader (через Promise.all), чтобы код страницы и её
 * первичные данные грузились одновременно. На уровне типа важно сохранить
 * Promise: сборщики (webpack, vite) понимают форму `() => import('...')` и
 * выделяют код в отдельный chunk.
 */
export type ChunkLoader = () => Promise<ComponentChunk>;

/**
 * Дескриптор одного роута в таблице.
 *
 * Поля:
 *  - `path`: точный путь без query-части (matchPath сам отделит query).
 *  - `component`: фабрика динамического import-а компонента страницы.
 *  - `loader`: опциональный загрузчик props страницы; результат сохраняется в
 *    currentRoute.props и пробрасывается в компонент Outlet-ом.
 *  - `layout`: идентификатор layout-shell-а; по умолчанию 'root'.
 *
 * Все поля readonly, потому что таблица регистрируется один раз при старте
 * приложения и не должна мутировать в рантайме.
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
 * Перечислены семь известных путей: главная, страница ресторана, страница
 * входа, регистрации, профиль, оформление заказа и 404. Каждая запись
 * указывает на чанк страницы через `() => import('@pages/...')` и при
 * необходимости на её `load()`-функцию. Для страниц `auth`-layout-а
 * (login, register) loader отсутствует: данные собирает сама форма.
 *
 * Порядок записей важен только для интуиции: matchPath ищет совпадение по
 * точному значению `path`, без приоритета по позиции.
 *
 * Замечание про Home и Restaurant: миграция компонента живёт в Unit 10b.
 * Здесь мы только регистрируем для них роуты. Их `index.ts` экспортирует
 * именованный компонент (HomePage/RestaurantPage) и функцию `load`: роутер
 * достанет компонент через `extractComponent` (он понимает и `default`-форму,
 * и первый именованный экспорт-функцию), а loader дёрнет `load()` напрямую.
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
