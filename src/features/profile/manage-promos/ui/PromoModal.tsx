// Модалка «Мои промокоды» для профиля: список карточек промокодов и поле
// ввода нового кода. Пока работает на моках; применение промокода и валидация
// нового кода будут проброшены в бэкенд после появления соответствующих API.

import './promoModal.scss';

import { Popup } from '@shared/ui/popup';
import { For } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { MOCK_PROMOS } from '../model/mockPromos';
import type { Promo } from '../model/types';

export interface PromoModalProps {
    /** Колбэк закрытия (нажатие на крестик). */
    onClose: () => void;
}

/** Реакция на «Применить»: пока заглушка, чтобы UI был кликабельным. */
function handleApply(promo: Promo) {
    void Popup.alert(`Промокод ${promo.code} применится на оформлении заказа`);
}

/** Реакция на «Добавить»: тоже заглушка до прихода эндпоинта валидации. */
function handleAdd() {
    void Popup.alert('Добавление промокодов скоро появится');
}

export function PromoModal(props: PromoModalProps): VNode {
    return (
        <div class="promo-modal">
            <div class="promo-modal__header">
                <div class="promo-modal__title">Мои промокоды</div>
                <button type="button" class="promo-modal__close" aria-label="Закрыть" onClick={props.onClose}>
                    ✕
                </button>
            </div>

            <div class="promo-modal__list">
                <For each={() => MOCK_PROMOS} key={(p) => p.id}>
                    {(promo) => (
                        <div
                            class={() =>
                                promo.expiringSoon === true ? 'promo-card promo-card_expiring' : 'promo-card'
                            }
                        >
                            <div class="promo-card__code">{promo.code}</div>
                            <div class="promo-card__body">
                                <div class="promo-card__title">{promo.title}</div>
                                <div class="promo-card__condition">{promo.condition}</div>
                                <div
                                    class={() =>
                                        promo.expiringSoon === true
                                            ? 'promo-card__expires promo-card__expires_soon'
                                            : 'promo-card__expires'
                                    }
                                >
                                    {() =>
                                        promo.expiringSoon === true
                                            ? (promo.expiringSoonText ?? promo.expiresAt)
                                            : promo.expiresAt
                                    }
                                </div>
                            </div>
                            <button
                                type="button"
                                class="promo-card__apply"
                                onClick={() => {
                                    handleApply(promo);
                                }}
                            >
                                Применить
                            </button>
                        </div>
                    )}
                </For>
            </div>

            <div class="promo-modal__footer">
                <input
                    type="text"
                    class="promo-modal__input"
                    placeholder="Введите промокод"
                    autocomplete="off"
                />
                <button type="button" class="promo-modal__add" onClick={handleAdd}>
                    Добавить
                </button>
            </div>
        </div>
    );
}
