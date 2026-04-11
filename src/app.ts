import { Router } from './core/Router';
import { NotFound } from './errors/NotFound';

const root = document.getElementById('root') as HTMLElement;

window.router = new Router(root);
window.router
    .register('/', async () => {
        const { Restaurants } = await import('./modules/restaurants/Restaurants');
        return new Restaurants();
    })
    .register('/login', async () => {
        const { Login } = await import('./modules/login/Login');
        return new Login();
    })
    .register('/register', async () => {
        const { Register } = await import('./modules/register/Register');
        return new Register();
    })
    .register('/profile', async () => {
        const { Profile } = await import('./modules/profile/Profile');
        return new Profile();
    })
    .register('/404', new NotFound()); 

const init = () => {
    window.router.render(window.location.pathname);
};

init();
