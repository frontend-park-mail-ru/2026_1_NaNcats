// Модалка «Адреса доставки»: поиск, список сохранённых адресов с радио,
// иконками редактирования/удаления и тегом «Основной» у активного адреса.
// Кнопка снизу открывает AddressPicker для добавления нового адреса.

import './addressesModal.scss';

import { addressStore, type Address, type CurrentAddress } from '@entities/address';
// eslint-disable-next-line no-restricted-imports
import { addressPickerHandle } from '@widgets/address-picker';
import { Popup } from '@shared/ui/popup';
import { computed, signal, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { removeAddress } from '../model/manageAddresses';

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export interface AddressesModalProps {
    /** Колбэк закрытия (крестик / клик по затемнению). */
    onClose: () => void;
}

/** Активный адрес определяется по совпадению текста с current; на нём показываем «Основной». */
function isActiveAddress(addr: Address, current: CurrentAddress | null): boolean {
    if (current === null) return false;
    return addr.location.address_text === current.text;
}

/** Подпись «Последний заказ: …»; пока нет API, показываем сегодня минус N дней по индексу строки. */
function lastOrderHint(index: number): string {
    const today = new Date();
    today.setDate(today.getDate() - index * 12);
    const day = today.getDate().toString().padStart(2, '0');
    const month = RU_MONTHS_SHORT[today.getMonth()];
    const year = today.getFullYear();
    return `Последний заказ: ${day} ${month} ${year}`;
}

export function AddressesModal(props: AddressesModalProps): VNode {
    const search = signal<string>('');
    const addresses = useStoreSignal(addressStore, (s) => s.saved);
    const current = useStoreSignal(addressStore, (s) => s.current);

    const filtered = computed<Address[]>(() => {
        const needle = search().trim().toLowerCase();
        if (!needle) return addresses();
        return addresses().filter((addr) => {
            const text = addr.location.address_text.toLowerCase();
            const label = (addr.label ?? '').toLowerCase();
            return text.includes(needle) || label.includes(needle);
        });
    });

    const handleSelect = (addr: Address) => {
        addressStore.setCurrent({
            text: addr.location.address_text,
            coords: [addr.location.latitude, addr.location.longitude],
        });
    };

    const handleEdit = (event: Event, id: string) => {
        event.stopPropagation();
        props.onClose();
        addressPickerHandle.openDetailsForEdit(id);
    };

    const handleDelete = async (event: Event, id: string) => {
        event.stopPropagation();
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        try {
            await removeAddress(id);
        } catch (e) {
            console.error('AddressesModal: remove failed', e);
            await Popup.alert('Не удалось удалить адрес');
        }
    };

    const handleAddNew = () => {
        props.onClose();
        addressPickerHandle.openMapModal();
    };

    return (
        <div class="addresses-modal">
            <div class="addresses-modal__header">
                <div class="addresses-modal__title">Адреса доставки</div>
                <div class="addresses-modal__header-right">
                    <span class="addresses-modal__count">{() => `${addresses().length} адреса`}</span>
                    <button type="button" class="addresses-modal__close" aria-label="Закрыть" onClick={props.onClose}>
                        ✕
                    </button>
                </div>
            </div>

            <div class="addresses-modal__search">
                <span class="addresses-modal__search-icon" aria-hidden="true">
                    🔍
                </span>
                <input
                    type="text"
                    class="addresses-modal__search-input"
                    placeholder="Поиск по адресам"
                    value={search()}
                    onInput={(event: Event) => search.set((event.target as HTMLInputElement).value)}
                />
            </div>

            <div class="addresses-modal__list">
                <Show
                    when={() => filtered().length > 0}
                    fallback={
                        <div class="addresses-modal__empty">
                            {() =>
                                addresses().length === 0 ? 'У вас пока нет сохранённых адресов' : 'Ничего не нашлось'
                            }
                        </div>
                    }
                >
                    <For each={filtered} key={(a) => a.id}>
                        {(addr) => (
                            <button
                                type="button"
                                class={() => {
                                    const cls = ['addresses-modal__row'];
                                    if (isActiveAddress(addr, current())) cls.push('addresses-modal__row_active');
                                    return cls.join(' ');
                                }}
                                onClick={() => handleSelect(addr)}
                            >
                                <span
                                    class={() => {
                                        const cls = ['addresses-modal__radio'];
                                        if (isActiveAddress(addr, current())) cls.push('addresses-modal__radio_active');
                                        return cls.join(' ');
                                    }}
                                    aria-hidden="true"
                                />
                                <span class="addresses-modal__row-body">
                                    <span class="addresses-modal__row-head">
                                        <span class="addresses-modal__row-label">{addr.label ?? 'Адрес'}</span>
                                        <Show when={() => isActiveAddress(addr, current())}>
                                            <span class="addresses-modal__primary-tag">Основной</span>
                                        </Show>
                                    </span>
                                    <span class="addresses-modal__row-text">{addr.location.address_text}</span>
                                    <span class="addresses-modal__row-meta">
                                        {() => lastOrderHint(filtered().indexOf(addr))}
                                    </span>
                                </span>
                                <span class="addresses-modal__row-actions">
                                    <span
                                        class="addresses-modal__icon-btn"
                                        role="button"
                                        tabindex="0"
                                        aria-label="Редактировать"
                                        onClick={(event: Event) => handleEdit(event, addr.id)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                            <path
                                                d="M1 11.5V13h1.5l8.5-8.5L9.5 3L1 11.5Z"
                                                stroke="#7D7D7D"
                                                stroke-width="1.2"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                    </span>
                                    <span
                                        class="addresses-modal__icon-btn"
                                        role="button"
                                        tabindex="0"
                                        aria-label="Удалить"
                                        onClick={(event: Event) => {
                                            void handleDelete(event, addr.id);
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                            <path
                                                d="M2 2L12 12M12 2L2 12"
                                                stroke="#7D7D7D"
                                                stroke-width="1.4"
                                                stroke-linecap="round"
                                            />
                                        </svg>
                                    </span>
                                </span>
                            </button>
                        )}
                    </For>
                </Show>
            </div>

            <button type="button" class="addresses-modal__add" onClick={handleAddNew}>
                <span class="addresses-modal__add-icon" aria-hidden="true">
                    +
                </span>
                Добавить новый адрес
            </button>
        </div>
    );
}
