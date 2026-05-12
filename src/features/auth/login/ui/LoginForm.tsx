import { ApiError } from '@shared/api/http';
import { signal } from '@shared/lib/signals';
import { validateEmail } from '@shared/lib/validation';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { loginAction } from '../model/loginAction';

export interface LoginFormProps {
    /** Колбэк, вызываемый после успешной авторизации. */
    onSuccess?: () => void;
}

/** Сообщения об ошибках по полям формы. */
type LoginErrors = Partial<Record<'email' | 'password', string>>;

export function LoginForm(props: LoginFormProps): VNode {
    const email = signal<string>('');
    const password = signal<string>('');
    const errors = signal<LoginErrors>({});
    const submitting = signal<boolean>(false);
    const showPassword = signal<boolean>(false);

    const handleSubmit = async (event: Event): Promise<void> => {
        event.preventDefault();
        if (submitting.peek()) return;

        const emailValue = email.peek().trim();
        const passwordValue = password.peek();
        const nextErrors: LoginErrors = {};

        if (!emailValue) nextErrors.email = 'Введите почту';
        if (!passwordValue) nextErrors.password = 'Введите пароль';
        if (!nextErrors.email && !validateEmail(emailValue)) {
            nextErrors.email = 'Некорректный формат почты';
        }
        if (nextErrors.email !== undefined || nextErrors.password !== undefined) {
            errors.set(nextErrors);
            return;
        }

        errors.set({});
        submitting.set(true);
        try {
            await loginAction(emailValue, passwordValue);
            props.onSuccess?.();
        } catch (e) {
            if (e instanceof ApiError) {
                if (e.message === 'Invalid email or password') {
                    errors.set({ password: 'Неверная почта или пароль' });
                } else {
                    errors.set({ password: 'Ошибка входа: ' + e.message });
                }
            } else {
                errors.set({ email: 'Проблема с соединением' });
            }
        } finally {
            submitting.set(false);
        }
    };

    const togglePassword = (): void => {
        showPassword.set((prev) => !prev);
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
                <label for="email">Почта</label>
                <input
                    type="email"
                    class="input-field"
                    name="email"
                    id="email"
                    placeholder="Example@mail.com"
                    value={email.peek()}
                    onInput={(e: Event): void => {
                        email.set((e.target as HTMLInputElement).value);
                    }}
                />
                <Show when={(): boolean => errors().email !== undefined}>
                    <div id="email-error" class="error-msg">
                        {(): string => errors().email ?? ''}
                    </div>
                </Show>
            </div>

            <div class="input-group">
                <div class="label-row">
                    <label for="password">Пароль</label>
                    <a href="#" class="secondary-link">
                        Забыли пароль?
                    </a>
                </div>
                <div class="password-wrapper">
                    <input
                        type={(): string => (showPassword() ? 'text' : 'password')}
                        class="input-field"
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
                        onClick={togglePassword}
                    />
                </div>
                <Show when={(): boolean => errors().password !== undefined}>
                    <div id="password-error" class="error-msg">
                        {(): string => errors().password ?? ''}
                    </div>
                </Show>
            </div>

            <button type="submit" class="button button_primary" disabled={submitting}>
                Войти
            </button>
        </form>
    ) as VNode;
}
