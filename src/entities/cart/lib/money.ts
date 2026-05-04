const MICROS_PER_RUB = 1_000_000;

/**
 * Переводит сумму из микрорублей (хранимая на бэкенде единица) в рубли.
 *
 * @param micros Сумма в микрорублях.
 * @returns Сумма в рублях с дробной частью.
 */
export const fromMicros = (micros: number): number => micros / MICROS_PER_RUB;

/**
 * Переводит сумму из рублей в микрорубли с округлением до целого, чтобы
 * избежать ошибок IEEE-754 при последующих арифметических операциях.
 *
 * @param rub Сумма в рублях.
 * @returns Сумма в микрорублях.
 */
export const toMicros = (rub: number): number => Math.round(rub * MICROS_PER_RUB);

/**
 * Форматирует сумму из микрорублей в строку с двумя знаками после запятой.
 *
 * @param micros Сумма в микрорублях.
 * @returns Строка вида `"1234.50"`.
 */
export const formatRub = (micros: number): string => fromMicros(micros).toFixed(2);
