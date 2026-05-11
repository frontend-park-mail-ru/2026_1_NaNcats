/**
 * Публичный барель страницы регистрации.
 *
 * Экспортирует функциональный компонент {@link RegisterPage} как default
 * (роутер берёт компонент из `mod.default`) и как именованный. Loader-а у
 * страницы нет: данные собирает сама форма.
 */

import { RegisterPage } from './ui/RegisterPage';

export { RegisterPage };
export default RegisterPage;
