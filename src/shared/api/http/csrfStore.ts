import { Store } from '@shared/lib/store';

/**
 * Состояние CSRF-хранилища.
 */
export interface CsrfState {
    /** Текущий CSRF-токен; null до первого получения от сервера. */
    token: string | null;
}

/**
 * Хранилище CSRF-токена приложения.
 *
 * Расширяет {@link Store}, инкапсулируя нюансы доступа к одному строковому
 * полю: вместо setState с патчем компонент-клиент работает через узкие
 * методы getToken/setToken/clear. Используется {@link HttpClient} для
 * подстановки заголовка X-CSRF-Token и его обновления после ответа 403.
 */
class CsrfStore extends Store<CsrfState> {
    constructor() {
        super({ token: null });
    }

    /** Возвращает текущий CSRF-токен или null, если он ещё не получен. */
    getToken(): string | null {
        return this.getState().token;
    }

    /**
     * Сохраняет новый CSRF-токен.
     *
     * @param token Свежий токен, полученный от сервера.
     */
    setToken(token: string): void {
        this.setState({ token });
    }

    /** Сбрасывает токен в null (например, при логауте или его отзыве). */
    clear(): void {
        this.setState({ token: null });
    }
}

/** Готовый синглтон CSRF-хранилища, общий для всего приложения. */
export const csrfStore = new CsrfStore();
export type { CsrfStore };
