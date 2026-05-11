/**
 * Публичный барель страницы входа.
 *
 * Экспортирует функциональный компонент {@link LoginPage} как default
 * (роутер берёт компонент из `mod.default`) и как именованный для прямых
 * импортов. Loader-а у страницы нет: форма работает чисто с
 * пользовательским вводом, поэтому функция `load` отсутствует.
 */

import { LoginPage } from './ui/LoginPage';

export { LoginPage };
export default LoginPage;
