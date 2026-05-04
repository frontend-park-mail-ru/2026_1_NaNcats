import { Component } from '@shared/lib/component';
import { logoutAction } from '../model/logoutAction';

/**
 * Параметры кнопки выхода из учётной записи.
 */
export interface LogoutButtonProps {
    /** Колбэк, вызываемый после успешного выхода. */
    onLoggedOut?: () => void;
    /** Текст подписи кнопки; по умолчанию `Выйти`. */
    label?: string;
}

const TEMPLATE = `<button class="button button_secondary js-logout-btn" id="logout-btn">{{= it.label || 'Выйти' }}</button>`;

/**
 * Кнопка выхода из учётной записи: на время запроса блокирует себя, чтобы
 * исключить повторные клики, и вызывает {@link logoutAction}.
 */
export class LogoutButton extends Component<LogoutButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

    /**
     * Подписывает обработчик клика, выполняющий выход.
     */
    protected onMount(): void {
        const btn = this.root?.querySelector('button');
        if (!btn) return;
        this.on(btn, 'click', async () => {
            (btn as HTMLButtonElement).disabled = true;
            try {
                await logoutAction();
                this.props.onLoggedOut?.();
            } finally {
                (btn as HTMLButtonElement).disabled = false;
            }
        });
    }
}
