const MICROS_PER_RUB = 1_000_000;

export const fromMicros = (micros: number): number => micros / MICROS_PER_RUB;

export const toMicros = (rub: number): number => Math.round(rub * MICROS_PER_RUB);

export const formatRub = (micros: number): string => fromMicros(micros).toFixed(2);
