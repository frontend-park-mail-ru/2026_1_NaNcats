/**
 * Проверка email регулярным выражением
 * @param {string} email 
 * @returns {boolean}
 */
export const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Простая проверка пароля
 * @param {string} password 
 * @returns {boolean}
 */
export const validatePassword = (password) => {
    return password.length >= 6;
};