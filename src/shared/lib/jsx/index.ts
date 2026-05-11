/**
 * Публичный барель JSX-runtime'а.
 *
 * Babel automatic-runtime импортирует jsx, jsxs и Fragment из jsx-runtime, а
 * jsxDEV из jsx-dev-runtime. Эти подмодули остаются точками входа для Babel.
 * Барель удобен для обычного кода, которому могут понадобиться jsx или
 * Fragment напрямую (например, при ручном построении VNode без JSX-синтаксиса).
 */

export { Fragment, jsx, jsxs } from './jsx-runtime';
export { jsxDEV } from './jsx-dev-runtime';
