export class ApiError extends Error {
    public readonly status: number;
    public readonly url: string;
    public readonly cause?: unknown;

    constructor(message: string, opts: { status: number; url: string; cause?: unknown }) {
        super(message);
        this.name = 'ApiError';
        this.status = opts.status;
        this.url = opts.url;
        this.cause = opts.cause;
    }

    static network(url: string, cause: unknown): ApiError {
        return new ApiError('Network request failed', { status: 0, url, cause });
    }
}
