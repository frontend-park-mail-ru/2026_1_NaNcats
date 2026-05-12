/**
 * Публичный барель сигнального роутера: класс Router, singleton router,
 * компоненты Outlet и Link, типы RouteDescriptor/RouteState и таблица ROUTES_TABLE.
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

/** Глобальный singleton роутера приложения. */
export const router = new Router(ROUTES_TABLE);
