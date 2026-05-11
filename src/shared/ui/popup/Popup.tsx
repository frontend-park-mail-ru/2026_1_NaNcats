/**
 * Простые модальные диалоги в стиле window.alert/confirm с собственной
 * разметкой и промис-ориентированным API.
 *
 * Класс не инстанцируется: вся работа идёт через статические alert и confirm.
 * Каждый вызов пушит свою запись в `modalStack` через `pushModal` из
 * `@shared/lib/portal` и резолвит промис, как только пользователь сделал
 * выбор (OK или Отмена) либо кликнул мимо диалога. Это даёт совместимость
 * с прежним API без императивной возни с DOM в `document.body`.
 *
 * Дисциплина реактивных выражений тут не задействована: содержимое попапа
 * статично на всё время одного показа, поэтому передаём в VDOM обычный VNode
 * без аксессоров. Реактивность сосредоточена в `<For>` внутри ModalRoot,
 * который читает modalStack и сам монтирует/размонтирует запись.
 */

import { pushModal } from '@shared/lib/portal';
import type { VNode } from '@shared/lib/vdom';

/**
 * Тип всплывающего окна.
 *
 * alert показывает только кнопку OK; confirm добавляет кнопку отмены и при
 * отказе резолвит промис в false.
 */
type PopupType = 'alert' | 'confirm';

/**
 * Простые модальные диалоги в стиле window.alert/confirm.
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
     * Собирает VNode с разметкой попапа, пушит запись в modalStack и резолвит
     * промис в `cleanup(result)`. Cleanup идемпотентен через флаг `settled`:
     * если пользователь успел кликнуть и по кнопке, и по затемнению, второе
     * срабатывание не пройдёт через `pushResult.close` и onClose-колбэк
     * выполнится ровно один раз. Это важно, потому что overlay-click и клик
     * по кнопке могут сработать в одном кадре (кнопка лежит внутри overlay).
     *
     * @param message Текст сообщения.
     * @param type Тип окна: alert или confirm.
     * @returns Промис с результатом выбора пользователя.
     */
    private static show(message: string, type: PopupType): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            let settled = false;
            let closeEntry: (() => void) | null = null;

            const finish = (result: boolean): void => {
                if (settled) return;
                settled = true;
                if (closeEntry) closeEntry();
                resolve(result);
            };

            const handleOverlayClick = (event: Event): void => {
                if (event.target !== event.currentTarget) return;
                finish(false);
            };

            const handleOk = (event: Event): void => {
                event.stopPropagation();
                finish(true);
            };

            const handleCancel = (event: Event): void => {
                event.stopPropagation();
                finish(false);
            };

            const popupVNode: VNode = (
                <div
                    class="modal-overlay modal-overlay_active"
                    style="z-index: 9999;"
                    onClick={handleOverlayClick}
                >
                    <div
                        class="address-modal"
                        style="width: 400px; padding: 30px; text-align: center; gap: 20px;"
                    >
                        <h3 style="margin: 0; font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 500; color: #0E1117;">
                            {message}
                        </h3>
                        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                            {type === 'confirm' ? (
                                <button
                                    class="button button_ghost js-popup-cancel"
                                    style="flex: 1; height: 44px; margin: 0; background: #eee; color: #333;"
                                    onClick={handleCancel}
                                >
                                    Отмена
                                </button>
                            ) : null}
                            <button
                                class="button button_primary js-popup-ok"
                                style="flex: 1; height: 44px; margin: 0;"
                                onClick={handleOk}
                            >
                                ОК
                            </button>
                        </div>
                    </div>
                </div>
            ) as VNode;

            const result = pushModal(popupVNode, () => {
                // Закрытие извне (например, чужим popModal по id): резолвим в false,
                // если ещё не разрешили промис. Повторный вызов finish безопасен.
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            });
            closeEntry = result.close;
        });
    }
}
