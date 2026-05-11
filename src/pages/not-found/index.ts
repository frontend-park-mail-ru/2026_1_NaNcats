/**
 * Публичный барель страницы 404.
 *
 * Экспортирует функциональный компонент {@link NotFoundPage} как default
 * (роутер берёт компонент из `mod.default`) и как именованный. Loader-а
 * странице не нужно: контент полностью статический.
 */

import { NotFoundPage } from './ui/NotFoundPage';

export { NotFoundPage };
export default NotFoundPage;
