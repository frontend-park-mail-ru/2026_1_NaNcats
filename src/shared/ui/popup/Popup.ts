import doT from 'dot';
import { popupTemplate } from './popup.tmpl';

type PopupType = 'alert' | 'confirm';

const render = doT.template(popupTemplate);

export class Popup {
    static alert(message: string): Promise<boolean> {
        return Popup.show(message, 'alert');
    }

    static confirm(message: string): Promise<boolean> {
        return Popup.show(message, 'confirm');
    }

    private static show(message: string, type: PopupType): Promise<boolean> {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.innerHTML = render({ message, type });
            document.body.appendChild(container);

            const overlay = container.querySelector('.modal-overlay');
            const okBtn = container.querySelector('.js-popup-ok');
            const cancelBtn = container.querySelector('.js-popup-cancel');

            const cleanup = (result: boolean): void => {
                if (document.body.contains(container)) {
                    document.body.removeChild(container);
                }
                resolve(result);
            };

            okBtn?.addEventListener('click', () => cleanup(true));
            cancelBtn?.addEventListener('click', () => cleanup(false));
            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
        });
    }
}
