import '../styles/variables.scss';
import '../styles/base.scss';
import '../styles/components.scss';

import { ROUTES } from '@shared/config/routes';
import { Router } from './router';
import { initCsrf, initServiceWorker, initOnlineStatus } from './providers';

const root = document.getElementById('root') as HTMLElement;

const router = new Router(root);
window.router = router;

router
    .register(ROUTES.home, async () => {
        const { HomePage } = await import('@pages/home');
        const props = await HomePage.load();
        return { component: new HomePage(), props };
    })
    .register(ROUTES.login, async () => {
        const { LoginPage } = await import('@pages/login');
        return { component: new LoginPage(), props: {} };
    })
    .register(ROUTES.register, async () => {
        const { RegisterPage } = await import('@pages/register');
        return { component: new RegisterPage(), props: {} };
    })
    .register(ROUTES.restaurant, async () => {
        const { RestaurantPage } = await import('@pages/restaurant');
        const props = await RestaurantPage.load();
        return { component: new RestaurantPage(), props };
    })
    .register(ROUTES.profile, async () => {
        const { ProfilePage } = await import('@pages/profile');
        const props = await ProfilePage.load();
        return { component: new ProfilePage(), props };
    })
    .register(ROUTES.checkout, async () => {
        const { CheckoutPage } = await import('@pages/checkout');
        const props = await CheckoutPage.load();
        return { component: new CheckoutPage(), props };
    })
    .register(ROUTES.notFound, async () => {
        const { NotFoundPage } = await import('@pages/not-found');
        return { component: new NotFoundPage(), props: {} };
    });

const init = async (): Promise<void> => {
    await initCsrf();
    initServiceWorker();
    initOnlineStatus();
    void router.render(window.location.pathname);
};

void init();
