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
    private static baseUrl: string = '/api';

    /**
     * Универсальный внутренний метод для обертки над fetch.
     * @param {string} url - Относительный путь эндпоинта.
     * @param {string} method - HTTP-метод запроса (GET, POST, и т.д.).
     * @param {Object|null} [body=null] - Тело запроса (преобразуется в JSON).
     * @returns {Promise<Response>} Объект ответа Response.
     * @private
     * @static
     */
    private static async request(url: string, method: string, body: any = null): Promise<Response> {
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', 
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        return fetch(`${this.baseUrl}${url}`, options);
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
    public static async get(url: string): Promise<Response> {
        return this.request(url, 'GET');
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
    public static async post(url: string, body?: any): Promise<Response> {
        return this.request(url, 'POST', body);
    }

    /**
     * Выполняет PATCH-запрос.
     * @static
     * @param {string} url - Путь запроса.
     * @param {Object} body - Объект с данными, который будет сериализован в JSON.
     * @returns {Promise<Response>} Результат выполнения запроса.
     * 
     * @example
     * await Ajax.patch('/profile/addresses/${editingAddressId}', {...});
     */
    public static async patch(url: string, body: any): Promise<Response> { 
        return this.request(url, 'PATCH', body); 
    }
    
    /**
     * Выполняет DELETE-запрос.
     * @static
     * @param {string} url - Путь запроса.
     * @returns {Promise<Response>} Результат выполнения запроса.
     * 
     * @example
     * await Ajax.delete('/profile/cards/${cardId}');
     */
    public static async delete(url: string): Promise<Response> { 
        return this.request(url, 'DELETE'); 
    }
    
    /**
     * Выполняет PUT-запрос.
     * @static
     * @param {string} url - Путь запроса.
     * @param {Object} body - Объект с данными, который будет сериализован в JSON. Может быть null
     * @returns {Promise<Response>} Результат выполнения запроса.
     * 
     * @example
     * await Ajax.put('/profile/cards/${cardId}');
     */
    public static async put(url: string, body: any = null): Promise<Response> { 
        return this.request(url, 'PUT', body); 
    }
}
