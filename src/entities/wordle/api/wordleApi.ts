import { httpClient } from '@shared/api/http';
import type { WordleDailyState, WordleGuessResult } from '../model/types';

/**
 * REST-клиент игры «5 букв». Слово дня, лимиты и список попыток держит бэк;
 * фронт только показывает раскраску из ответа сервера.
 */
export const wordleApi = {
    /** Состояние партии текущего пользователя за сегодня. */
    getDailyState(): Promise<WordleDailyState> {
        return httpClient.getJson<WordleDailyState>('/game/wordle');
    },

    /**
     * Отправляет очередную попытку. Idempotency-Key прокидывается заголовком,
     * чтобы повторный запрос (например, после ретрая сети) не давал лишнюю
     * попытку и не задвинул статус игры дальше.
     */
    makeGuess(guess: string, idempotencyKey: string): Promise<WordleGuessResult> {
        return httpClient.postJson<WordleGuessResult>('/game/wordle/guess', { guess }, idempotencyKey);
    },
};
