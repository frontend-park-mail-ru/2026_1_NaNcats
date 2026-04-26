export const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePassword = (password: string): boolean => {
    return password.length >= 8 && !/\s/.test(password);
};

export const validateName = (name: string): boolean => {
    return name.length >= 4 && name.length <= 30;
};
