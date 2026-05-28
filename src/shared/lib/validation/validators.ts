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

/** Поля деталей адреса, которые проверяет {@link validateAddressDetails}. */
export interface AddressDetailsInput {
    label?: string;
    apartment?: string;
    entrance?: string;
    floor?: string;
    door_code?: string;
    courier_comment?: string;
}

/**
 * Проверяет детали адреса. Все поля необязательные, но если заполнены — должны
 * быть правдоподобными: подъезд/этаж — числа, квартира/код — короткие
 * буквенно-цифровые значения. Возвращает карту «поле → сообщение об ошибке»;
 * пустой объект означает, что всё корректно.
 *
 * @param details Значения полей формы деталей.
 * @returns Объект с ошибками по полям (пустой, если ошибок нет).
 */
export function validateAddressDetails(details: AddressDetailsInput): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmed = (v: string | undefined) => (v ?? '').trim();

    const label = trimmed(details.label);
    if (label.length > 60) errors.label = 'Не длиннее 60 символов';

    const apartment = trimmed(details.apartment);
    if (apartment !== '' && !/^[0-9a-zA-Zа-яА-Я/\- ]{1,10}$/.test(apartment)) {
        errors.apartment = 'До 10 символов: цифры и буквы';
    }

    const entrance = trimmed(details.entrance);
    if (entrance !== '' && !/^\d{1,3}$/.test(entrance)) {
        errors.entrance = 'Только число (до 3 цифр)';
    }

    const floor = trimmed(details.floor);
    if (floor !== '' && !/^-?\d{1,3}$/.test(floor)) {
        errors.floor = 'Только число';
    }

    const doorCode = trimmed(details.door_code);
    if (doorCode !== '' && !/^[0-9a-zA-Zа-яА-Я#*\- ]{1,20}$/.test(doorCode)) {
        errors.door_code = 'До 20 символов';
    }

    const comment = trimmed(details.courier_comment);
    if (comment.length > 300) errors.courier_comment = 'Не длиннее 300 символов';

    return errors;
}
