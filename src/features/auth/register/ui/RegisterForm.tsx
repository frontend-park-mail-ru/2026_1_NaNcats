import { ApiError } from '@shared/api/http';
import { signal } from '@shared/lib/signals';
import { validateEmail, validateName, validatePassword } from '@shared/lib/validation';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { registerAction } from '../model/registerAction';

export interface RegisterFormProps {
    /** Колбэк, вызываемый после успешной регистрации. */
    onSuccess?: () => void;
}

type RegisterErrorKey = 'name' | 'email' | 'password' | 'repeatPassword';

/** Сообщения об ошибках по полям формы. */
type RegisterErrors = Partial<Record<RegisterErrorKey, string>>;

export function RegisterForm(props: RegisterFormProps): VNode {
    const name = signal<string>('');
    const email = signal<string>('');
    const password = signal<string>('');
    const repeatPassword = signal<string>('');
    const errors = signal<RegisterErrors>({});
    const submitting = signal<boolean>(false);
    const showPassword = signal<boolean>(false);
    const showRepeatPassword = signal<boolean>(false);

    const handleSubmit = async (event: Event) => {
        event.preventDefault();
        if (submitting.peek()) return;

        const nameValue = name.peek().trim();
        const emailValue = email.peek().trim();
        const passwordValue = password.peek();
        const repeatValue = repeatPassword.peek();

        const nextErrors: RegisterErrors = {};

        if (!nameValue) nextErrors.name = 'Введите имя';
        if (!emailValue) nextErrors.email = 'Введите почту';
        if (!passwordValue) nextErrors.password = 'Введите пароль';
        if (!repeatValue) nextErrors.repeatPassword = 'Повторите пароль';

        if (Object.keys(nextErrors).length > 0) {
            errors.set(nextErrors);
            return;
        }

        if (!validateName(nameValue)) {
            nextErrors.name = 'Имя должно быть от 4 до 30 символов';
        }
        if (!validateEmail(emailValue)) {
            nextErrors.email = 'Неверный формат почты';
        }
        if (!validatePassword(passwordValue)) {
            nextErrors.password = 'Пароль от 8 символов без пробелов';
        }
        if (passwordValue !== repeatValue) {
            nextErrors.repeatPassword = 'Пароли не совпадают';
        }

        if (Object.keys(nextErrors).length > 0) {
            errors.set(nextErrors);
            return;
        }

        errors.set({});
        submitting.set(true);
        try {
            await registerAction({ name: nameValue, email: emailValue, password: passwordValue });
            props.onSuccess?.();
        } catch (e) {
            if (e instanceof ApiError) {
                if (e.status === 409) {
                    errors.set({ email: 'Эта почта уже зарегистрирована' });
                } else {
                    errors.set({ name: 'Ошибка регистрации: ' + e.message });
                }
            } else {
                errors.set({ name: 'Ошибка сети' });
            }
        } finally {
            submitting.set(false);
        }
    };

    return (
        <form
            id="auth-form"
            class="auth-form"
            onSubmit={(e: Event) => {
                void handleSubmit(e);
            }}
        >
            <div class="input-group">
                <label for="name">Имя</label>
                <input
                    class="input-field"
                    type="text"
                    name="name"
                    id="name"
                    placeholder="Ваше имя"
                    value={name.peek()}
                    onInput={(e: Event) => {
                        name.set((e.target as HTMLInputElement).value);
                    }}
                />
                <Show when={() => errors().name !== undefined}>
                    <span id="name-error" class="error-msg">
                        {() => errors().name ?? ''}
                    </span>
                </Show>
            </div>

            <div class="input-group">
                <label for="email">Почта</label>
                <input
                    class="input-field"
                    type="email"
                    name="email"
                    id="email"
                    placeholder="Example@mail.com"
                    value={email.peek()}
                    onInput={(e: Event) => {
                        email.set((e.target as HTMLInputElement).value);
                    }}
                />
                <Show when={() => errors().email !== undefined}>
                    <span id="email-error" class="error-msg">
                        {() => errors().email ?? ''}
                    </span>
                </Show>
            </div>

            <div class="input-group">
                <label for="password">Пароль</label>
                <div class="password-wrapper">
                    <input
                        class="input-field"
                        type={() => (showPassword() ? 'text' : 'password')}
                        name="password"
                        id="password"
                        placeholder="Пароль"
                        value={password.peek()}
                        onInput={(e: Event) => {
                            password.set((e.target as HTMLInputElement).value);
                        }}
                    />
                    <div
                        class={() =>
                            showPassword()
                                ? 'password-wrapper__icon password-wrapper__icon_visible'
                                : 'password-wrapper__icon'
                        }
                        onClick={() => {
                            showPassword.set((prev) => !prev);
                        }}
                    />
                </div>
                <Show when={() => errors().password !== undefined}>
                    <span id="password-error" class="error-msg">
                        {() => errors().password ?? ''}
                    </span>
                </Show>
            </div>

            <div class="input-group">
                <label for="repeatPassword">Повторите пароль</label>
                <div class="password-wrapper">
                    <input
                        class="input-field"
                        type={() => (showRepeatPassword() ? 'text' : 'password')}
                        name="repeatPassword"
                        id="repeatPassword"
                        placeholder="Повторите пароль"
                        value={repeatPassword.peek()}
                        onInput={(e: Event) => {
                            repeatPassword.set((e.target as HTMLInputElement).value);
                        }}
                    />
                    <div
                        class={() =>
                            showRepeatPassword()
                                ? 'password-wrapper__icon password-wrapper__icon_visible'
                                : 'password-wrapper__icon'
                        }
                        onClick={() => {
                            showRepeatPassword.set((prev) => !prev);
                        }}
                    />
                </div>
                <Show when={() => errors().repeatPassword !== undefined}>
                    <span id="repeatPassword-error" class="error-msg">
                        {() => errors().repeatPassword ?? ''}
                    </span>
                </Show>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="terms" required />
                <label for="terms">
                    Я согласен с <span class="secondary-link">условиями использования</span> и{' '}
                    <span class="secondary-link">политикой конфиденциальности</span>
                </label>
            </div>

            <button type="submit" class="button button_primary" disabled={submitting}>
                Зарегистрироваться
            </button>
        </form>
    );
}
