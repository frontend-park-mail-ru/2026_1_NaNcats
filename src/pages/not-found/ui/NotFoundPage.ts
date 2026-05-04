import { Component } from '@shared/lib/component';

const TEMPLATE = `
<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
    <h1>404 - Страница не найдена</h1>
    <p>К сожалению, такой страницы не существует.</p>
    <a href="/" class="router-link button button_primary" style="width: auto; padding: 10px 20px;">Вернуться на главную</a>
</div>
`;

/**
 * Страница 404.
 *
 * Отображает заглушку с сообщением об отсутствии запрошенной страницы и
 * ссылку для возврата на главную. Внешних зависимостей и собственного
 * состояния не имеет.
 */
export class NotFoundPage extends Component<object> {
    constructor() {
        super(TEMPLATE);
    }
}
