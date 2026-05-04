declare const process: {
    env: {
        YANDEX_SUGGEST_KEY?: string;
    };
};

/**
 * Конфигурация окружения, видимая клиентскому коду.
 *
 * Поля читаются из process.env на этапе сборки и приводятся к строкам, чтобы
 * остальной код не повторял проверки на undefined. Объект помечен as const,
 * чтобы зафиксировать литеральные типы и предотвратить случайные мутации.
 */
export const env = {
    /** Ключ API Яндекс.Подсказок; пустая строка означает, что подсказки выключены. */
    yandexSuggestKey: process.env.YANDEX_SUGGEST_KEY ?? '',
} as const;
