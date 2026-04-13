import doT from 'dot';
import { popupTemplate } from './popup.tmpl';

export class Popup {
    /**
     * Универсальный метод показа попапа.
     * Возвращает Promise, который резолвится в true (ОК) или false (Отмена).
     */
    private static async show(message: string, type: 'alert' | 'confirm' = 'alert'): Promise<boolean> {
        return new Promise((resolve) => {
            const render = doT.template(popupTemplate);
            const html = render({ message, type });
            
            const container = document.createElement('div');
            container.innerHTML = html;
            document.body.appendChild(container);

            const overlay = container.querySelector('.modal-overlay');
            const okBtn = container.querySelector('.js-popup-ok');
            const cancelBtn = container.querySelector('.js-popup-cancel');

            // Функция закрытия с передачей результата
            const cleanup = (result: boolean) => {
                if (document.body.contains(container)) {
                    document.body.removeChild(container);
                }
                resolve(result);
            };

            okBtn?.addEventListener('click', () => cleanup(true));
            cancelBtn?.addEventListener('click', () => cleanup(false));
            
            // Закрытие по клику на фон (только для alert, либо отмена для confirm)
            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
        });
    }

    /**
     * Показывает попап с кнопками ОК и Отмена.
     */
    public static confirm(message: string): Promise<boolean> {
        return this.show(message, 'confirm');
    }

    /**
     * Показывает попап только с кнопкой ОК.
     */
    public static alert(message: string): Promise<boolean> {
        return this.show(message, 'alert');
    }
}
