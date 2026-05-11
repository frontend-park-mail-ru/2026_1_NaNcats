/**
 * Форма редактирования профиля на JSX/VDOM.
 *
 * Поведение перенесено из старого `EditProfileForm.ts` 1:1: поля имени и
 * почты по умолчанию заблокированы и переключаются в режим редактирования
 * по клику на триггер. Сохранение валидирует значения и вызывает
 * {@link editProfile}; ошибки валидации, конфликт почты (HTTP 409), прочие
 * ответы сервера и сетевые сбои отображаются в служебном блоке.
 *
 * Локальное состояние формы хранится в сигналах: текущие значения полей,
 * флаг режима редактирования, текст служебной ошибки и флаг блокировки на
 * время запроса.
 *
 * Дисциплина реактивных выражений (см. JSDoc в `vdom/show.tsx`). Реактивные
 * пропсы и условия передаются как функции-аксессоры:
 * `disabled={() => !isEditing()}`, `class={() => isEditing() ? ... : ...}`,
 * `when={() => generalError() !== ''}`.
 *
 * При выходе из режима редактирования без сохранения текущие значения полей
 * откатываются к исходным пропсам. Чтобы это видимым образом отразилось на
 * DOM-узлах (атрибут `value` через setAttribute меняет лишь дефолтное
 * значение инпута, а не текущее), мы держим ref на каждый инпут и
 * перезаписываем `.value` напрямую: тот же приём используется в Header.
 */

import { ApiError } from '@shared/api/http';
import { onCleanup, signal } from '@shared/lib/signals';
import { validateEmail, validateName } from '@shared/lib/validation';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { editProfile } from '../model/editProfile';

/**
 * Параметры формы редактирования профиля.
 */
export interface EditProfileFormProps {
    /** Текущее имя пользователя для предзаполнения. */
    name: string;
    /** Текущая почта пользователя для предзаполнения. */
    email: string;
}

/**
 * Форма редактирования профиля.
 *
 * @param props Пропсы формы (начальные значения имени и почты).
 * @returns VNode-дерево формы.
 */
export function EditProfileForm(props: EditProfileFormProps): VNode {
    /** Сохранённые на сервере значения: к ним откатываемся при отмене. */
    let savedName = props.name;
    let savedEmail = props.email;

    const nameValue = signal<string>(savedName);
    const emailValue = signal<string>(savedEmail);
    const isEditing = signal<boolean>(false);
    const generalError = signal<string>('');
    const submitting = signal<boolean>(false);

    let nameInputEl: HTMLInputElement | null = null;
    let emailInputEl: HTMLInputElement | null = null;

    /**
     * Переключает режим редактирования. Вход в режим фокусирует поле имени;
     * выход без сохранения откатывает значения полей к последним сохранённым.
     */
    const toggleEdit = (): void => {
        const next = !isEditing.peek();
        isEditing.set(next);
        if (next) {
            nameInputEl?.focus();
            return;
        }
        // Отмена редактирования: возвращаем сигналы и DOM-инпуты к savedName/savedEmail.
        nameValue.set(savedName);
        emailValue.set(savedEmail);
        if (nameInputEl !== null) nameInputEl.value = savedName;
        if (emailInputEl !== null) emailInputEl.value = savedEmail;
        generalError.set('');
    };

    /**
     * Обработчик submit формы: валидирует значения и сохраняет изменения.
     *
     * При успехе обновляет внутренние savedName/savedEmail и выходит из
     * режима редактирования, чтобы повторное переключение возвращало уже
     * новые значения.
     *
     * @param event Событие submit формы.
     */
    const handleSubmit = async (event: Event): Promise<void> => {
        event.preventDefault();
        if (submitting.peek()) return;

        const name = nameValue.peek().trim();
        const email = emailValue.peek().trim();
        generalError.set('');

        if (!validateName(name)) {
            generalError.set('Имя должно быть от 4 до 30 символов');
            return;
        }
        if (!validateEmail(email)) {
            generalError.set('Неверный формат почты');
            return;
        }

        submitting.set(true);
        try {
            await editProfile({ name, email });
            savedName = name;
            savedEmail = email;
            isEditing.set(false);
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                generalError.set('Этот email уже используется');
            } else if (e instanceof ApiError) {
                generalError.set(e.message || 'Ошибка обновления');
            } else {
                generalError.set('Ошибка соединения');
            }
        } finally {
            submitting.set(false);
        }
    };

    onCleanup(() => {
        nameInputEl = null;
        emailInputEl = null;
    });

    return (
        <form
            class="edit-profile-form"
            onSubmit={(e: Event): void => {
                void handleSubmit(e);
            }}
        >
            <div class="info-group">
                <label class="info-label">Имя</label>
                <div class="info-row">
                    <input
                        id="profile-name"
                        name="name"
                        class="profile-input profile-input_email"
                        type="text"
                        value={savedName}
                        disabled={(): boolean => !isEditing()}
                        onInput={(e: Event): void => {
                            nameValue.set((e.target as HTMLInputElement).value);
                        }}
                        ref={(el: Element | null): void => {
                            nameInputEl = el as HTMLInputElement | null;
                        }}
                    />
                    <div class="edit-icon-orange" onClick={toggleEdit} />
                </div>
            </div>

            <div class="info-group">
                <label class="info-label">Почта</label>
                <div class="info-row">
                    <input
                        id="profile-email"
                        name="email"
                        class="profile-input profile-input_email"
                        type="email"
                        value={savedEmail}
                        disabled={(): boolean => !isEditing()}
                        onInput={(e: Event): void => {
                            emailValue.set((e.target as HTMLInputElement).value);
                        }}
                        ref={(el: Element | null): void => {
                            emailInputEl = el as HTMLInputElement | null;
                        }}
                    />
                    <div class="edit-icon-orange" onClick={toggleEdit} />
                </div>
            </div>

            <div class="info-group">
                <label class="info-label">Подписка</label>
                <div class="subscription-status">Обычная</div>
                <div class="subscription-text">
                    Оформи подписку <span class="link-orange">Премиум</span> для дополнительных
                    бонусов и привилегий
                </div>
            </div>

            <Show when={(): boolean => generalError() !== ''}>
                <div id="profile-error" class="error-msg">
                    {(): string => generalError()}
                </div>
            </Show>

            <button
                type="submit"
                id="save-profile-btn"
                class={(): string =>
                    isEditing() ? 'button button_primary' : 'button button_primary button_hidden'
                }
                style="height:40px; margin-top:10px;"
                disabled={submitting}
            >
                Сохранить
            </button>
        </form>
    ) as VNode;
}
