declare const process: {
    env: {
        YANDEX_SUGGEST_KEY?: string;
    };
};

export const env = {
    yandexSuggestKey: process.env.YANDEX_SUGGEST_KEY ?? '',
} as const;
