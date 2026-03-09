/**
 * Модуль для выполнения HTTP-запросов к API
 */
export class Ajax {
    /** @private */
    static #baseUrl = '/api';

    /**
     * Универсальный метод для отправки запросов
     * @param {string} url - Путь API
     * @param {string} method - HTTP метод (GET, POST и т.д.)
     * @param {Object} body - Тело запроса
     * @returns {Promise<Response>} - Объект ответа от сервера.
     * @private
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
     * GET запрос
     * @param {string} url - Путь запроса.
     * @returns {Promise<Response>} - Результат выполнения GET запроса.
     */
    static async get(url) {
        return this.#request(url, 'GET');
    }

    /**
     * POST запрос
     * @param {string} url - Путь запроса.
     * @param {Object} body - Данные для отправки.
     * @returns {Promise<Response>} - Результат выполнения POST запроса.
     */
    static async post(url, body) {
        return this.#request(url, 'POST', body);
    }
}