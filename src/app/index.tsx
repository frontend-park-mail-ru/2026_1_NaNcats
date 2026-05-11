import '../styles/variables.scss';
import '../styles/base.scss';
import '../styles/components.scss';

import { render, type VNode } from '@shared/lib/vdom';

import { App } from './App';
import { initCsrf, initOnlineStatus, initServiceWorker } from './providers';
import { router } from './router';

/**
 * Глобальный shim роутера для совместимости с legacy-кодом.
 *
 * Текущий Header и пара других мест дёргают window.router.go(...): пока эти
 * места не мигрированы на новый Link/router-import, мы оставляем глобальную
 * ссылку. Снимется в Unit 16, когда legacy-вызовы пропадут.
 */
window.router = router;

/**
 * Инициализирует приложение и монтирует корневой компонент.
 *
 * Шаги выполняются в фиксированном порядке. Сначала запрашивается CSRF-токен:
 * до его получения изменяющие запросы выполнять небезопасно. Затем регистрация
 * сервис-воркера для офлайн-кэша. После этого стартует слежение за сетевым
 * статусом. В конце render монтирует `<App/>` в `#root`, и роутер запускает
 * первый переход через router.start(): start читает текущий location, делает
 * матч по ROUTES_TABLE и переключает currentRoute в ready. Если таблица ещё
 * пустая (как на Unit 8 до миграции страниц), start завершится без коммита,
 * Outlet останется в pending-скелетоне до тех пор, пока пользователь не
 * перейдёт на зарегистрированный маршрут.
 *
 * @returns Промис, разрешающийся после первого коммита router.start.
 */
const init = async (): Promise<void> => {
    await initCsrf();
    initServiceWorker();
    initOnlineStatus();
    const root = document.getElementById('root') as HTMLElement;
    render(<App /> as VNode, root);
    await router.start();
};

void init();
