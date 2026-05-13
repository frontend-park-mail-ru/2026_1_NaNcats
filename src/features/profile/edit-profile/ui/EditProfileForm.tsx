import { ApiError } from '@shared/api/http';
import { onCleanup, signal } from '@shared/lib/signals';
import { validateEmail, validateName } from '@shared/lib/validation';
import { Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

import { editProfile } from '../model/editProfile';

export interface EditProfileFormProps {
    /** Текущее имя пользователя для предзаполнения. */
    name: string;
    /** Текущая почта пользователя для предзаполнения. */
    email: string;
}

export function EditProfileForm(props: EditProfileFormProps): VNode {
    // Сохранённые на сервере значения: к ним откатываемся при отмене.
    let savedName = props.name;
    let savedEmail = props.email;

    const nameValue = signal<string>(savedName);
    const emailValue = signal<string>(savedEmail);
    const isEditing = signal<boolean>(false);
    const generalError = signal<string>('');
    const submitting = signal<boolean>(false);

    let nameInputEl: HTMLInputElement | null = null;
    let emailInputEl: HTMLInputElement | null = null;

    const toggleEdit = () => {
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

    const handleSubmit = async (event: Event) => {
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
            onSubmit={(e: Event) => {
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
                        disabled={() => !isEditing()}
                        onInput={(e: Event) => {
                            nameValue.set((e.target as HTMLInputElement).value);
                        }}
                        ref={(el: Element | null) => {
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
                        disabled={() => !isEditing()}
                        onInput={(e: Event) => {
                            emailValue.set((e.target as HTMLInputElement).value);
                        }}
                        ref={(el: Element | null) => {
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

            <Show when={() => generalError() !== ''}>
                <div id="profile-error" class="error-msg">
                    {() => generalError()}
                </div>
            </Show>

            <button
                type="submit"
                id="save-profile-btn"
                class={() =>
                    isEditing() ? 'button button_primary' : 'button button_primary button_hidden'
                }
                style="height:40px; margin-top:10px;"
                disabled={submitting}
            >
                Сохранить
            </button>
        </form>
    );
}
