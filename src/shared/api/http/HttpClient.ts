import { ApiError } from './ApiError';
import { csrfStore, type CsrfStore } from './csrfStore';

/**
 * Поддерживаемые HTTP-методы. Жёсткий список нужен, чтобы случайные строки
 * не попадали в заголовки и в логику CSRF/идемпотентности.
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Параметры запроса в виде словаря "имя: значение". Поля со значением
 * undefined или null пропускаются и в URL не попадают.
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Внутренние опции одного HTTP-запроса.
 */
interface RequestOptions {
    /** Передавать тело как FormData (без выставления Content-Type). */
    isForm?: boolean;
    /** Внутренний флаг: запрос является повторной попыткой после обновления CSRF. */
    isRetry?: boolean;
    /** Дополнительные заголовки запроса; объединяются со стандартными. */
    headers?: Record<string, string>;
    /** Явный ключ идемпотентности; иначе генерируется автоматически. */
    idempotencyKey?: string;
}

/**
 * Возвращает свежий ключ идемпотентности для не-GET запросов.
 *
 * Использует crypto.randomUUID, если он доступен; иначе формирует строку из
 * метки времени и случайного хвоста, чтобы код работал и в окружениях без
 * Web Crypto.
 *
 * @returns Уникальный ключ для заголовка Idempotency-Key.
 */
function generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Тонкая обёртка над fetch для общения с REST API проекта.
 *
 * Скрывает три сквозные заботы: префикс baseUrl, заголовок CSRF (берётся из
 * {@link CsrfStore} и автоматически обновляется при ответе 403), а также
 * генерацию Idempotency-Key для всех модифицирующих методов. Для удобства
 * предоставляет два уровня методов: "сырые" (возвращают Response, чтобы
 * вызывающий код сам решал, как обрабатывать тело) и JSON-варианты, которые
 * парсят ответ и кидают {@link ApiError} при неуспешном статусе.
 */
export class HttpClient {
    /**
     * @param baseUrl Префикс, который подставляется перед каждым путём запроса.
     * @param csrf Хранилище CSRF-токена, используемое для заголовка X-CSRF-Token.
     */
    constructor(
        private readonly baseUrl: string,
        private readonly csrf: CsrfStore,
    ) {}

    /**
     * Выполняет GET-запрос и возвращает сырой Response.
     *
     * @param url Путь относительно baseUrl.
     * @returns Промис с объектом Response без проверки статуса.
     */
    get(url: string): Promise<Response> {
        return this.request('GET', url);
    }

    /**
     * Выполняет POST-запрос с JSON-телом и возвращает сырой Response.
     *
     * @param url Путь относительно baseUrl.
     * @param body Тело запроса; будет сериализовано через JSON.stringify.
     * @returns Промис с объектом Response без проверки статуса.
     */
    post(url: string, body?: unknown): Promise<Response> {
        return this.request('POST', url, body);
    }

    /**
     * Выполняет PUT-запрос с JSON-телом и возвращает сырой Response.
     *
     * @param url Путь относительно baseUrl.
     * @param body Тело запроса; по умолчанию null.
     * @returns Промис с объектом Response без проверки статуса.
     */
    put(url: string, body: unknown = null): Promise<Response> {
        return this.request('PUT', url, body);
    }

    /**
     * Выполняет PATCH-запрос с JSON-телом и возвращает сырой Response.
     *
     * @param url Путь относительно baseUrl.
     * @param body Тело запроса.
     * @returns Промис с объектом Response без проверки статуса.
     */
    patch(url: string, body: unknown): Promise<Response> {
        return this.request('PATCH', url, body);
    }

    /**
     * Выполняет DELETE-запрос с JSON-телом и возвращает сырой Response.
     *
     * @param url Путь относительно baseUrl.
     * @param body Тело запроса; по умолчанию null.
     * @returns Промис с объектом Response без проверки статуса.
     */
    delete(url: string, body: unknown = null): Promise<Response> {
        return this.request('DELETE', url, body);
    }

    /**
     * Отправляет POST с FormData (без сериализации в JSON).
     *
     * @param url Путь относительно baseUrl.
     * @param formData Готовый объект FormData.
     * @returns Промис с объектом Response без проверки статуса.
     */
    postForm(url: string, formData: FormData): Promise<Response> {
        return this.request('POST', url, formData, { isForm: true });
    }

    /**
     * Выполняет GET-запрос и парсит ответ как JSON.
     *
     * Параметры query сериализуются в строку запроса; при неуспешном HTTP-статусе
     * выбрасывается {@link ApiError} с текстом из тела ответа (если есть).
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param query Необязательные query-параметры.
     * @returns Промис с распарсенным телом ответа.
     */
    getJson<T>(path: string, query?: QueryParams): Promise<T> {
        return this.requestJson<T>('GET', this.withQuery(path, query));
    }

    /**
     * Выполняет POST-запрос и парсит ответ как JSON.
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     * @param idempotencyKey Явный ключ идемпотентности; иначе генерируется автоматически.
     * @returns Промис с распарсенным телом ответа.
     */
    postJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('POST', path, body, { idempotencyKey });
    }

    /**
     * Выполняет PATCH-запрос и парсит ответ как JSON.
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     * @param idempotencyKey Явный ключ идемпотентности.
     * @returns Промис с распарсенным телом ответа.
     */
    patchJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('PATCH', path, body, { idempotencyKey });
    }

    /**
     * Выполняет PUT-запрос и парсит ответ как JSON.
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     * @param idempotencyKey Явный ключ идемпотентности.
     * @returns Промис с распарсенным телом ответа.
     */
    putJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('PUT', path, body, { idempotencyKey });
    }

    /**
     * Выполняет DELETE-запрос и парсит ответ как JSON.
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     * @param idempotencyKey Явный ключ идемпотентности.
     * @returns Промис с распарсенным телом ответа.
     */
    deleteJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('DELETE', path, body, { idempotencyKey });
    }

    /**
     * Отправляет POST с FormData и парсит ответ как JSON.
     *
     * При неуспешном HTTP-статусе выбрасывается {@link ApiError}.
     *
     * @template T Ожидаемый тип ответа.
     * @param path Путь относительно baseUrl.
     * @param formData Готовый объект FormData.
     * @returns Промис с распарсенным телом ответа.
     */
    async postFormJson<T>(path: string, formData: FormData): Promise<T> {
        const res = await this.request('POST', path, formData, { isForm: true });
        if (!res.ok) throw await this.toError('POST', path, res);
        return (await res.json()) as T;
    }

    /**
     * Выполняет запрос произвольного метода и проверяет успех по HTTP-статусу.
     *
     * Тело ответа не читается; нужен для сценариев, где результат не важен,
     * а важен только факт успешного выполнения. При неуспехе выбрасывает
     * {@link ApiError}.
     *
     * @param method HTTP-метод запроса.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     */
    async send(method: HttpMethod, path: string, body?: unknown): Promise<void> {
        const res = await this.request(method, path, body);
        if (!res.ok) throw await this.toError(method, path, res);
    }

    /**
     * Общая реализация JSON-запросов: выполняет запрос, проверяет статус и
     * парсит тело.
     *
     * @template T Ожидаемый тип ответа.
     * @param method HTTP-метод запроса.
     * @param path Путь относительно baseUrl.
     * @param body Тело запроса.
     * @param opts Дополнительные опции запроса.
     * @returns Промис с распарсенным телом ответа.
     */
    private async requestJson<T>(
        method: HttpMethod,
        path: string,
        body?: unknown,
        opts: RequestOptions = {},
    ): Promise<T> {
        const res = await this.request(method, path, body, opts);
        if (!res.ok) throw await this.toError(method, path, res);
        return (await res.json()) as T;
    }

    /**
     * Дописывает к пути query-строку из переданных параметров.
     *
     * Поля со значением undefined или null пропускаются. Если итоговая строка
     * пустая, путь возвращается без изменений.
     *
     * @param path Исходный путь.
     * @param query Параметры для сериализации.
     * @returns Путь с присоединённой query-строкой.
     */
    private withQuery(path: string, query?: QueryParams): string {
        if (!query) return path;
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) params.append(k, String(v));
        }
        const qs = params.toString();
        return qs ? `${path}?${qs}` : path;
    }

    /**
     * Превращает неуспешный Response в {@link ApiError}.
     *
     * Пытается достать поле message из тела ответа; если тело не JSON или не
     * содержит message, подставляет дефолтный текст вида "METHOD path failed".
     *
     * @param method HTTP-метод запроса.
     * @param path Путь относительно baseUrl.
     * @param res Полученный Response с неуспешным статусом.
     * @returns Готовый ApiError для проброса вызывающему коду.
     */
    private async toError(method: HttpMethod, path: string, res: Response): Promise<ApiError> {
        const message = await res
            .json()
            .then((b: { message?: string } | null) => b?.message)
            .catch(() => undefined);
        return new ApiError(message ?? `${method} ${path} failed`, { status: res.status, url: path });
    }

    /**
     * Запрашивает свежий CSRF-токен у сервера и сохраняет его в хранилище.
     *
     * Сетевые сбои и неуспешные статусы подавляются: метод используется как
     * фоновая попытка, неудача не должна ломать вызывающий поток.
     */
    async fetchCsrf(): Promise<void> {
        try {
            const res = await fetch(`${this.baseUrl}/csrf`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data.csrf_token === 'string') {
                this.csrf.setToken(data.csrf_token);
            }
        } catch (e) {
            console.warn('Failed to fetch CSRF token', e);
        }
    }

    /**
     * Низкоуровневая обёртка над fetch с общей логикой для всех методов.
     *
     * Собирает заголовки (Content-Type, X-CSRF-Token, Idempotency-Key),
     * подмешивает credentials: include и сериализует тело. Если сервер ответил
     * 403 на не-GET запрос и это не повторная попытка, токен CSRF обновляется
     * и запрос выполняется ещё один раз; повторный 403 возвращается как есть.
     *
     * @param method HTTP-метод запроса.
     * @param url Путь относительно baseUrl.
     * @param body Тело запроса; null означает "без тела".
     * @param opts Дополнительные опции запроса.
     * @returns Промис с объектом Response.
     */
    private async request(
        method: HttpMethod,
        url: string,
        body: unknown = null,
        opts: RequestOptions = {},
    ): Promise<Response> {
        const headers: Record<string, string> = { ...opts.headers };
        if (!opts.isForm) {
            headers['Content-Type'] = 'application/json';
        }

        const token = this.csrf.getToken();
        if (method !== 'GET' && token) {
            headers['X-CSRF-Token'] = token;
        }

        if (method !== 'GET') {
            headers['Idempotency-Key'] = crypto.randomUUID();
        }

        const init: RequestInit = {
            method,
            headers,
            credentials: 'include',
        };

        if (body !== null && body !== undefined) {
            init.body = opts.isForm ? (body as FormData) : JSON.stringify(body);
        }

        const fullUrl = `${this.baseUrl}${url}`;
        let response: Response;
        try {
            response = await fetch(fullUrl, init);
        } catch (e) {
            throw ApiError.network(fullUrl, e);
        }

        if (response.status === 403 && !opts.isRetry && method !== 'GET') {
            console.warn('CSRF token rejected, refreshing and retrying once');
            await this.fetchCsrf();
            return this.request(method, url, body, { ...opts, isRetry: true });
        }

        return response;
    }
}

/** Готовый клиент с префиксом /api и общим CSRF-хранилищем приложения. */
export const httpClient = new HttpClient('/api', csrfStore);
