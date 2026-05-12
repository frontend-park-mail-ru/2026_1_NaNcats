import { useStoreSignal } from '@shared/lib/signals';
import { Show, For } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';
import { cardStore, type Card } from '@entities/card';
import { removeCard, setDefaultCard } from '../model/manageCards';

export interface CardListProps {
    /** Вызывается при инициировании добавления новой карты (используется снаружи компонента). */
    onAdd?: () => void;
}

const ISSUER_THEMES: Record<string, string> = {
    sber: 'payment-card_sber',
    sberbank: 'payment-card_sber',
    tinkoff: 'payment-card_tinkoff',
    'т-банк': 'payment-card_tinkoff',
    tbank: 'payment-card_tinkoff',
    alfa: 'payment-card_alfa',
    альфа: 'payment-card_alfa',
    vtb: 'payment-card_vtb',
    втб: 'payment-card_vtb',
    yandex: 'payment-card_yandex',
    яндекс: 'payment-card_yandex',
    gazprombank: 'payment-card_gazprom',
    газпром: 'payment-card_gazprom',
    raiffeisen: 'payment-card_raiffeisen',
    райффайзен: 'payment-card_raiffeisen',
    ozon: 'payment-card_ozon',
};

// CSS-класс темы карты по названию банка-эмитента или пустая строка, если банк не распознан.
function themeFor(issuer?: string): string {
    const key = (issuer ?? '').toLowerCase().trim();
    for (const [needle, cls] of Object.entries(ISSUER_THEMES)) {
        if (key.includes(needle)) return cls;
    }
    return '';
}

// Подпись и CSS-класс платёжной системы по типу карты.
function cardTypeLabel(type?: string): { label: string; cls: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('visa')) return { label: 'VISA', cls: 'payment-card__system_visa' };
    if (t.includes('master')) return { label: 'Mastercard', cls: 'payment-card__system_mc' };
    if (t.includes('mir') || t.includes('мир')) return { label: 'МИР', cls: 'payment-card__system_mir' };
    if (t.includes('maestro')) return { label: 'Maestro', cls: 'payment-card__system_maestro' };
    if (t.includes('unionpay')) return { label: 'UnionPay', cls: 'payment-card__system_unionpay' };
    return { label: t.toUpperCase() || 'CARD', cls: '' };
}

// Когда у пользователя одна карта, она всегда показывается активной,
// независимо от is_default: переключать не из чего.
export function CardList(_props: CardListProps = {}): VNode {
    const cards = useStoreSignal(cardStore, (s) => s.cards);

    const handleDelete = async (id: string): Promise<void> => {
        const ok = await Popup.confirm('Вы уверены, что хотите отвязать эту карту?');
        if (!ok) return;
        try {
            await removeCard(id);
        } catch {
            await Popup.alert('Не удалось удалить карту');
        }
    };

    void _props;

    return (
        <div id="profile-cards-list" class="cards-list">
            <Show
                when={(): boolean => cards().length > 0}
                fallback={<div class="empty-text">Нет привязанных карт</div>}
            >
                <For each={cards} key={(c): string => c.id}>
                    {(c: Card): VNode => {
                        const isOnlyOne = (): boolean => cards().length === 1;
                        const isActive = (): boolean => isOnlyOne() || c.is_default;
                        const brand = c.issuer_name || 'Карта';
                        const themeCls = themeFor(c.issuer_name);
                        const sys = cardTypeLabel(c.card_type);

                        return (
                            <div
                                class={(): string =>
                                    `payment-card ${themeCls} ${isActive() ? 'payment-card_active' : ''}`.trim()
                                }
                                data-id={c.id}
                                role="button"
                                tabindex="0"
                                title={(): string => (isActive() ? 'Активная карта' : 'Сделать активной')}
                                onClick={(): void => {
                                    if (isActive()) return;
                                    void setDefaultCard(c.id);
                                }}
                            >
                                <div class="payment-card__top">
                                    <div class="payment-card__chip" />
                                    <button
                                        type="button"
                                        class="payment-card__remove js-delete-card"
                                        data-id={c.id}
                                        aria-label="Отвязать карту"
                                        onClick={(e: Event): void => {
                                            e.stopPropagation();
                                            void handleDelete(c.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div class="payment-card__brand">{brand}</div>
                                <div class="payment-card__bottom">
                                    <span class="payment-card__number">•• {c.last4}</span>
                                    <span class={`payment-card__system ${sys.cls}`.trim()}>{sys.label}</span>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </Show>
        </div>
    );
}
