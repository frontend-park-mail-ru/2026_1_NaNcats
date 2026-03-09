/**
 * @module Validators
 * @description Функции для валидации пользовательского ввода.
 */

/**
 * Проверка email регулярным выражением.
 * @param {string} email - Строка для проверки.
 * @returns {boolean} - true, если email корректен.
 */
export const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Проверка пароля на соответствие требованиям безопасности.
 * Минимум 8 символов, отсутствие пробелов.
 * @param {string} password - Пароль.
 * @returns {boolean} - true, если пароль корректен.
 */
export const validatePassword = (password) => {
    return password.length >= 8 && !/\s/.test(password);
};

/**
 * Проверка корректности имени пользователя.
 * @param {string} name - Имя.
 * @returns {boolean} - true, если длина от 4 до 30 символов.
 */
export const validateName = (name) => {
    return name.length >= 4 && name.length <= 30;
};