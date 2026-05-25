// Модалка «Мои промокоды» для профиля: список карточек промокодов и поле
// ввода нового кода. Применённый промокод обводится зелёным, обычный —
// оранжевым, а истекающий — красным.

import './promoModal.scss';

import { Popup } from '@shared/ui/popup';
import { For, onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { signal } from '@shared/lib/signals';
import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { promosAccessor, appliedCodeAccessor, tryApplyPromo, addPromo, loadPromos } from '../model/promoStore';
import { promoReasonToMessage } from '../lib/promoMessage';
import type { Promo } from '../model/types';

export interface PromoModalProps {
    onClose: () => void;
}

async function handleApply(promo: Promo, onClose: () => void) {
    const res = await tryApplyPromo(promo.code);
    if (!res.ok) {
        void Popup.alert(promoReasonToMessage(res.reason));
        return;
    }
    // Промокод применён — предлагаем сразу перейти к оформлению, чтобы не
    // заставлять пользователя самому искать корзину после применения.
    const goToCheckout = await Popup.confirm(`Промокод ${promo.code} применён к корзине. Перейти к оформлению заказа?`);
    if (goToCheckout) {
        onClose();
        void router.go(ROUTES.checkout);
    }
}

export function PromoModal(props: PromoModalProps): VNode {
    const inputValue = signal<string>('');
    let inputEl: HTMLInputElement | null = null;

    onMount(() => {
        void loadPromos();
    });

    const handleAdd = async () => {
        const code = inputValue.peek().trim();
        if (!code) return;
        const ok = await addPromo(code);
        if (ok) {
            inputValue.set('');
            if (inputEl) inputEl.value = '';
        } else {
            void Popup.alert('Промокод не найден или уже добавлен');
        }
    };

    const cardClass = (promo: Promo) => {
        const applied = appliedCodeAccessor();
        if (applied === promo.code) return 'promo-card promo-card_applied';
        if (promo.expiringSoon === true) return 'promo-card promo-card_expiring';
        return 'promo-card';
    };

    const codeClass = (promo: Promo) => {
        const applied = appliedCodeAccessor();
        if (applied === promo.code) return 'promo-card__code promo-card__code_applied';
        if (promo.expiringSoon === true) return 'promo-card__code promo-card__code_expiring';
        return 'promo-card__code';
    };

    const expiresClass = (promo: Promo) => {
        if (promo.expiringSoon === true) return 'promo-card__expires promo-card__expires_soon';
        return 'promo-card__expires';
    };

    const applyBtnClass = (promo: Promo) => {
        const applied = appliedCodeAccessor();
        if (applied === promo.code) return 'promo-card__apply promo-card__apply_applied';
        return 'promo-card__apply';
    };

    const applyBtnText = (promo: Promo) => {
        const applied = appliedCodeAccessor();
        return applied === promo.code ? 'Применён' : 'Применить';
    };

    return (
        <div class="promo-modal">
            <div class="promo-modal__header">
                <div class="promo-modal__title">Мои промокоды</div>
                <button type="button" class="promo-modal__close" aria-label="Закрыть" onClick={props.onClose}>
                    ✕
                </button>
            </div>

            <div class="promo-modal__list">
                <For each={promosAccessor} key={(p) => p.id}>
                    {(promo) => (
                        <div class={() => cardClass(promo)}>
                            <div class={() => codeClass(promo)}>{promo.code}</div>
                            <div class="promo-card__body">
                                <div class="promo-card__title">{promo.title}</div>
                                <div class="promo-card__condition">{promo.condition}</div>
                                <div class={() => expiresClass(promo)}>
                                    {() =>
                                        promo.expiringSoon === true
                                            ? (promo.expiringSoonText ?? promo.expiresAt)
                                            : promo.expiresAt
                                    }
                                </div>
                            </div>
                            <button
                                type="button"
                                class={() => applyBtnClass(promo)}
                                onClick={() => {
                                    void handleApply(promo, props.onClose);
                                }}
                            >
                                {() => applyBtnText(promo)}
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
                    ref={(el: Element | null) => {
                        inputEl = el as HTMLInputElement | null;
                    }}
                    onInput={(e: Event) => {
                        inputValue.set((e.target as HTMLInputElement).value);
                    }}
                />
                <button type="button" class="promo-modal__add" onClick={handleAdd}>
                    Добавить
                </button>
            </div>
        </div>
    );
}
