import { Router } from './core/Router.js';
import { NotFound } from './errors/NotFound.js';

const root = document.getElementById('root');

window.router = new Router(root);
window.router
    .register('/', async () => {
        const { Restaurants } = await import('./modules/restaurants/Restaurants.js');
        return new Restaurants();
    })
    .register('/login', async () => {
        const { Login } = await import('./modules/login/Login.js');
        return new Login();
    })
    .register('/register', async () => {
        const { Register } = await import('./modules/register/Register.js');
        return new Register();
    })
    .register('/404', new NotFound()); 

const init = () => {
    window.router.render(window.location.pathname);
};

init();
