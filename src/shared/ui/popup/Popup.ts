import doT from 'dot';
import { popupTemplate } from './popup.tmpl';

/**
 * Тип всплывающего окна: alert показывает только кнопку OK, confirm добавляет
 * кнопку отмены. Влияет на разметку, которую выбирает шаблон.
 */
type PopupType = 'alert' | 'confirm';

const render = doT.template(popupTemplate);

/**
 * Простые модальные диалоги в стиле window.alert/confirm, но с собственной
 * разметкой и промис-ориентированным API.
 *
 * Класс не инстанцируется: вся работа идёт через статические alert и confirm.
 * Каждый вызов создаёт свой контейнер в document.body и удаляет его после
 * выбора пользователя или клика по затемнению, чтобы окна не мешали друг
 * другу при последовательных вызовах.
 */
export class Popup {
    /**
     * Показывает информационное окно с одной кнопкой OK.
     *
     * @param message Сообщение для пользователя.
     * @returns Промис, который разрешается true после нажатия OK.
     */
    static alert(message: string): Promise<boolean> {
        return Popup.show(message, 'alert');
    }

    /**
     * Показывает диалог подтверждения с кнопками OK и Отмена.
     *
     * @param message Вопрос для пользователя.
     * @returns Промис, разрешающийся true при подтверждении и false при
     *   отмене либо клике мимо диалога.
     */
    static confirm(message: string): Promise<boolean> {
        return Popup.show(message, 'confirm');
    }

    /**
     * Общая реализация alert и confirm.
     *
     * Рендерит шаблон в новый контейнер, навешивает обработчики на кнопки и
     * на overlay, а после выбора удаляет контейнер из DOM и резолвит промис.
     *
     * @param message Текст сообщения.
     * @param type Тип окна: alert или confirm.
     * @returns Промис с результатом выбора пользователя.
     */
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
