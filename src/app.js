import { Router } from './core/Router.js';
import { Login } from './components/Login.js';
import { Register } from './components/Register.js';
import { RestaurantList } from './components/RestaurantList.js';

const root = document.getElementById('root');

// Создаем роутер и регистрируем страницы
window.router = new Router(root);
window.router
    .register('/', new RestaurantList())
    .register('/login', new Login())
    .register('/register', new Register());

// Инициализация
const init = () => {
    // Отрисовываем ту страницу, на которой сейчас находимся
    window.router.render(window.location.pathname);
};

init();