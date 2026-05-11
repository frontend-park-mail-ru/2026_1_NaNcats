/**
 * Сопоставление URL с таблицей роутов и парсинг query-строки.
 *
 * Модуль намеренно простой: текущая карта роутов (ROUTES.home, ROUTES.login и
 * т.д.) состоит из статичных путей без сегментов вида `/:id`. Поэтому matchPath
 * сравнивает path с дескрипторами по точному равенству. Заготовка под
 * динамические сегменты остаётся в форме поля params: возвращается всегда,
 * хоть и пустой картой, чтобы добавление парсинга `:id` свелось к правке одной
 * этой функции, без миграции вызывающего кода.
 */

import type { RouteDescriptor } from './routes';

/**
 * Результат поиска роута: дескриптор (если нашли), карта параметров пути и
 * карта query-параметров.
 *
 * Поле route намеренно опциональное: если ни один дескриптор не подошёл,
 * вызывающий код решает сам, как обработать промах (по соглашению редиректит
 * на 404, выставляет error-состояние и т.д.).
 */
export interface MatchResult {
    /** Найденный дескриптор роута; undefined, если ни один путь не подошёл. */
    route?: RouteDescriptor;
    /** Параметры пути из динамических сегментов; сейчас всегда пусто. */
    params: Record<string, string>;
    /** Распарсенные ключ-значения из query-строки. */
    query: Record<string, string>;
}

/**
 * Парсит query-строку в плоскую карту строка-строка.
 *
 * Использует URLSearchParams: тот корректно декодирует процентные
 * последовательности и поддерживает значения без знака равенства (key= и
 * просто key трактуются как пустая строка). При повторении одного и того же
 * ключа в строке побеждает последнее значение: за этим стоит соглашение,
 * принятое в большинстве серверных роутеров, и оно совпадает с поведением
 * Object.fromEntries поверх URLSearchParams.entries.
 *
 * @param search Часть URL после знака вопроса, со знаком или без; пустая строка допустима.
 * @returns Карта ключ-значение query-параметров.
 */
function parseQuery(search: string): Record<string, string> {
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
 * Алгоритм: входная строка делится на pathname и search по первому знаку
 * вопроса, после чего pathname сравнивается с полем path каждого дескриптора
 * по точному равенству. Первый найденный совпавший роут возвращается; порядок
 * элементов routes определяет приоритет, что согласуется с привычной
 * семантикой массива маршрутов. Если совпадений нет, поле route остаётся
 * undefined, а params и query всё равно возвращаются: вызывающий код имеет
 * доступ к разобранной query независимо от факта матча.
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
