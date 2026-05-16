/**
 * Сопоставление URL с таблицей роутов и парсинг query-строки.
 *
 * Текущие пути статичны (без сегментов вида `/:id`), поэтому matchPath сравнивает
 * pathname с дескрипторами по точному равенству. params возвращается всегда (пока
 * пустой картой) как заготовка под динамические сегменты.
 */

import type { RouteDescriptor } from './routes';

/** Результат поиска роута: дескриптор (если нашли), карта params и карта query. route опционален. */
export interface MatchResult {
    /** Найденный дескриптор роута; undefined, если ни один путь не подошёл. */
    route?: RouteDescriptor;
    /** Параметры пути из динамических сегментов; сейчас всегда пусто. */
    params: Record<string, string>;
    /** Распарсенные ключ-значения из query-строки. */
    query: Record<string, string>;
}

/**
 * Парсит query-строку в плоскую карту строка-строка через URLSearchParams.
 *
 * При повторении ключа побеждает последнее значение (как у большинства серверных роутеров).
 *
 * @param search Часть URL после знака вопроса, со знаком или без; пустая строка допустима.
 * @returns Карта ключ-значение query-параметров.
 */
function parseQuery(search: string) {
    const trimmed = search.startsWith('?') ? search.slice(1) : search;
    if (trimmed.length === 0) {
        return {};
    }
    const params = new URLSearchParams(trimmed);
    const out: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
        out[key] = value;
    }
    return out;
}

/**
 * Ищет роут, соответствующий пути, и разбирает query.
 *
 * pathname сравнивается с полем path каждого дескриптора по точному равенству;
 * порядок routes определяет приоритет. Если совпадений нет, route остаётся
 * undefined, а params и query всё равно возвращаются.
 *
 * @param path Полный путь (может содержать query-часть после вопросительного знака).
 * @param routes Таблица дескрипторов роутов, в порядке приоритета.
 * @returns Результат с дескриптором (или без), картами params и query.
 */
export function matchPath(path: string, routes: readonly RouteDescriptor[]): MatchResult {
    const questionIndex = path.indexOf('?');
    const pathname = questionIndex >= 0 ? path.slice(0, questionIndex) : path;
    const search = questionIndex >= 0 ? path.slice(questionIndex) : '';

    const query = parseQuery(search);
    const params: Record<string, string> = {};

    for (const route of routes) {
        if (route.path === pathname) {
            return { route, params, query };
        }
    }

    return { params, query };
}
