/**
 * Форма регистрации на JSX/VDOM.
 *
 * Поведение перенесено из старого `RegisterForm.ts` 1:1: проверка имени,
 * почты, пароля и его подтверждения, отправка через {@link registerAction}
 * и отображение ошибок валидации и сервера. Каждое поле живёт в своём
 * сигнале, словарь ошибок в общем сигнале `errors`.
 *
 * Дисциплина реактивных выражений (см. JSDoc в `vdom/show.tsx`). Реактивные
 * пропсы и условия передаются как функции-аксессоры:
 * `disabled={submitting}`, `when={() => errors().email !== undefined}`,
 * `type={() => showPassword() ? 'text' : 'password'}`.
 *
 * Видимость каждого пароля переключается своим сигналом, чтобы не было
 * связанности между двумя визуально независимыми инпутами.
 */

import { ApiError } from '@shared/api/http';
import { signal } from '@shared/lib/signals';
import { validateEmail, validateName, validatePassword } from '@shared/lib/validation';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { registerAction } from '../model/registerAction';

/**
 * Параметры формы регистрации.
 */
export interface RegisterFormProps {
    /** Колбэк, вызываемый после успешной регистрации. */
    onSuccess?: () => void;
}

/** Идентификаторы полей формы регистрации, для которых может быть ошибка. */
type RegisterErrorKey = 'name' | 'email' | 'password' | 'repeatPassword';

/**
 * Словарь сообщений об ошибках по идентификатору поля. Отсутствующий ключ
 * означает, что у поля нет ошибки.
 */
type RegisterErrors = Partial<Record<RegisterErrorKey, string>>;

/**
 * Форма регистрации: валидирует значения, отправляет данные через
 * {@link registerAction} и показывает ошибки.
 *
 * @param props Пропсы формы.
 * @returns VNode-дерево формы.
 */
export function RegisterForm(props: RegisterFormProps): VNode {
    const name = signal<string>('');
    const email = signal<string>('');
    const password = signal<string>('');
    const repeatPassword = signal<string>('');
    const errors = signal<RegisterErrors>({});
    const submitting = signal<boolean>(false);
    const showPassword = signal<boolean>(false);
    const showRepeatPassword = signal<boolean>(false);

    /**
     * Обработчик submit формы: валидирует поля и выполняет регистрацию.
     *
     * При невалидных данных собирает сообщения по всем полям сразу. Конфликт
     * почты (HTTP 409) отображается у поля email; прочие ошибки сервера и
     * сетевые сбои отображаются у поля name.
     *
     * @param event Событие submit формы.
     */
    const handleSubmit = async (event: Event): Promise<void> => {
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
            onSubmit={(e: Event): void => {
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
                    onInput={(e: Event): void => {
                        name.set((e.target as HTMLInputElement).value);
                    }}
                />
                <Show when={(): boolean => errors().name !== undefined}>
                    <span id="name-error" class="error-msg">
                        {(): string => errors().name ?? ''}
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
                    onInput={(e: Event): void => {
                        email.set((e.target as HTMLInputElement).value);
                    }}
                />
                <Show when={(): boolean => errors().email !== undefined}>
                    <span id="email-error" class="error-msg">
                        {(): string => errors().email ?? ''}
                    </span>
                </Show>
            </div>

            <div class="input-group">
                <label for="password">Пароль</label>
                <div class="password-wrapper">
                    <input
                        class="input-field"
                        type={(): string => (showPassword() ? 'text' : 'password')}
                        name="password"
                        id="password"
                        placeholder="Пароль"
                        value={password.peek()}
                        onInput={(e: Event): void => {
                            password.set((e.target as HTMLInputElement).value);
                        }}
                    />
                    <div
                        class={(): string =>
                            showPassword()
                                ? 'password-wrapper__icon password-wrapper__icon_visible'
                                : 'password-wrapper__icon'
                        }
                        onClick={(): void => {
                            showPassword.set((prev) => !prev);
                        }}
                    />
                </div>
                <Show when={(): boolean => errors().password !== undefined}>
                    <span id="password-error" class="error-msg">
                        {(): string => errors().password ?? ''}
                    </span>
                </Show>
            </div>

            <div class="input-group">
                <label for="repeatPassword">Повторите пароль</label>
                <div class="password-wrapper">
                    <input
                        class="input-field"
                        type={(): string => (showRepeatPassword() ? 'text' : 'password')}
                        name="repeatPassword"
                        id="repeatPassword"
                        placeholder="Повторите пароль"
                        value={repeatPassword.peek()}
                        onInput={(e: Event): void => {
                            repeatPassword.set((e.target as HTMLInputElement).value);
                        }}
                    />
                    <div
                        class={(): string =>
                            showRepeatPassword()
                                ? 'password-wrapper__icon password-wrapper__icon_visible'
                                : 'password-wrapper__icon'
                        }
                        onClick={(): void => {
                            showRepeatPassword.set((prev) => !prev);
                        }}
                    />
                </div>
                <Show when={(): boolean => errors().repeatPassword !== undefined}>
                    <span id="repeatPassword-error" class="error-msg">
                        {(): string => errors().repeatPassword ?? ''}
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
    ) as VNode;
}
