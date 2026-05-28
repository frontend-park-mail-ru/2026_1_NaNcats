// Селект адреса доставки в хедере главной: компактная плашка с текущим адресом
// и выпадашка со списком сохранённых адресов. В выпадашке можно переключить
// активный адрес или открыть пикер для добавления нового.
//
// AddressPicker монтируется глобально в RootLayout и открывается через handle.

import './addressSelect.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { addressStore, type Address } from '@entities/address';
import { userStore } from '@entities/user';
import { addressPickerHandle } from '@widgets/address-picker';
import { removeAddress } from '@features/profile/manage-addresses';
import { onCleanup, signal, useStoreSignal } from '@shared/lib/signals';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { startViewTransition } from '@shared/lib/transitions';
import { Popup } from '@shared/ui/popup';

/** Подпись на плашке-кнопке (placeholder, когда адрес не выбран). */
const PLACEHOLDER = 'Укажите адрес';

/** Сжимает текст адреса до краткого вида: оставляет улицу, дом и квартиру. */
function shortenAddress(text: string): string {
    if (!text) return PLACEHOLDER;
    return text;
}

export function AddressSelect(): VNode {
    const open = signal<boolean>(false);
    const savedAddresses = useStoreSignal(addressStore, (s) => s.saved);
    const currentAddress = useStoreSignal(addressStore, (s) => s.current);
    const user = useStoreSignal(userStore, (s) => s.user);

    let rootEl: HTMLElement | null = null;

    // Текущий выбранный адрес определяем по тексту: он же мог быть выбран
    // не через сохранённые (например, по карте), поэтому id может не совпасть.
    const isActive = (addr: Address): boolean => {
        const current = currentAddress();
        if (current === null) return false;
        return addr.location.address_text === current.text;
    };

    const displayText = (): string => {
        const current = currentAddress();
        if (current !== null && current.text.length > 0) return shortenAddress(current.text);
        const saved = savedAddresses();
        if (saved.length > 0) return shortenAddress(saved[0].location.address_text);
        return PLACEHOLDER;
    };

    const toggle = (_event: Event) => {
        // Гостя ведём на логин, чтобы сначала залогинился и подгрузил адреса.
        if (user() === null) {
            void router.go(ROUTES.login);
            return;
        }
        open.set((prev) => !prev);
    };

    // Список адресов с выбранным наверху — чтобы анимировать «переезд» текущего
    // адреса в начало списка при выборе.
    const orderedAddresses = (): Address[] => {
        const list = savedAddresses();
        const activeIdx = list.findIndex(isActive);
        if (activeIdx <= 0) return list;
        return [list[activeIdx], ...list.slice(0, activeIdx), ...list.slice(activeIdx + 1)];
    };

    const pickSavedAddress = (addr: Address) => {
        // Меняем активный адрес внутри view-transition: выбранный пункт уезжает
        // наверх списка с анимацией, оставляя дропдаун открытым, чтобы перемещение
        // было заметно.
        startViewTransition(() => {
            addressStore.setCurrent({
                text: addr.location.address_text,
                coords: [addr.location.latitude, addr.location.longitude],
            });
        });
    };

    const handleEditAddress = (event: Event, addr: Address) => {
        event.stopPropagation();
        open.set(false);
        void addressPickerHandle.openDetailsForEdit(addr.id);
    };

    const handleDeleteAddress = async (event: Event, addr: Address) => {
        event.stopPropagation();
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        await removeAddress(addr.id);
    };

    const handleAddNew = () => {
        open.set(false);
        addressPickerHandle.openMapModal();
    };

    const handleDocClick = (event: Event) => {
        if (!open()) return;
        const target = event.target as Node | null;
        if (rootEl !== null && target !== null && !rootEl.contains(target)) {
            open.set(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') open.set(false);
    };

    onMount(() => {
        document.addEventListener('click', handleDocClick);
        document.addEventListener('keydown', handleKeyDown);
    });

    onCleanup(() => {
        document.removeEventListener('click', handleDocClick);
        document.removeEventListener('keydown', handleKeyDown);
    });

    return (
        <div
            class={() => (open() ? 'address-select address-select_open' : 'address-select')}
            ref={(el: Element | null) => {
                rootEl = el as HTMLElement | null;
            }}
        >
            <button type="button" class="address-select__trigger" onClick={toggle}>
                <span class="address-select__pin" aria-hidden="true">
                    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M4.73 11.12C5.98 10.03 6.97 8.92 7.7 7.79c.73-1.13 1.09-2.1 1.09-2.93 0-1.22-.39-2.22-1.16-3.02C6.86 1.05 5.9.65 4.73.65 3.57.65 2.6 1.05 1.83 1.84 1.05 2.64.67 3.64.67 4.86c0 .82.36 1.8 1.09 2.93.73 1.13 1.72 2.24 2.97 3.33Z"
                            stroke="#F7958C"
                            stroke-width="1.2"
                            fill="white"
                        />
                        <circle cx="4.73" cy="4.86" r="1.4" fill="#F7958C" />
                    </svg>
                </span>
                <span class="address-select__labels">
                    <span class="address-select__caption">Адрес доставки</span>
                    <span class="address-select__value">{displayText}</span>
                </span>
                <span class="address-select__chevron" aria-hidden="true">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="#F7958C" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                </span>
            </button>

            <Show when={open}>
                <div class="address-select__menu" role="listbox" aria-label="Мои адреса">
                    <div class="address-select__menu-title">Мои адреса</div>
                    <Show
                        when={() => savedAddresses().length > 0}
                        fallback={<div class="address-select__empty">У вас пока нет сохранённых адресов</div>}
                    >
                        <div class="address-select__items">
                            <For each={orderedAddresses} key={(a) => a.id}>
                                {(addr) => (
                                    <div
                                        class={() =>
                                            isActive(addr)
                                                ? 'address-select__item address-select__item_active'
                                                : 'address-select__item'
                                        }
                                        style={`view-transition-name: addr-${String(addr.id)}`}
                                    >
                                        <button
                                            type="button"
                                            class="address-select__item-main"
                                            onClick={() => pickSavedAddress(addr)}
                                        >
                                            <span
                                                class={() =>
                                                    isActive(addr)
                                                        ? 'address-select__radio address-select__radio_active'
                                                        : 'address-select__radio'
                                                }
                                                aria-hidden="true"
                                            />
                                            <span class="address-select__item-body">
                                                <span class="address-select__item-head">
                                                    <span class="address-select__item-label">
                                                        {addr.label ?? 'Адрес'}
                                                    </span>
                                                    <Show when={() => isActive(addr)}>
                                                        <span class="address-select__primary-tag">Основной</span>
                                                    </Show>
                                                </span>
                                                <span class="address-select__item-text">
                                                    {addr.location.address_text}
                                                </span>
                                            </span>
                                        </button>
                                        <div class="address-select__item-actions">
                                            <button
                                                type="button"
                                                class="address-select__item-action"
                                                aria-label="Редактировать адрес"
                                                title="Редактировать"
                                                onClick={(e: Event) => handleEditAddress(e, addr)}
                                            >
                                                <svg
                                                    width="15"
                                                    height="15"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                                                        stroke="currentColor"
                                                        stroke-width="2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                class="address-select__item-action address-select__item-action_danger"
                                                aria-label="Удалить адрес"
                                                title="Удалить"
                                                onClick={(e: Event) => {
                                                    void handleDeleteAddress(e, addr);
                                                }}
                                            >
                                                <svg
                                                    width="15"
                                                    height="15"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                                                        stroke="currentColor"
                                                        stroke-width="2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                    <div class="address-select__divider" />
                    <button type="button" class="address-select__add" onClick={handleAddNew}>
                        <span class="address-select__add-icon" aria-hidden="true">
                            +
                        </span>
                        Добавить новый адрес
                    </button>
                </div>
            </Show>
        </div>
    );
}
