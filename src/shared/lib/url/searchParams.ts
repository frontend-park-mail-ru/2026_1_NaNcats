/**
 * Возвращает значение query-параметра из текущего URL окна.
 *
 * @param name Имя параметра.
 * @returns Значение параметра или null, если он отсутствует.
 */
export const getQueryParam = (name: string): string | null => {
    return new URLSearchParams(window.location.search).get(name);
};
