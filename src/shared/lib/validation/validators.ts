/**
 * Проверяет формат email упрощённой регуляркой (ловит грубые ошибки, не RFC).
 *
 * @param email Строка для проверки.
 * @returns true, если строка похожа на корректный email.
 */
export const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Проверяет пароль: не меньше 8 символов и без пробелов.
 *
 * @param password Строка для проверки.
 * @returns true, если пароль удовлетворяет правилам.
 */
export const validatePassword = (password: string): boolean => {
    return password.length >= 8 && !/\s/.test(password);
};

/**
 * Проверяет имя пользователя по длине: от 4 до 30 символов включительно.
 *
 * @param name Строка для проверки.
 * @returns true, если длина имени попадает в допустимый диапазон.
 */
export const validateName = (name: string): boolean => {
    return name.length >= 4 && name.length <= 30;
};
