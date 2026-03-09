import { Component } from '../core/Component.js';

/**
 * Компонент страницы ошибки 404 (Страница не найдена).
 * Отображается роутером, если запрашиваемый путь не зарегистрирован.
 * @extends Component
 */
export class NotFound extends Component {
    /**
     * Создает экземпляр компонента NotFound.
     * Инициализирует базовый класс Component с HTML-шаблоном страницы ошибки.
     */
    constructor() {
        super(`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
                <h1>404 - Страница не найдена</h1>
                <p>К сожалению, такой страницы не существует.</p>
                <a href="/" class="router-link button button_primary" style="width: auto; padding: 10px 20px;">Вернуться на главную</a>
            </div>
        `);
    }
}