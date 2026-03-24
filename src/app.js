import '../public/style.css';
import { Router } from './core/Router.js';
import { Login } from './modules/login/Login.js';
import { Register } from './modules/register/Register.js';
import { Restaurants } from './modules/restaurants/Restaurants.js';
import { NotFound } from './errors/NotFound.js';

const root = document.getElementById('root');

window.router = new Router(root);
window.router
    .register('/', new Restaurants())
    .register('/login', new Login())
    .register('/register', new Register())
    .register('/404', new NotFound()); 

const init = () => {
    window.router.render(window.location.pathname);
};

init();
