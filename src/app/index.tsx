import '../styles/variables.scss';
import '../styles/base.scss';
import '../styles/components.scss';

import { render, type VNode } from '@shared/lib/vdom';

import { App } from './App';
import { initCsrf, initOnlineStatus, initServiceWorker } from './providers';
import { router } from './router';

// Глобальная ссылка для legacy-кода (Header и пара других мест дёргают window.router.go).
window.router = router;

/**
 * Инициализирует приложение и монтирует корневой компонент.
 *
 * Порядок важен: сначала CSRF-токен (до него изменяющие запросы небезопасны),
 * затем сервис-воркер и слежение за сетью, в конце render и первый переход роутера.
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
