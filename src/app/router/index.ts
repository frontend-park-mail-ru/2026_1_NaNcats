/**
 * Публичный барель сигнального роутера.
 *
 * Здесь собрано всё, чем пользуется верхний слой приложения: класс Router,
 * глобальный singleton, компоненты Outlet и Link, типы RouteDescriptor и
 * RouteState, плюс заглушка ROUTES_TABLE, в которую Unit 10a/10b добавят
 * реальные дескрипторы страниц.
 *
 * Сингл-инстанс роутера экспортируется через переменную router. App.tsx
 * сначала импортирует роутер, при необходимости заменяет его таблицу через
 * register(), затем вызывает router.start() после монтирования shell-а.
 * Эту же ссылку Outlet и Link читают для чтения сигналов и вызова go().
 * Глобальный shim window.router сохраняется для текущего legacy-кода (Header
 * и пара других мест) и снимется в Unit 16.
 */

import { Router } from './Router';
import { ROUTES_TABLE } from './routes';

export { Router } from './Router';
export type { RouteState, RouteStatus } from './Router';
export { Outlet } from './Outlet';
export { Link } from './Link';
export type { LinkProps } from './Link';
export { matchPath } from './matchPath';
export type { MatchResult } from './matchPath';
export { ROUTES_TABLE } from './routes';
export type { RouteDescriptor, LayoutKind, ChunkLoader, ComponentChunk } from './routes';

/**
 * Глобальный singleton роутера приложения.
 *
 * Создаётся с текущей (пустой на этом юните) таблицей ROUTES_TABLE. Когда Unit
 * 10a/10b дополнит таблицу реальными дескрипторами, повторная регистрация не
 * понадобится: ROUTES_TABLE и так подменяется по ссылке внутри router.register.
 * Тем не менее App.tsx может явно вызвать router.register(ROUTES_TABLE) после
 * её обновления, если миграция страниц перейдёт на чистый export.
 */
export const router = new Router(ROUTES_TABLE);
