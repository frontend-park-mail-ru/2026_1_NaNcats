/**
 * Утилиты для русского склонения существительных по числам.
 */

/**
 * Возвращает форму слова для числа `n` по правилам русского языка.
 *
 * @param n Количество.
 * @param forms Тройка форм: [для 1, для 2–4, для 5–20/0]. Например
 * `['заказ', 'заказа', 'заказов']`.
 * @returns Подходящая форма слова (без самого числа).
 */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
    const abs = Math.abs(n) % 100;
    const tail = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (tail > 1 && tail < 5) return forms[1];
    if (tail === 1) return forms[0];
    return forms[2];
}
