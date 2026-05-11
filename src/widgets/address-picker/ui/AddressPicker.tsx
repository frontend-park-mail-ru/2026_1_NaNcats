/**
 * Виджет выбора адреса доставки на JSX/VDOM.
 *
 * Поведение перенесено из старого class-based {@link ./AddressPicker.ts}
 * один в один: инлайн-инпут с подсказками, модалка с Yandex-картой для
 * уточнения точки, модалка деталей адреса (квартира, подъезд, домофон,
 * комментарий). Все обработчики переведены на JSX-проп `onClick`/`onInput`
 * и т.п., а DOM-ссылки получаем через `ref`-колбэки вместо `.js-*`-селекторов.
 *
 * Дисциплина реактивных выражений. Видимость двух оверлеев (карта и детали)
 * и видимость кнопок переключаются через сигналы; в JSX они передаются
 * аксессорами-функциями в проп `class` (через `() => ...`) либо через `<Show
 * when={accessor}>`, чтобы соответствующие узлы реактивно перестраивались.
 *
 * Состояние карты Yandex (instance) сохраняется в локальной ссылке, потому
 * что это императивный side-effect-объект (а не значение), который не имеет
 * смысла превращать в сигнал: его создание/уничтожение делаем вручную в
 * onMount/onCleanup и при первом открытии модалки.
 *
 * Пропсы остаются обратно совместимыми с {@link AddressPickerProps} из
 * legacy-файла, чтобы потребители (HomePage, CheckoutPage, ProfilePage)
 * могли постепенно переехать на JSX-вариант без правки сигнатуры.
 */

import './addressPicker.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { yandexMaps, type MapInstance } from '@shared/api/yandex';
import { addressStore, type Coordinates } from '@entities/address';
import { userStore } from '@entities/user';
import { pickAddress } from '@features/address/pick-address';
import { onCleanup, signal } from '@shared/lib/signals';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/**
 * Внешний интерфейс пикера, отдаваемый через {@link AddressPickerProps.controllerRef}.
 *
 * Совпадает с legacy-сигнатурой class-based {@link ./AddressPicker.ts}: страницы
 * profile и checkout используют `openMapModal(id?)` для редактирования
 * сохранённых адресов и добавления нового, поэтому виджет отдаёт этот вызов
 * наружу через controller-объект.
 */
export interface AddressPickerController {
    /**
     * Открывает модалку с картой Yandex для выбора или редактирования адреса.
     *
     * @param addressId Идентификатор сохранённого адреса для редактирования.
     * @returns Промис, разрешающийся после готовности карты.
     */
    openMapModal(addressId?: string): Promise<void>;
}

/**
 * Входные данные виджета {@link AddressPicker}.
 *
 * Сигнатура совпадает с одноимённым типом из {@link ./AddressPicker.ts},
 * чтобы JSX-версию можно было дропнуть в существующий код. Дополнительно
 * добавлен проп `controllerRef`, через который страницы получают контроллер
 * императивного API: ядро VDOM применяет проп `ref` только к DOM-узлам,
 * поэтому для controller'а используется отдельное имя.
 */
export interface AddressPickerProps {
    /** Текст текущего адреса для предзаполнения инпута. */
    currentAddress?: string;
    /** Пропускать модалку с деталями адреса (квартира, подъезд и т.п.). */
    skipDetails?: boolean;
    /** Скрыть инлайн-инпут адреса (например, в режиме иконки). */
    hideInput?: boolean;
    /** Колбэк выбора адреса: получает текст и координаты выбранной точки. */
    onSelect?: (text: string, coords: Coordinates) => void;
    /**
     * Колбэк, в который виджет передаёт свой controller после mount и null
     * при unmount.
     */
    controllerRef?: (ctl: AddressPickerController | null) => void;
}

/** Задержка дебаунса запроса подсказок и геокодинга. */
const SUGGEST_DEBOUNCE_MS = 400;

/** Дефолтные координаты центра карты (Москва, Красная площадь). */
const DEFAULT_COORDS: Coordinates = [55.75, 37.61];

/**
 * Описание одной подсказки в инлайн-выпадашке: текст плюс флаг, нужно ли
 * делать геокодинг при клике. Для сохранённых адресов координаты уже
 * известны, для свежих подсказок Yandex их надо запрашивать.
 */
interface InlineSuggestion {
    /** Текст адреса для отображения и идентификации. */
    text: string;
    /** Нужно ли запрашивать геокодинг при клике (true для подсказок Yandex). */
    geocodeOnClick: boolean;
}

/**
 * Виджет выбора адреса.
 *
 * @param props Входные пропсы.
 * @returns VNode-дерево виджета.
 */
export function AddressPicker(props: AddressPickerProps): VNode {
    /** Открыта ли инлайн-выпадашка подсказок. */
    const dropdownOpen = signal<boolean>(false);

    /** Текущий список подсказок инлайн-выпадашки. */
    const inlineSuggestions = signal<readonly InlineSuggestion[]>([]);

    /** Видна ли кнопка "Указать на карте" в инлайн-выпадашке. */
    const openMapButtonVisible = signal<boolean>(false);

    /** Открыта ли модалка карты. */
    const mapModalOpen = signal<boolean>(false);

    /** Открыта ли модалка деталей адреса. */
    const detailsModalOpen = signal<boolean>(false);

    /** Текущий список подсказок в модалке карты. */
    const modalSuggestions = signal<readonly string[]>([]);

    /** Раскрыт ли блок подсказок в модалке карты. */
    const modalSuggestionsActive = signal<boolean>(false);

    /** Текущие выбранные координаты (центр карты или координаты подсказки). */
    let selectedCoords: Coordinates = DEFAULT_COORDS;

    /** Инстанс карты Yandex; создаётся при первом открытии модалки. */
    let map: MapInstance | null = null;

    /** Текущий запланированный таймер дебаунса подсказок и геокодинга. */
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Идентификатор редактируемого сохранённого адреса. */
    let editingAddressId: string | null = null;

    /** Адрес, который надо передать в finalize после закрытия модалки деталей. */
    let pendingAddressText = '';

    /** Флаг: следующий actionend карты не должен делать reverseGeocode (программное перемещение). */
    let suppressNextActionEnd = false;

    /** Корневой DOM-узел виджета (для определения "клика вне"). */
    let rootEl: HTMLElement | null = null;
    /** DOM-узел контейнера карты Yandex. */
    let mapContainerEl: HTMLElement | null = null;
    /** Инпут инлайн-выпадашки. */
    let inlineInputEl: HTMLInputElement | null = null;
    /** Инпут модалки карты. */
    let modalInputEl: HTMLInputElement | null = null;
    /** Дисплей-поле модалки деталей. */
    let detailsDisplayEl: HTMLInputElement | null = null;
    /** Форма модалки деталей. */
    let detailsFormEl: HTMLFormElement | null = null;

    /**
     * Проверяет, авторизован ли пользователь. Для неавторизованных любая
     * попытка взаимодействия с пикером ведёт на страницу логина.
     */
    const isAuthenticated = (): boolean => userStore.getState().user !== null;

    /**
     * Возвращает тексты всех сохранённых адресов из стора. Используется для
     * первичной подсказки при фокусе на пустом инпуте.
     */
    const savedAddressTexts = (): string[] =>
        addressStore.getState().saved.map((a) => a.location.address_text);

    /**
     * Подставляет в инлайн-инпут заданное значение через прямую запись
     * DOM-свойства. Прямая запись `.value` нужна потому, что VDOM прокидывает
     * проп `value` через `setAttribute`, который меняет только default-value
     * инпута, но не текущее содержимое.
     *
     * @param text Новый текст инпута.
     */
    const setInlineInputValue = (text: string): void => {
        if (inlineInputEl !== null) inlineInputEl.value = text;
    };

    /**
     * Подставляет значение в инпут модалки карты, синхронизируя DOM-свойство.
     *
     * @param text Новый текст инпута модалки.
     */
    const setModalInputValue = (text: string): void => {
        if (modalInputEl !== null) modalInputEl.value = text;
    };

    /**
     * Программно перемещает карту в новые координаты с сохранением текущего
     * зума и помечает следующее событие actionend как не требующее обратного
     * геокодинга.
     *
     * @param coords Новые координаты центра.
     */
    const moveMapProgrammatically = (coords: Coordinates): void => {
        selectedCoords = coords;
        if (map === null) return;
        suppressNextActionEnd = true;
        map.setCenter(coords, 16);
    };

    /**
     * Завершает выбор адреса: обновляет инлайн-инпут, вызывает сценарий
     * `pickAddress` и пробрасывает результат во внешний колбэк `onSelect`.
     * Сбрасывает состояние редактирования.
     *
     * @param text Текст выбранного адреса.
     * @param coords Координаты выбранной точки.
     * @param details Дополнительные детали адреса (квартира, подъезд и т.п.).
     */
    const finalize = async (
        text: string,
        coords: Coordinates,
        details?: Record<string, string | undefined>,
    ): Promise<void> => {
        setInlineInputValue(text);
        try {
            await pickAddress({ text, coords, details, addressId: editingAddressId });
        } catch (e) {
            console.error('AddressPicker finalize failed', e);
        }
        editingAddressId = null;
        pendingAddressText = '';
        props.onSelect?.(text, coords);
    };

    /**
     * Открывает модалку деталей адреса, заполняя поле отображаемого адреса и
     * сохраняя координаты для последующей финализации.
     *
     * @param text Текст выбранного адреса.
     * @param coords Координаты выбранной точки.
     */
    const openDetailsModal = (text: string, coords: Coordinates): void => {
        if (detailsFormEl !== null) detailsFormEl.reset();
        if (detailsDisplayEl !== null) detailsDisplayEl.value = text;
        pendingAddressText = text;
        selectedCoords = coords;
        detailsModalOpen.set(true);
    };

    /**
     * Закрывает модалку деталей адреса. Содержимое формы не очищается, чтобы
     * пользователь мог вернуться к редактированию повторно.
     */
    const closeDetailsModal = (): void => {
        detailsModalOpen.set(false);
    };

    /**
     * Открывает модалку карты. При передаче идентификатора сохранённого
     * адреса центрирует карту по его координатам и подставляет текст в инпут
     * модалки. При первом открытии создаёт карту, иначе перемещает её.
     *
     * @param addressId Идентификатор сохранённого адреса для редактирования.
     */
    const openMapModal = async (addressId?: string): Promise<void> => {
        editingAddressId = addressId ?? null;
        mapModalOpen.set(true);

        if (addressId !== undefined) {
            const target = addressStore.getState().saved.find((a) => a.id === addressId);
            if (target !== undefined) {
                selectedCoords = [target.location.latitude, target.location.longitude];
                setModalInputValue(target.location.address_text ?? '');
            }
        }

        await yandexMaps.ready();

        if (mapContainerEl === null) return;

        if (map !== null) {
            moveMapProgrammatically(selectedCoords);
            map.fitToViewport();
            return;
        }

        suppressNextActionEnd = true;
        map = yandexMaps.createMap(mapContainerEl, selectedCoords, 16);
        map.onActionEnd(async (center) => {
            selectedCoords = center;
            if (suppressNextActionEnd) {
                suppressNextActionEnd = false;
                return;
            }
            const address = await yandexMaps.reverseGeocode(center);
            if (address !== null) setModalInputValue(address);
        });
        requestAnimationFrame(() => map?.fitToViewport());
    };

    /**
     * Скрывает модалку с картой.
     */
    const closeMapModal = (): void => {
        mapModalOpen.set(false);
    };

    /**
     * Реактивно отрисовывает подсказки инлайн-выпадашки. Если для подсказки
     * стоит флаг geocodeOnClick, перед открытием деталей запрашивается
     * геокодинг адреса; иначе используется уже известные текущие координаты.
     *
     * @param event Событие клика по элементу подсказки.
     * @param suggestion Описание выбранной подсказки.
     */
    const handleInlineSuggestionClick = async (suggestion: InlineSuggestion): Promise<void> => {
        if (suggestion.geocodeOnClick) {
            const coords = await yandexMaps.geocode(suggestion.text);
            if (coords !== null) openDetailsModal(suggestion.text, coords);
            return;
        }
        await finalize(suggestion.text, selectedCoords);
    };

    /**
     * Реактивно обрабатывает клик по подсказке в модалке карты: подставляет
     * текст в инпут модалки, скрывает блок подсказок и центрирует карту по
     * геокодированным координатам.
     *
     * @param text Текст выбранной подсказки.
     */
    const handleModalSuggestionPick = async (text: string): Promise<void> => {
        setModalInputValue(text);
        modalSuggestionsActive.set(false);
        const coords = await yandexMaps.geocode(text);
        if (coords !== null) moveMapProgrammatically(coords);
    };

    /**
     * Обрабатывает фокус/ввод в инлайн-инпуте: показывает подсказки, делает
     * редирект на логин для неавторизованных, дебаунсит запрос к Yandex.
     */
    const handleInlineInput = (): void => {
        if (!isAuthenticated()) {
            inlineInputEl?.blur();
            void router.go(ROUTES.login);
            return;
        }
        const raw = inlineInputEl?.value ?? '';
        const query = raw.trim();
        dropdownOpen.set(true);

        if (query.length === 0) {
            openMapButtonVisible.set(false);
            inlineSuggestions.set(
                savedAddressTexts().map((text) => ({ text, geocodeOnClick: false })),
            );
            return;
        }

        openMapButtonVisible.set(true);
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            const results = await yandexMaps.fetchSuggestions(query);
            inlineSuggestions.set(results.map((text) => ({ text, geocodeOnClick: true })));
        }, SUGGEST_DEBOUNCE_MS);
    };

    /**
     * Обрабатывает клик по контейнеру виджета, когда инлайн-инпут скрыт: в
     * этом случае контейнер играет роль "кнопки" открытия модалки карты.
     *
     * @param event Событие клика.
     */
    const handleContainerClick = (event: Event): void => {
        if (inlineInputEl === null) {
            // Когда инпут скрыт через hideInput, его DOM-узла вообще нет.
            if (!isAuthenticated()) {
                void router.go(ROUTES.login);
                return;
            }
            const t = event.target as HTMLElement;
            if (t.closest('.address-dropdown__map-button-wrapper') !== null) return;
            void openMapModal();
            return;
        }
        const inputHidden = window.getComputedStyle(inlineInputEl).display === 'none';
        if (!inputHidden) return;
        if (!isAuthenticated()) {
            void router.go(ROUTES.login);
            return;
        }
        const t = event.target as HTMLElement;
        if (t.closest('.address-dropdown__map-button-wrapper') !== null) return;
        void openMapModal();
    };

    /**
     * Обрабатывает ввод в инпут модалки карты: делает дебаунсный запрос
     * подсказок и центрирование карты по геокоду введённого адреса.
     */
    const handleModalInput = (): void => {
        const query = modalInputEl?.value.trim() ?? '';
        if (query.length <= 2) return;
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            const [results, coords] = await Promise.all([
                yandexMaps.fetchSuggestions(query),
                yandexMaps.geocode(query),
            ]);
            modalSuggestions.set(results);
            modalSuggestionsActive.set(results.length > 0);
            if (coords !== null) moveMapProgrammatically(coords);
        }, SUGGEST_DEBOUNCE_MS);
    };

    /**
     * Обрабатывает Enter в инпуте модалки карты: запускает геокодинг и
     * перемещает карту, без отправки формы.
     *
     * @param event Событие keydown.
     */
    const handleModalKeyDown = (event: Event): void => {
        const ke = event as KeyboardEvent;
        if (ke.key !== 'Enter') return;
        ke.preventDefault();
        void (async () => {
            const query = modalInputEl?.value.trim() ?? '';
            if (query.length === 0) return;
            const coords = await yandexMaps.geocode(query);
            if (coords !== null) moveMapProgrammatically(coords);
        })();
    };

    /**
     * Обрабатывает нажатие кнопки подтверждения адреса в модалке карты: либо
     * сразу финализирует выбор (skipDetails), либо открывает модалку деталей.
     */
    const handleConfirmMap = (): void => {
        const addr = modalInputEl?.value ?? '';
        closeMapModal();
        if (props.skipDetails === true) {
            void finalize(addr, selectedCoords);
        } else {
            openDetailsModal(addr, selectedCoords);
        }
    };

    /**
     * Отправка формы деталей: собирает поля квартиры/подъезда/этажа/кода
     * домофона/комментария и завершает выбор адреса через finalize.
     *
     * @param event Событие submit.
     */
    const handleDetailsSubmit = async (event: Event): Promise<void> => {
        event.preventDefault();
        if (detailsFormEl === null) return;
        const formData = new FormData(detailsFormEl);
        const text = pendingAddressText !== '' ? pendingAddressText : (detailsDisplayEl?.value ?? '');

        const details: Record<string, string | undefined> = {
            apartment: (formData.get('apartment') as string) || undefined,
            entrance: (formData.get('entrance') as string) || undefined,
            floor: (formData.get('floor') as string) || undefined,
            door_code: (formData.get('door_code') as string) || undefined,
            courier_comment: (formData.get('courier_comment') as string) || undefined,
            label: 'Дом',
        };

        closeDetailsModal();
        await finalize(text, selectedCoords, details);
    };

    /**
     * Обрабатывает кнопку смены адреса в модалке деталей: закрывает детали и
     * возвращает пользователя в модалку карты.
     */
    const handleChangeAddress = (): void => {
        closeDetailsModal();
        void openMapModal();
    };

    /**
     * Document-level обработчик клика: закрывает инлайн-выпадашку подсказок
     * при клике вне корня виджета. Регистрируется в onMount, снимается в
     * onCleanup, чтобы не утекал между смонтированными экземплярами.
     *
     * @param event Событие click из документа.
     */
    const handleDocClick = (event: Event): void => {
        const target = event.target as Node | null;
        if (target === null) return;
        if (rootEl === null) return;
        if (!rootEl.contains(target)) {
            dropdownOpen.set(false);
        }
    };

    const controller: AddressPickerController = { openMapModal };

    // Controller отдаётся синхронно при рендере: страница может сохранить
    // ссылку до того, как пользователь успеет кликнуть по UI-элементу,
    // дёргающему openMapModal. Это безопасно, потому что openMapModal сам
    // обращается к DOM только через свои внутренние ссылки, которые
    // заполнятся при mount поддерева.
    props.controllerRef?.(controller);

    onMount(() => {
        const stored = addressStore.getState().current;
        if (stored !== null && stored.coords !== undefined) {
            selectedCoords = stored.coords;
        }
        document.addEventListener('click', handleDocClick);
    });

    onCleanup(() => {
        document.removeEventListener('click', handleDocClick);
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        if (map !== null) {
            map.destroy();
            map = null;
        }
        props.controllerRef?.(null);
    });

    return (
        <>
            <Show when={(): boolean => props.hideInput !== true}>
                <div
                    class="address-picker search-bar__group search-bar__group_address"
                    onClick={handleContainerClick}
                    ref={(el: Element | null): void => {
                        rootEl = el as HTMLElement | null;
                    }}
                >
                    <div class="search-bar__icon search-bar__icon_address">
                        <svg
                            width="10"
                            height="12"
                            viewBox="0 0 10 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M4.73067 11.118C5.984 10.0273 6.97467 8.91822 7.70267 7.79067C8.43067 6.66311 8.79467 5.68755 8.79467 4.864C8.79467 3.64444 8.40867 2.63778 7.63667 1.844C6.86378 1.05067 5.89512 0.654 4.73067 0.654C3.56623 0.654 2.59756 1.05067 1.82467 1.844C1.05178 2.63733 0.665782 3.644 0.666671 4.864C0.666671 5.68711 1.03067 6.66267 1.75867 7.79067C2.48667 8.91867 3.47734 10.0278 4.73067 11.118Z"
                                stroke="black"
                                stroke-width="0.5"
                            />
                        </svg>
                    </div>
                    <input
                        type="text"
                        class="address-picker__input"
                        placeholder="Укажите адрес доставки"
                        value={props.currentAddress ?? ''}
                        autocomplete="off"
                        onFocus={handleInlineInput}
                        onInput={handleInlineInput}
                        ref={(el: Element | null): void => {
                            inlineInputEl = el as HTMLInputElement | null;
                        }}
                    />
                    <div
                        class={(): string =>
                            dropdownOpen()
                                ? 'address-dropdown address-dropdown_active'
                                : 'address-dropdown'
                        }
                    >
                        <div
                            class="address-dropdown__map-button-wrapper"
                            style={(): string =>
                                openMapButtonVisible() ? 'display: block' : 'display: none'
                            }
                            onClick={(): void => {
                                void openMapModal();
                            }}
                        >
                            <div class="address-dropdown__map-button">Указать на карте</div>
                        </div>
                        <div class="address-dropdown__suggestions">
                            <For
                                each={(): readonly InlineSuggestion[] => inlineSuggestions()}
                                key={(s): string => s.text}
                            >
                                {(s): VNode => (
                                    <div
                                        class="address-dropdown__item"
                                        onClick={(): void => {
                                            void handleInlineSuggestionClick(s);
                                        }}
                                    >
                                        {s.text}
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </Show>

            <div
                class={(): string =>
                    mapModalOpen() ? 'modal-overlay modal-overlay_active' : 'modal-overlay'
                }
            >
                <div class="address-modal">
                    <div class="address-modal__close" onClick={closeMapModal}>
                        ×
                    </div>
                    <div class="address-modal__header">
                        <h2 class="address-modal__title">Укажите адрес доставки</h2>
                    </div>
                    <div class="address-modal__search-row">
                        <div class="modal-search-container">
                            <div class="modal-search">
                                <div class="modal-search__icon">🔍</div>
                                <input
                                    type="text"
                                    class="modal-search__input"
                                    placeholder="Введите адрес"
                                    autocomplete="off"
                                    onInput={handleModalInput}
                                    onKeyDown={handleModalKeyDown}
                                    ref={(el: Element | null): void => {
                                        modalInputEl = el as HTMLInputElement | null;
                                    }}
                                />
                            </div>
                            <div
                                class={(): string =>
                                    modalSuggestionsActive()
                                        ? 'address-modal__suggestions address-modal__suggestions_active'
                                        : 'address-modal__suggestions'
                                }
                            >
                                <For
                                    each={(): readonly string[] => modalSuggestions()}
                                    key={(text): string => text}
                                >
                                    {(text): VNode => (
                                        <div
                                            class="modal-suggestion-item"
                                            onPointerDown={(e: Event): void => {
                                                e.preventDefault();
                                                void handleModalSuggestionPick(text);
                                            }}
                                            onClick={(e: Event): void => {
                                                e.preventDefault();
                                                void handleModalSuggestionPick(text);
                                            }}
                                        >
                                            {text}
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                        <button
                            type="button"
                            class="button button_modal-ok"
                            onClick={handleConfirmMap}
                        >
                            ОК
                        </button>
                    </div>
                    <div class="address-modal__map-container">
                        <div
                            style="width: 100%; height: 297px; border-radius: 24px;"
                            ref={(el: Element | null): void => {
                                mapContainerEl = el as HTMLElement | null;
                            }}
                        />
                        <div class="map-center-pin">📍</div>
                    </div>
                </div>
            </div>

            <div
                class={(): string =>
                    detailsModalOpen() ? 'modal-overlay modal-overlay_active' : 'modal-overlay'
                }
            >
                <div class="address-modal" style="width: 500px;">
                    <div class="address-modal__close" onClick={closeDetailsModal}>
                        ×
                    </div>
                    <h2 class="address-modal__title">Детали адреса</h2>
                    <form
                        class="auth-form"
                        style="max-width:100%"
                        onSubmit={(e: Event): void => {
                            void handleDetailsSubmit(e);
                        }}
                        ref={(el: Element | null): void => {
                            detailsFormEl = el as HTMLFormElement | null;
                        }}
                    >
                        <div class="input-group">
                            <label>Адрес</label>
                            <div style="display: flex; gap: 8px;">
                                <input
                                    type="text"
                                    class="input-field"
                                    disabled
                                    style="background:#eee; flex: 1;"
                                    ref={(el: Element | null): void => {
                                        detailsDisplayEl = el as HTMLInputElement | null;
                                    }}
                                />
                                <button
                                    type="button"
                                    class="button"
                                    style="width: 48px; background: #eee; border-radius: 12px;"
                                    onClick={handleChangeAddress}
                                >
                                    ✏️
                                </button>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <div class="input-group">
                                <label>Квартира</label>
                                <input name="apartment" class="input-field" />
                            </div>
                            <div class="input-group">
                                <label>Подъезд</label>
                                <input name="entrance" class="input-field" />
                            </div>
                            <div class="input-group">
                                <label>Этаж</label>
                                <input name="floor" class="input-field" />
                            </div>
                            <div class="input-group">
                                <label>Код</label>
                                <input name="door_code" class="input-field" />
                            </div>
                        </div>
                        <div class="input-group">
                            <label>Комментарий курьеру</label>
                            <input name="courier_comment" class="input-field" />
                        </div>
                        <button type="submit" class="button button_primary">
                            Сохранить
                        </button>
                    </form>
                </div>
            </div>
        </>
    ) as VNode;
}
