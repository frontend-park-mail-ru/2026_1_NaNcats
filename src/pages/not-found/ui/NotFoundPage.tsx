/**
 * Страница 404.
 *
 * Отображает заглушку с сообщением об отсутствии запрошенной страницы и
 * ссылку для возврата на главную через {@link Link}. Внешних зависимостей и
 * собственного состояния не имеет.
 *
 * Layout: 'root'. Header и остальной shell остаются персистентными при
 * переходе на 404 и обратно.
 */

import { Link } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import type { VNode } from '@shared/lib/vdom';

/**
 * Функциональный компонент страницы 404.
 *
 * Использует инлайн-стили, идентичные старой версии: центрированный блок с
 * заголовком, поясняющим текстом и кнопкой возврата на главную.
 *
 * @returns VNode-дерево страницы 404.
 */
export function NotFoundPage(): VNode {
    return (
        <div
            class="not-found-page"
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;"
        >
            <h1>404 - Страница не найдена</h1>
            <p>К сожалению, такой страницы не существует.</p>
            <Link
                to={ROUTES.home}
                class="router-link button button_primary"
                style="width: auto; padding: 10px 20px;"
            >
                Вернуться на главную
            </Link>
        </div>
    ) as VNode;
}
