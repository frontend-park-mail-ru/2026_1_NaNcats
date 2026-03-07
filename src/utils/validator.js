/**
 * Проверка email регулярным выражением
 * @param {string} email 
 * @returns {boolean}
 */
export const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Проверка пароля: минимум 8 символов, без пробелов
 */
export const validatePassword = (password) => {
    return password.length >= 8 && !/\s/.test(password);
};

/**
 * Проверка имени: от 4 до 30 символов
 */
export const validateName = (name) => {
    return name.length >= 4 && name.length <= 30;
};