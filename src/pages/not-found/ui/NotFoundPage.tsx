// Страница 404. Layout: 'root'.

import { Link } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import type { VNode } from '@shared/lib/vdom';

export function NotFoundPage(): VNode {
    return (
        <div
            class="not-found-page"
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;"
        >
            <h1>404 - Страница не найдена</h1>
            <p>К сожалению, такой страницы не существует.</p>
            <Link to={ROUTES.home} class="button button_primary" style="width: auto; padding: 10px 20px;">
                Вернуться на главную
            </Link>
        </div>
    );
}
