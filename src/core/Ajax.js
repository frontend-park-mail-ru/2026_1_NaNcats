/**
 * Класс-утилита для выполнения HTTP-запросов.
 * Предоставляет статические методы для работы с API, инкапсулируя настройки fetch и базовый URL.
 *
 * @class Ajax
 * @hideconstructor
 */
export class Ajax {
    /** 
     * Базовый префикс для всех запросов к API.
     * @type {string}
     * @private
     * @static
     */
    static #baseUrl = '/api';

    /**
     * Универсальный внутренний метод для обертки над fetch.
     * @param {string} url - Относительный путь эндпоинта.
     * @param {string} method - HTTP-метод запроса (GET, POST, и т.д.).
     * @param {Object|null} [body=null] - Тело запроса (преобразуется в JSON).
     * @returns {Promise<Response>} Объект ответа Response.
     * @private
     * @static
     */
    static async #request(url, method, body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', 
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        return fetch(`${this.#baseUrl}${url}`, options);
    }

    /**
     * Выполняет GET-запрос.
     * @static
     * @param {string} url - Путь запроса (относительно /api).
     * @returns {Promise<Response>} Результат выполнения запроса.
     * 
     * @example
     * const response = await Ajax.get('/restaurants/brands');
     * const data = await response.json();
     */
    static async get(url) {
        return this.#request(url, 'GET');
    }

    /**
     * Выполняет POST-запрос.
     * @static
     * @param {string} url - Путь запроса.
     * @param {Object} body - Объект с данными, который будет сериализован в JSON.
     * @returns {Promise<Response>} Результат выполнения запроса.
     * 
     * @example
     * await Ajax.post('/auth/login', { login: '...', password: '...' });
     */
    static async post(url, body) {
        return this.#request(url, 'POST', body);
    }
}
