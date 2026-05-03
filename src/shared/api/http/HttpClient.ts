import { ApiError } from './ApiError';
import { csrfStore, type CsrfStore } from './csrfStore';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
    isForm?: boolean;
    isRetry?: boolean;
    headers?: Record<string, string>;
    idempotencyKey?: string;
}

function generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class HttpClient {
    constructor(
        private readonly baseUrl: string,
        private readonly csrf: CsrfStore,
    ) {}

    get(url: string): Promise<Response> {
        return this.request('GET', url);
    }

    post(url: string, body?: unknown): Promise<Response> {
        return this.request('POST', url, body);
    }

    put(url: string, body: unknown = null): Promise<Response> {
        return this.request('PUT', url, body);
    }

    patch(url: string, body: unknown): Promise<Response> {
        return this.request('PATCH', url, body);
    }

    delete(url: string, body: unknown = null): Promise<Response> {
        return this.request('DELETE', url, body);
    }

    postForm(url: string, formData: FormData): Promise<Response> {
        return this.request('POST', url, formData, { isForm: true });
    }

    getJson<T>(path: string, query?: QueryParams): Promise<T> {
        return this.requestJson<T>('GET', this.withQuery(path, query));
    }

    postJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('POST', path, body, { idempotencyKey });
    }

    patchJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('PATCH', path, body, { idempotencyKey });
    }

    putJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('PUT', path, body, { idempotencyKey });
    }

    deleteJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        return this.requestJson<T>('DELETE', path, body, { idempotencyKey });
    }

    async postFormJson<T>(path: string, formData: FormData): Promise<T> {
        const res = await this.request('POST', path, formData, { isForm: true });
        if (!res.ok) throw await this.toError('POST', path, res);
        return (await res.json()) as T;
    }

    async send(method: HttpMethod, path: string, body?: unknown): Promise<void> {
        const res = await this.request(method, path, body);
        if (!res.ok) throw await this.toError(method, path, res);
    }

    private async requestJson<T>(
        method: HttpMethod,
        path: string,
        body?: unknown,
        opts: RequestOptions = {}
    ): Promise<T> {
        const res = await this.request(method, path, body, opts);
        if (!res.ok) throw await this.toError(method, path, res);
        return (await res.json()) as T;
    }

    private withQuery(path: string, query?: QueryParams): string {
        if (!query) return path;
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) params.append(k, String(v));
        }
        const qs = params.toString();
        return qs ? `${path}?${qs}` : path;
    }

    private async toError(method: HttpMethod, path: string, res: Response): Promise<ApiError> {
        const message = await res
            .json()
            .then((b: { message?: string } | null) => b?.message)
            .catch(() => undefined);
        return new ApiError(message ?? `${method} ${path} failed`, { status: res.status, url: path });
    }

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

export const httpClient = new HttpClient('/api', csrfStore);
