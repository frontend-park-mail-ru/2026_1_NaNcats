/**
 * Публичный барель JSX-runtime'а. Babel automatic импортирует jsx/jsxs/Fragment
 * из jsx-runtime и jsxDEV из jsx-dev-runtime напрямую; барель удобен обычному
 * коду, которому нужны jsx или Fragment без JSX-синтаксиса.
 */

export { Fragment, jsx, jsxs } from './jsx-runtime';
export { jsxDEV } from './jsx-dev-runtime';
