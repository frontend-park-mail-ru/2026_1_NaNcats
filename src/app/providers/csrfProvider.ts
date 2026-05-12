import { httpClient } from '@shared/api/http';

/**
 * Запрашивает первичный CSRF-токен и сохраняет его в HTTP-клиенте.
 *
 * Вызывается на старте. Сетевая ошибка не пробрасывается: приложение должно
 * стартовать даже при недоступном эндпоинте, проблема логируется и проявится
 * позже на конкретном защищённом запросе.
 */
export const initCsrf = async (): Promise<void> => {
    try {
        await httpClient.fetchCsrf();
    } catch (e) {
        console.warn('csrfProvider: fetchCsrf failed', e);
    }
};
