import { Component } from '@shared/lib/component';
import { logoutAction } from '../model/logoutAction';

export interface LogoutButtonProps {
    onLoggedOut?: () => void;
    label?: string;
}

const TEMPLATE = `<button class="button button_secondary js-logout-btn" id="logout-btn">{{= it.label || 'Выйти' }}</button>`;

export class LogoutButton extends Component<LogoutButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

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
