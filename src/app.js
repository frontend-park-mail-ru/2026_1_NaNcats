import { Router } from './core/Router.js';
import { Login } from './components/Login.js';
import { Register } from './components/Register.js';
import { RestaurantList } from './components/RestaurantList.js';

const root = document.getElementById('root');

window.router = new Router(root);
window.router
    .register('/', new RestaurantList())
    .register('/login', new Login())
    .register('/register', new Register());

const init = () => {
    window.router.render(window.location.pathname);
};

init();