import { Component } from '@shared/lib/component';
import { FormErrors } from '@shared/lib/formErrors';
import { validateEmail, validateName } from '@shared/lib/validation';
import { ApiError } from '@shared/api/http';
import { editProfile } from '../model/editProfile';
import { editProfileFormTemplate } from './editProfileForm.tmpl.js';

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
 * Поля имени и почты по умолчанию заблокированы и переключаются в режим
 * редактирования по клику на триггер. Сохранение валидирует значения и
 * вызывает {@link editProfile}; ошибки валидации, конфликта почты (HTTP 409),
 * прочие ответы сервера и сетевые сбои отображаются в служебном блоке.
 */
export class EditProfileForm extends Component<EditProfileFormProps> {
    private isEditing = false;
    private formErrors: FormErrors | null = null;

    constructor() {
        super(editProfileFormTemplate);
    }

    /**
     * Привязывает переключение режима редактирования и обработчик отправки
     * формы.
     */
    protected onMount(): void {
        if (!this.root) return;
        this.formErrors = new FormErrors(this.root);

        const form = this.root.querySelector('form') as HTMLFormElement | null;
        const nameInput = this.root.querySelector('#profile-name') as HTMLInputElement | null;
        const emailInput = this.root.querySelector('#profile-email') as HTMLInputElement | null;
        const saveBtn = this.root.querySelector('#save-profile-btn') as HTMLButtonElement | null;
        if (!form || !nameInput || !emailInput || !saveBtn) return;

        const toggleEdit = (): void => {
            this.isEditing = !this.isEditing;
            nameInput.disabled = !this.isEditing;
            emailInput.disabled = !this.isEditing;
            if (this.isEditing) {
                nameInput.focus();
                saveBtn.classList.remove('button_hidden');
            } else {
                saveBtn.classList.add('button_hidden');
                nameInput.value = this.props.name;
                emailInput.value = this.props.email;
            }
        };

        this.root.querySelectorAll('.js-edit-trigger').forEach((btn) => {
            this.on(btn, 'click', toggleEdit);
        });

        this.on(form, 'submit', (e) => {
            e.preventDefault();
            void this.save(nameInput.value.trim(), emailInput.value.trim());
        });
    }

    /**
     * Валидирует значения и сохраняет изменения профиля.
     *
     * При успехе обновляет props компонента, чтобы дальнейшее переключение
     * режима возвращало уже новые значения.
     *
     * @param name Новое имя пользователя.
     * @param email Новая почта пользователя.
     */
    private async save(name: string, email: string): Promise<void> {
        if (!this.formErrors) return;
        this.formErrors.clearErrors();
        this.showError('');

        if (!validateName(name)) return this.showError('Имя должно быть от 4 до 30 символов');
        if (!validateEmail(email)) return this.showError('Неверный формат почты');

        try {
            await editProfile({ name, email });
            this.update({ name, email });
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                this.showError('Этот email уже используется');
            } else if (e instanceof ApiError) {
                this.showError(e.message || 'Ошибка обновления');
            } else {
                this.showError('Ошибка соединения');
            }
        }
    }

    /**
     * Выводит сообщение в служебный блок ошибок формы. Пустая строка скрывает
     * предыдущее сообщение.
     *
     * @param msg Текст сообщения об ошибке.
     */
    private showError(msg: string): void {
        const errBlock = this.root?.querySelector('#profile-error') as HTMLElement | null;
        if (errBlock) errBlock.innerText = msg;
    }
}
