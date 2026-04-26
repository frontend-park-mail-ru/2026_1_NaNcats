import { ApiError } from './ApiError';
import { csrfStore } from './csrfStore';
import type { CsrfStore } from './csrfStore';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

    delete(url: string): Promise<Response> {
        return this.request('DELETE', url);
    }

    postForm(url: string, formData: FormData): Promise<Response> {
        return this.request('POST', url, formData, { isForm: true });
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
        opts: { isForm?: boolean; isRetry?: boolean } = {},
    ): Promise<Response> {
        const headers: Record<string, string> = {};
        if (!opts.isForm) {
            headers['Content-Type'] = 'application/json';
        }

        const token = this.csrf.getToken();
        if (method !== 'GET' && token) {
            headers['X-CSRF-Token'] = token;
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
