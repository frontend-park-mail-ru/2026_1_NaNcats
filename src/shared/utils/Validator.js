/**
 * @module Validator
 * @description Библиотека функций для валидации данных форм (email, пароли, имена).
 */

/**
 * Проверяет формат email адреса с помощью регулярного выражения.
 * 
 * @function validateEmail
 * @param {string} email - Строка для проверки.
 * @returns {boolean} True, если формат соответствует стандарту (user@domain.com).
 * 
 * @example
 * validateEmail('test@mail.ru'); // true
 * validateEmail('invalid-email'); // false
 */
export const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Проверяет пароль на соответствие требованиям безопасности.
 * Требования: не менее 8 символов и отсутствие пробельных символов.
 * 
 * @function validatePassword
 * @param {string} password - Пароль для проверки.
 * @returns {boolean} True, если пароль соответствует требованиям.
 */
export const validatePassword = (password) => {
    return password.length >= 8 && !/\s/.test(password);
};

/**
 * Проверяет длину имени пользователя.
 * Требования: от 4 до 30 символов включительно.
 * 
 * @function validateName
 * @param {string} name - Имя для проверки.
 * @returns {boolean} True, если длина имени в допустимых пределах.
 */
export const validateName = (name) => {
    return name.length >= 4 && name.length <= 30;
};
