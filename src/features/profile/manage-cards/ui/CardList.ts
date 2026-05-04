import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { cardStore, type Card } from '@entities/card';
import { removeCard, setDefaultCard } from '../model/manageCards';

/**
 * Параметры списка привязанных карт.
 */
export interface CardListProps {
    /** Колбэк, вызываемый при инициировании добавления новой карты (используется снаружи компонента). */
    onAdd?: () => void;
}

const TEMPLATE = `<div id="profile-cards-list" class="cards-list"></div>`;

/**
 * Список привязанных банковских карт пользователя.
 *
 * Подписан на хранилище карт и перерисовывается при изменениях. Клик по
 * неактивной карте делает её картой по умолчанию; клик по кнопке удаления
 * с подтверждением отвязывает карту. Карта отрисовывается с темой по
 * банку-эмитенту и подписью платёжной системы по типу карты.
 */
export class CardList extends Component<CardListProps> {
    constructor() {
        super(TEMPLATE);
    }

    /**
     * Подписывается на хранилище карт и привязывает делегированный обработчик
     * кликов по карточкам и кнопкам удаления.
     */
    protected onMount(): void {
        const list = this.root?.querySelector('#profile-cards-list') as HTMLElement | null;
        if (!list) return;

        this.useStore(
            cardStore,
            (s) => s.cards,
            (cards) => this.render(list, cards),
        );
        this.render(list, cardStore.getState().cards);

        this.on(list, 'click', (e) => {
            const target = e.target as HTMLElement;
            const deleteBtn = target.closest('.js-delete-card') as HTMLElement | null;
            if (deleteBtn?.dataset.id) {
                void this.handleDelete(deleteBtn.dataset.id);
                return;
            }
            const cardEl = target.closest('.payment-card') as HTMLElement | null;
            if (!cardEl?.dataset.id) return;
            if (cardEl.classList.contains('payment-card_active')) return;
            void setDefaultCard(cardEl.dataset.id);
        });
    }

    /**
     * Перерисовывает содержимое списка карт или плашку про пустое состояние.
     *
     * Если карта одна, она помечается активной независимо от флага по
     * умолчанию. Тема и подпись платёжной системы вычисляются по полям
     * `issuer_name` и `card_type`.
     *
     * @param list Корневой элемент списка, в который пишется HTML.
     * @param cards Привязанные карты для отображения.
     */
    private render(list: HTMLElement, cards: Card[]): void {
        if (cards.length === 0) {
            list.innerHTML = '<div class="empty-text">Нет привязанных карт</div>';
            return;
        }

        const onlyOne = cards.length === 1;

        const issuerThemes: Record<string, string> = {
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

        const cardTypeLabel = (type?: string): { label: string; cls: string } => {
            const t = (type ?? '').toLowerCase();
            if (t.includes('visa')) return { label: 'VISA', cls: 'payment-card__system_visa' };
            if (t.includes('master')) return { label: 'Mastercard', cls: 'payment-card__system_mc' };
            if (t.includes('mir') || t.includes('мир')) return { label: 'МИР', cls: 'payment-card__system_mir' };
            if (t.includes('maestro')) return { label: 'Maestro', cls: 'payment-card__system_maestro' };
            if (t.includes('unionpay')) return { label: 'UnionPay', cls: 'payment-card__system_unionpay' };
            return { label: t.toUpperCase() || 'CARD', cls: '' };
        };

        const themeFor = (issuer?: string): string => {
            const key = (issuer ?? '').toLowerCase().trim();
            for (const [needle, cls] of Object.entries(issuerThemes)) {
                if (key.includes(needle)) return cls;
            }
            return '';
        };

        list.innerHTML = cards
            .map((c) => {
                const active = onlyOne || c.is_default;
                const brand = c.issuer_name || 'Карта';
                const themeCls = themeFor(c.issuer_name);
                const sys = cardTypeLabel(c.card_type);
                return `
                <div class="payment-card ${themeCls} ${active ? 'payment-card_active' : ''}"
                     data-id="${c.id}"
                     role="button"
                     tabindex="0"
                     title="${active ? 'Активная карта' : 'Сделать активной'}">
                    <div class="payment-card__top">
                        <div class="payment-card__chip"></div>
                        <button type="button" class="payment-card__remove js-delete-card" data-id="${c.id}" aria-label="Отвязать карту">×</button>
                    </div>
                    <div class="payment-card__brand">${brand}</div>
                    <div class="payment-card__bottom">
                        <span class="payment-card__number">•• ${c.last4}</span>
                        <span class="payment-card__system ${sys.cls}">${sys.label}</span>
                    </div>
                </div>`;
            })
            .join('');
    }

    /**
     * Запрашивает подтверждение и удаляет карту. Ошибки отвязки показываются
     * пользователю через всплывающее уведомление.
     *
     * @param id Идентификатор удаляемой карты.
     */
    private async handleDelete(id: string): Promise<void> {
        const ok = await Popup.confirm('Вы уверены, что хотите отвязать эту карту?');
        if (!ok) return;
        try {
            await removeCard(id);
        } catch {
            await Popup.alert('Не удалось удалить карту');
        }
    }
}
