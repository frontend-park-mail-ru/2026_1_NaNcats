import './styles/variables.scss';
import './styles/base.scss';
import './styles/components.scss';
import { Router } from './core/Router';
import { NotFound } from './errors/NotFound';
import { Ajax } from './core/Ajax';

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
    .register('/restaurant', async () => {
        const { RestaurantPage } = await import('./modules/restaurantPage/RestaurantPage');
        return new RestaurantPage();
    })
    .register('/profile', async () => {
        const { Profile } = await import('./modules/profile/Profile');
        return new Profile();
    })
    .register('/checkout', async () => {
        const { Checkout } = await import('./modules/checkout/Checkout');
        return new Checkout();
    })
    .register('/404', new NotFound()); 

const init = async () => {
    await Ajax.fetchCsrf();
    
    window.router.render(window.location.pathname);
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('ServiceWorker успешно зарегистрирован:', registration.scope);
                })
                .catch((error) => {
                    console.log('Ошибка регистрации ServiceWorker:', error);
                });
        });
    }

    const offlineBanner = document.createElement('div');
    offlineBanner.className = 'offline-banner';
    offlineBanner.innerText = 'Нет интернета. Приложение работает в автономном режиме.';
    document.body.appendChild(offlineBanner);

    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            offlineBanner.classList.remove('offline-banner_active');
        } else {
            offlineBanner.classList.add('offline-banner_active');
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    updateOnlineStatus();
};

init();
