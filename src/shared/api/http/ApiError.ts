/**
 * Ошибка сетевого слоя для всех неуспешных HTTP-вызовов из {@link HttpClient}.
 *
 * Несёт HTTP-статус, путь запроса и (опционально) исходную причину для
 * диагностики. Используется как единый тип ошибки на стыке UI и API: код
 * выше по стеку различает сценарии по полю status (0 - сетевая ошибка,
 * иначе HTTP-код от сервера).
 */
export class ApiError extends Error {
    /** HTTP-статус ответа; 0 если запрос не дошёл до сервера. */
    public readonly status: number;
    /** URL или путь, по которому выполнялся запрос. */
    public readonly url: string;
    /** Исходная причина (например, пойманное исключение fetch). */
    public readonly cause?: unknown;

    /**
     * @param message Текст ошибки для логов и UI.
     * @param opts Метаданные запроса: статус, url и причина.
     */
    constructor(message: string, opts: { status: number; url: string; cause?: unknown }) {
        super(message);
        this.name = 'ApiError';
        this.status = opts.status;
        this.url = opts.url;
        this.cause = opts.cause;
    }

    /**
     * Создаёт ошибку для случая, когда fetch отверг промис до получения
     * ответа (нет сети, обрыв соединения и т.п.). Статус выставляется в 0,
     * чтобы отличать такие сбои от ответов сервера.
     *
     * @param url URL запроса, который не удалось выполнить.
     * @param cause Исходное исключение, перехваченное в catch.
     * @returns Готовый экземпляр ApiError со статусом 0.
     */
    static network(url: string, cause: unknown): ApiError {
        return new ApiError('Network request failed', { status: 0, url, cause });
    }
}
