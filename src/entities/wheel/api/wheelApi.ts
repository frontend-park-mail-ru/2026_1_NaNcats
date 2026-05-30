import { httpClient } from '@shared/api/http';
import type { WheelSectorsResponse, WheelSpinResult } from '../model/types';

/**
 * REST-клиент «Колеса пиццули». Бэкенд держит секторы захардкоженным
 * списком и сам разыгрывает приз; фронт только показывает и анимирует.
 */
export const wheelApi = {
    /** Возвращает список секторов (без весов). */
    getSectors(): Promise<WheelSectorsResponse> {
        return httpClient.getJson<WheelSectorsResponse>('/profile/wheel/sectors');
    },

    /**
     * Запускает прокрутку: бэкенд проверяет кулдаун (24h), выбирает сектор
     * и опционально привязывает промокод к пользователю.
     */
    spin(): Promise<WheelSpinResult> {
        return httpClient.postJson<WheelSpinResult>('/profile/wheel/spin', {});
    },
};
