/**
 * Один сектор «Колеса пиццули». Веса спрятаны на бэкенде, поэтому фронту
 * приходят только визуальные поля.
 */
export interface WheelSector {
    id: number;
    name: string;
    emoji: string;
}

/** Ответ `GET /api/profile/wheel/sectors`. */
export interface WheelSectorsResponse {
    sectors: WheelSector[];
}

/**
 * Ответ `POST /api/profile/wheel/spin`. Бэкенд решает, какой сектор выпал, и
 * опционально начисляет промокод; expires_at — ISO-строка.
 */
export interface WheelSpinResult {
    sector_id: number;
    sector_name: string;
    emoji: string;
    message: string;
    promo_code?: string;
    expires_at?: string;
}
