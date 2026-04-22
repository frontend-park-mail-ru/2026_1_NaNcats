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

    private static csrfToken: string | null = null;

    public static getCsrfToken(): string | null {
        return this.csrfToken;
    }

    public static setCsrfToken(token: string): void {
        this.csrfToken = token;
    }

    public static clearCsrfToken(): void {
        this.csrfToken = null;
    }

    public static async fetchCsrf(): Promise<void> {
        try {
            const res = await fetch(`${this.baseUrl}/csrf`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.csrf_token) {
                    this.csrfToken = data.csrf_token;
                }
            }
        } catch (e) {
            console.warn('Не удалось получить CSRF токен', e);
        }
    }

    /**
     * Генерирует уникальный идентификатор (UUID v4) для Idempotency-Key.
     * Использует встроенный Web Crypto API.
     * @private
     * @static
     */
    private static generateIdempotencyKey(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        
        // фоллбек для старых браузеров
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
            const num = Number(c);
            return (num ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (num / 4)))).toString(16);
        });
    }

    /**
     * Универсальный внутренний метод для обертки над fetch.
     * @param {string} url - Относительный путь эндпоинта.
     * @param {string} method - HTTP-метод запроса (GET, POST, и т.д.).
     * @param {Object|null} [body=null] - Тело запроса (преобразуется в JSON).
     * @returns {Promise<Response>} Объект ответа Response.
     * @private
     * @static
     */
    private static async request(url: string, method: string, body: unknown = null, isRetry: boolean = false): Promise<Response> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (method !== 'GET') {
            headers['Idempotency-Key'] = this.generateIdempotencyKey();

            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }
        }

        const options: RequestInit = {
            method,
            headers,
            credentials: 'include', 
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${url}`, options);

        if (response.status === 403 && !isRetry && method !== 'GET') {
            console.warn('CSRF token expired or invalid, trying to refresh...');
            await this.fetchCsrf();
            
            return this.request(url, method, body, true);
        }

        return response;
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
    public static async post(url: string, body?: unknown): Promise<Response> {
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
    public static async patch(url: string, body: unknown): Promise<Response> { 
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
    public static async put(url: string, body: unknown = null): Promise<Response> { 
        return this.request(url, 'PUT', body); 
    }
}
