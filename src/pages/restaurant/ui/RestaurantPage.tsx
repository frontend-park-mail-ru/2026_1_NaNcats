/**
 * Страница ресторана со списком блюд в виде функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `RestaurantPage.ts` 1:1: загрузка бренда и
 * первой страницы блюд, эвристическая группировка блюд по секциям, поиск
 * блюд внутри ресторана с дебаунсом, добавление в корзину с анимацией полёта
 * иконки и подтверждением смены ресторана, переход к блюду по якорю в URL,
 * подгрузка следующих страниц по скроллу, мобильные шторки меню и корзины,
 * модалка отзывов с формой отправки. Шапка приложения здесь не рендерится:
 * RootLayout уже держит её выше по дереву.
 *
 * Реактивная дисциплина (см. JSDoc в `vdom/for.tsx` и `vdom/h.ts`). Все
 * динамические JSX-выражения передаются как функции-аксессоры: `<For each={sections}/>`,
 * атрибуты вида `class={() => ...}`. Голое выражение `<For each={sections()}>`
 * зафиксировалось бы при mount и реактивно не обновлялось бы.
 *
 * Поиск с дебаунсом. Локальное `searchTimer` живёт в замыкании компонента и
 * очищается в `onCleanup`. Сигнал `searchValue` это источник правды значения
 * инпута: при программной очистке мы пишем напрямую в `.value` DOM-узла через
 * ref, потому что наш VDOM прокидывает проп `value` через `setAttribute`,
 * который меняет только дефолтное значение инпута, а не его текущее содержимое.
 *
 * Модалка отзывов реализована через imperative-API (createElement + appendChild)
 * для прямой совместимости со старой версткой и SCSS-анимациями. Альтернатива
 * через VDOM-портал возможна (см. createPortal), но требует переноса всей
 * разметки модалки в JSX. Это выходит за рамки данного юнита: миграция
 * модалки отзывов на JSX это отдельная задача.
 */

import './restaurant.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { Popup } from '@shared/ui/popup';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { onCleanup, signal } from '@shared/lib/signals';
import { For, onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import {
    restaurantApi,
    type Dish,
    type DishSearchHit,
    type Restaurant,
    type Review,
} from '@entities/restaurant';
import { cartStore, fromMicros } from '@entities/cart';
import { userStore } from '@entities/user';
import { addToCart } from '@features/cart/add-to-cart';
import { CartWidget } from '@widgets/cart-widget';

/**
 * Блюдо с предвычисленной ценой в рублях для отображения на карточке.
 */
interface DishView extends Dish {
    /** Цена блюда в рублях (получена из микро-единиц). */
    price_rub: number;
}

/**
 * Секция меню: набор блюд под общим названием категории.
 */
interface DishSection {
    /** Название секции (категории блюд). */
    name: string;
    /** Блюда, попавшие в эту секцию. */
    dishes: DishView[];
}

/**
 * Пропсы страницы ресторана.
 *
 * Совпадают по форме с возвращаемым типом `load()`: роутер вычисляет props на
 * этапе загрузки роута и передаёт их в компонент через Outlet.
 */
export interface RestaurantPageProps {
    /** Данные ресторана (бренда). */
    restaurant: Restaurant;
    /** Загруженные блюда первой страницы. */
    dishes: DishView[];
    /** Секции меню, построенные по списку блюд. */
    sections: DishSection[];
}

/** Эвристические правила группировки блюд по секциям. */
const CATEGORY_RULES: Array<{ name: string; keywords: string[] }> = [
    { name: 'Пицца', keywords: ['пицц'] },
    { name: 'Бургеры', keywords: ['бургер', 'burger', 'чизбургер'] },
    { name: 'Суши и роллы', keywords: ['суши', 'ролл', 'роллы', 'sashimi', 'нигири'] },
    { name: 'Паста', keywords: ['паста', 'спагетт', 'лазань', 'феттучини', 'карбонара'] },
    { name: 'Салаты', keywords: ['салат', 'цезарь'] },
    { name: 'Супы', keywords: ['суп', 'борщ', 'солянка', 'крем-суп', 'рамен', 'фо', 'харчо'] },
    { name: 'Закуски', keywords: ['закус', 'снэк', 'крылыш', 'наггет', 'картош', 'фри'] },
    {
        name: 'Десерты',
        keywords: ['десерт', 'торт', 'мороженое', 'пирожн', 'чизкейк', 'тирамису', 'круассан', 'пончик'],
    },
    {
        name: 'Напитки',
        keywords: [
            'напит',
            'кофе',
            'латте',
            'капучино',
            'эспрессо',
            'чай',
            'сок',
            'вода',
            'кола',
            'лимонад',
            'смузи',
            'милкшейк',
            'коктейль',
        ],
    },
];

/**
 * Сопоставляет блюду имя секции по эвристическому списку ключевых слов.
 *
 * Если ни одно правило не совпало, относит блюдо к секции "Основное меню".
 *
 * @param dish Блюдо для классификации.
 * @returns Имя секции.
 */
const categorize = (dish: DishView): string => {
    const name = dish.name.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some((kw) => name.includes(kw))) return rule.name;
    }
    return 'Основное меню';
};

/**
 * Группирует список блюд в секции меню по эвристическим правилам.
 *
 * @param dishes Полный список блюд.
 * @returns Список секций (минимум одна; для пустого входа возвращает заглушку
 *          "Меню" без блюд).
 */
const buildSections = (dishes: DishView[]): DishSection[] => {
    if (dishes.length === 0) return [{ name: 'Меню', dishes: [] }];

    const groups = new Map<string, DishView[]>();
    for (const dish of dishes) {
        const cat = categorize(dish);
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(dish);
    }

    return Array.from(groups.entries()).map(([name, ds]) => ({ name, dishes: ds }));
};

/** Размер одной страницы выдачи блюд. */
const PAGE_SIZE = 20;
/** Брейкпоинт планшета: выше него мобильные шторки автоматически закрываются. */
const TABLET_BREAKPOINT = 1200;
/** Брейкпоинт мобильного устройства: ниже него работают мобильные шторки. */
const MOBILE_BREAKPOINT = 900;
/** Длительность дебаунса поиска блюд по меню. */
const SEARCH_DEBOUNCE_MS = 300;
/** Максимальное число подгружаемых страниц при поиске блюда по якорю. */
const MAX_ANCHOR_PAGES = 20;

/** Заглушка ресторана для оффлайн-режима (когда id отсутствует). */
const FALLBACK_RESTAURANT: Restaurant = {
    id: 0,
    name: 'Ресторан недоступен (оффлайн)',
    logo_url: '',
};

/**
 * Приводит сырое блюдо к DishView, добавляя цену в рублях.
 *
 * @param d Блюдо как пришло от API.
 * @returns Блюдо с полем price_rub.
 */
const toView = (d: Dish): DishView => ({ ...d, price_rub: fromMicros(d.price) });

/**
 * Подготавливает пропсы страницы ресторана перед монтированием.
 *
 * При отсутствии параметра id возвращает заглушку для оффлайн-режима.
 * Подгружает текущего пользователя (молча проглатывая ошибки сети) и для
 * авторизованного дополнительно подтягивает корзину. Параллельно запрашивает
 * данные бренда и первую страницу блюд; при ошибке любого из запросов
 * используется значение по умолчанию.
 *
 * @returns Промис с пропсами страницы ресторана.
 */
export async function load(): Promise<RestaurantPageProps> {
    const idParam = getQueryParam('id');
    if (!idParam) {
        return { restaurant: FALLBACK_RESTAURANT, dishes: [], sections: buildSections([]) };
    }

    try {
        await userStore.loadCurrent();
    } catch (e) {
        console.warn('restaurant: loadCurrent failed', e);
    }

    const isAuth = userStore.getState().user !== null;
    const aux: Promise<unknown>[] = [];
    if (isAuth) {
        aux.push(cartStore.load());
    }
    await Promise.all(aux);

    const [brandRes, dishesRes] = await Promise.allSettled([
        restaurantApi.getBrand(idParam),
        restaurantApi.listDishes(idParam, PAGE_SIZE, 0),
    ]);

    const restaurant = brandRes.status === 'fulfilled' ? brandRes.value : FALLBACK_RESTAURANT;
    const dishes = dishesRes.status === 'fulfilled' ? dishesRes.value.map(toView) : [];

    return { restaurant, dishes, sections: buildSections(dishes) };
}

/**
 * Запускает анимацию полёта картинки блюда от карточки до иконки корзины.
 *
 * Клон картинки позиционируется в `position: fixed`, после чего через Web
 * Animations API проигрывается transform + opacity. По завершении клон
 * удаляется из DOM. Если карточка или иконка корзины не найдены, функция
 * молча возвращается: анимация это украшение и не должна срывать поток.
 *
 * @param dishId Идентификатор блюда (используется для поиска карточки).
 */
const flyDishToCart = (dishId: number): void => {
    const dishCard = document.querySelector(`[data-dish-id="${dishId}"]`);
    const dishImgToAnimate = dishCard?.getElementsByClassName('dish-card__img')[0] as
        | HTMLElement
        | undefined;
    const cartIcon = document.querySelector('.cart-fab') as HTMLElement | null;

    if (!dishImgToAnimate || !cartIcon) return;

    const startPos = dishImgToAnimate.getBoundingClientRect();
    const endPos = cartIcon.getBoundingClientRect();

    const clone = dishImgToAnimate.cloneNode(true) as HTMLElement;
    clone.classList.add('fly-to-cart');

    clone.style.position = 'fixed';
    clone.style.left = `${startPos.left}px`;
    clone.style.top = `${startPos.top}px`;
    clone.style.width = `${startPos.width}px`;
    clone.style.height = `${startPos.height}px`;
    clone.style.margin = '0';
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';

    document.body.appendChild(clone);

    const dx = endPos.left + endPos.width / 2 - (startPos.left + startPos.width / 2);
    const dy = endPos.top + endPos.height / 2 - (startPos.top + startPos.height / 2);

    const animation = clone.animate(
        [
            { transform: 'translate(0, 0) scale(1)', opacity: '1' },
            { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: '0.2' },
        ],
        {
            duration: 1000,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
        },
    );

    animation.onfinish = (): void => {
        clone.remove();
    };
};

/**
 * Прокручивает к карточке блюда и подсвечивает её. Подсветка снимается на
 * первое пользовательское взаимодействие (клик, тач, клавиша, колесо), но
 * не на программный smooth-scroll (он не порождает пользовательских событий).
 *
 * @param card Карточка блюда, к которой нужно прокрутить.
 */
const highlightAndScroll = (card: HTMLElement): void => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('dish-card_highlighted');

    const dismiss = (): void => {
        card.classList.remove('dish-card_highlighted');
        document.removeEventListener('pointerdown', dismiss, true);
        document.removeEventListener('wheel', dismiss, true);
        document.removeEventListener('touchstart', dismiss, true);
        document.removeEventListener('keydown', dismiss, true);
    };
    document.addEventListener('pointerdown', dismiss, { capture: true, once: true });
    document.addEventListener('wheel', dismiss, { capture: true, once: true, passive: true });
    document.addEventListener('touchstart', dismiss, { capture: true, once: true, passive: true });
    document.addEventListener('keydown', dismiss, { capture: true, once: true });
};

/**
 * Собирает HTML-разметку модалки отзывов.
 *
 * @param reviews Список отзывов для отображения.
 * @returns Готовая HTML-строка модалки.
 */
const buildReviewsModalHtml = (reviews: Review[]): string => {
    const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

    const list = reviews.length
        ? reviews
              .map(
                  (r) => `
            <div class="review-item">
                <div class="review-item__top">
                    <span class="review-item__author">${r.author_name}</span>
                    <span class="review-item__stars">${stars(r.rating)}</span>
                </div>
                <p class="review-item__comment">${r.comment}</p>
            </div>`,
              )
              .join('')
        : '<p class="reviews-empty">Отзывов пока нет. Будьте первым!</p>';

    return `
        <div class="reviews-modal">
            <div class="reviews-modal__header">
                <h2 class="reviews-modal__title">Отзывы</h2>
                <button type="button" class="reviews-modal__close js-reviews-close" aria-label="Закрыть">×</button>
            </div>
            <div class="reviews-modal__list">${list}</div>
            <div class="reviews-modal__form">
                <h3 class="reviews-form__title">Оставить отзыв</h3>
                <input
                    type="text"
                    class="reviews-form__input js-review-author"
                    placeholder="Ваше имя"
                    maxlength="60"
                />
                <div class="star-picker js-star-picker" data-rating="0" aria-label="Оценка">
                    <span class="star-picker__star js-star" data-value="1">★</span>
                    <span class="star-picker__star js-star" data-value="2">★</span>
                    <span class="star-picker__star js-star" data-value="3">★</span>
                    <span class="star-picker__star js-star" data-value="4">★</span>
                    <span class="star-picker__star js-star" data-value="5">★</span>
                </div>
                <textarea
                    class="reviews-form__textarea js-review-comment"
                    placeholder="Ваш комментарий"
                    rows="3"
                    maxlength="500"
                ></textarea>
                <button type="button" class="reviews-form__submit js-review-submit">Отправить</button>
                <p class="reviews-form__error js-review-error" style="display:none"></p>
            </div>
        </div>`;
};

/**
 * Страница ресторана: меню, поиск блюд, добавление в корзину, отзывы.
 *
 * Внутри функции заводятся сигналы локального состояния и обработчики событий.
 * Возвращает VNode-дерево разметки страницы: сайдбар со списком секций,
 * центральный блок с поиском и карточками блюд, сайдбар с корзиной.
 *
 * @param props Пропсы страницы (результат `load()`).
 * @returns VNode-дерево разметки страницы.
 */
export function RestaurantPage(props: RestaurantPageProps): VNode {
    /** Идентификатор ресторана: вычисляется один раз по URL. */
    const restaurantId = ((): number => {
        const raw = getQueryParam('id');
        return raw ? parseInt(raw, 10) : 0;
    })();

    /** Полный список загруженных блюд (для пагинации и сброса поиска). */
    const allDishes = signal<DishView[]>(props.dishes.slice());
    /** Отрисовываемый список секций (учитывает фильтр поиска по меню). */
    const sections = signal<DishSection[]>(props.sections);
    /** Offset для пагинации блюд. */
    const offset = signal<number>(props.dishes.length);
    /** Флаг наличия следующей страницы. */
    const hasMore = signal<boolean>(props.dishes.length === PAGE_SIZE);
    /** Идёт ли сейчас запрос следующей страницы. */
    const isFetching = signal<boolean>(false);
    /** Значение поискового инпута по меню. */
    const searchValue = signal<string>('');
    /** Открыта ли мобильная шторка меню. */
    const menuOpen = signal<boolean>(false);
    /** Открыт ли мобильный лист корзины. */
    const cartOpen = signal<boolean>(false);

    /** Текущий запланированный таймер дебаунса поиска. */
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    /** Текстовый инпут поиска: нужен для прямого сброса значения через `.value`. */
    let searchInputEl: HTMLInputElement | null = null;

    /**
     * Загружает следующую страницу блюд и добавляет её к уже отрисованным.
     *
     * Игнорирует параллельные вызовы, ничего не делает при отсутствии
     * идентификатора ресторана или когда подгружать больше нечего. При ошибке
     * отключает дальнейшую пагинацию.
     */
    const fetchNextPage = async (): Promise<void> => {
        if (isFetching() || !hasMore() || !restaurantId) return;
        isFetching.set(true);
        try {
            const next = await restaurantApi.listDishes(restaurantId, PAGE_SIZE, offset());
            const nextView = next.map(toView);
            allDishes.set((prev) => {
                const merged = [...prev, ...nextView];
                sections.set(buildSections(merged));
                return merged;
            });
            offset.set((prev) => prev + next.length);
            if (next.length < PAGE_SIZE) hasMore.set(false);
        } catch (e) {
            console.error('restaurant: fetchNextPage failed', e);
            hasMore.set(false);
        } finally {
            isFetching.set(false);
        }
    };

    /**
     * Прокручивает страницу к карточке блюда по идентификатору. Если карточки
     * ещё нет в DOM, последовательно подгружает следующие страницы блюд (до
     * жёсткого лимита), пока карточка не появится либо пагинация не закончится.
     *
     * @param dishId Идентификатор искомого блюда.
     */
    const scrollToDishById = async (dishId: string): Promise<void> => {
        for (let i = 0; i < MAX_ANCHOR_PAGES; i += 1) {
            const card = document.querySelector(
                `.dish-card[data-dish-id="${dishId}"]`,
            ) as HTMLElement | null;
            if (card) {
                highlightAndScroll(card);
                return;
            }
            if (!hasMore() || isFetching()) {
                if (isFetching()) {
                    await new Promise((r) => setTimeout(r, 150));
                    continue;
                }
                return;
            }
            await fetchNextPage();
        }
    };

    /**
     * Обработчик клика по кнопке "В корзину" на карточке блюда.
     *
     * Неавторизованного пользователя редиректит на /login. Считывает данные
     * блюда с карточки, делегирует добавление фиче addToCart с подтверждением
     * смены ресторана через Popup, при успехе запускает анимацию полёта
     * картинки в корзину.
     *
     * @param dish Блюдо для добавления.
     */
    const handleAdd = async (dish: DishView): Promise<void> => {
        if (!userStore.getState().user) {
            void router.go(ROUTES.login);
            return;
        }

        try {
            await addToCart(
                {
                    id: dish.id,
                    name: dish.name,
                    price: dish.price,
                    image_url: dish.image_url,
                },
                restaurantId,
                () =>
                    Popup.confirm(
                        'В корзине уже есть блюда из другого ресторана. Очистить и добавить новое?',
                    ),
            );
            flyDishToCart(dish.id);
        } catch (e) {
            console.error('restaurant: addToCart failed', e);
            const msg = e instanceof Error && e.message ? e.message : 'Не удалось добавить блюдо.';
            await Popup.alert(`Не удалось добавить блюдо: ${msg}`);
        }
    };

    /**
     * Запускает поиск блюд внутри ресторана через API. При пустом запросе
     * восстанавливает полный список загруженных блюд.
     *
     * @param q Текущее значение поискового инпута (обрезанное).
     */
    const runDishSearch = async (q: string): Promise<void> => {
        if (!q) {
            sections.set(buildSections(allDishes()));
            return;
        }
        try {
            const dishes: DishSearchHit[] = await restaurantApi.searchDishesInRestaurant(
                restaurantId,
                q,
                50,
            );
            const view: DishView[] = dishes.map((d) => ({
                id: typeof d.id === 'string' ? parseInt(d.id, 10) : d.id,
                name: d.name,
                description: d.description,
                image_url: d.image_url,
                price: d.price,
                price_rub: fromMicros(d.price),
            }));
            sections.set(buildSections(view));
        } catch (e) {
            console.warn('restaurant: dish search failed', e);
        }
    };

    /**
     * Обработчик ввода в поисковый инпут: записывает значение в сигнал и
     * планирует поиск с дебаунсом.
     *
     * @param e Событие input.
     */
    const handleSearchInput = (e: Event): void => {
        const target = e.target as HTMLInputElement;
        const q = target.value.trim();
        searchValue.set(target.value);

        if (searchTimer !== null) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchTimer = null;
            void runDishSearch(q);
        }, SEARCH_DEBOUNCE_MS);
    };

    /**
     * Сбрасывает поисковый запрос: очищает значение инпута через ref-узел
     * (потому что VDOM пишет проп `value` через setAttribute), отменяет
     * таймер дебаунса и восстанавливает полный список блюд.
     */
    const handleSearchClear = (): void => {
        searchValue.set('');
        if (searchInputEl !== null) {
            searchInputEl.value = '';
        }
        if (searchTimer !== null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        sections.set(buildSections(allDishes()));
    };

    /**
     * Прокручивает страницу к секции меню по её индексу.
     *
     * @param idx Индекс секции в массиве sections.
     */
    const scrollToSection = (idx: number): void => {
        const target = document.getElementById(`dish-section-${idx}`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    /**
     * Открывает шторку меню и закрывает лист корзины.
     */
    const openMenuDrawer = (): void => {
        menuOpen.set(true);
        cartOpen.set(false);
    };

    /**
     * Открывает лист корзины и закрывает шторку меню.
     */
    const openCartSheet = (): void => {
        cartOpen.set(true);
        menuOpen.set(false);
    };

    /**
     * Закрывает обе мобильные панели.
     */
    const closePanels = (): void => {
        menuOpen.set(false);
        cartOpen.set(false);
    };

    /**
     * Закрывает модалку отзывов: снимает класс открытия и удаляет оверлей
     * после завершения transition (через одноразовый transitionend).
     */
    const closeReviews = (): void => {
        const overlay = document.querySelector('.js-reviews-overlay');
        if (!overlay) return;
        overlay.classList.remove('reviews-overlay_open');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };

    /**
     * Подключает интерактивный выбор оценки звёздами в модалке отзывов.
     *
     * Наведение временно подсвечивает звёзды до курсора, клик фиксирует
     * оценку в data-атрибуте контейнера. Уход курсора возвращает подсветку
     * к зафиксированному значению.
     *
     * @param overlay Корневой элемент модалки отзывов.
     */
    const setupStarPicker = (overlay: HTMLElement): void => {
        const picker = overlay.querySelector('.js-star-picker') as HTMLElement | null;
        if (!picker) return;

        const stars = picker.querySelectorAll('.js-star');

        const highlight = (n: number): void => {
            stars.forEach((s, i) => {
                s.classList.toggle('star-picker__star_active', i < n);
            });
        };

        stars.forEach((star, idx) => {
            star.addEventListener('mouseenter', () => highlight(idx + 1));
            star.addEventListener('mouseleave', () => {
                highlight(parseInt(picker.dataset.rating ?? '0', 10));
            });
            star.addEventListener('click', () => {
                picker.dataset.rating = String(idx + 1);
                highlight(idx + 1);
            });
        });
    };

    /**
     * Подключает форму отправки отзыва.
     *
     * Валидирует имя, оценку и комментарий перед отправкой; при успехе
     * закрывает модалку, при ошибке возвращает кнопку в активное состояние
     * и показывает сообщение.
     *
     * @param overlay Корневой элемент модалки отзывов.
     */
    const setupReviewForm = (overlay: HTMLElement): void => {
        const submitBtn = overlay.querySelector('.js-review-submit') as HTMLButtonElement | null;
        if (!submitBtn) return;

        submitBtn.addEventListener('click', async () => {
            const author = (
                overlay.querySelector('.js-review-author') as HTMLInputElement | null
            )?.value.trim();
            const comment = (
                overlay.querySelector('.js-review-comment') as HTMLTextAreaElement | null
            )?.value.trim();
            const rating = parseInt(
                (overlay.querySelector('.js-star-picker') as HTMLElement | null)?.dataset.rating ??
                    '0',
                10,
            );
            const errorEl = overlay.querySelector('.js-review-error') as HTMLElement | null;

            if (!author || !comment || rating < 1) {
                if (errorEl) {
                    errorEl.textContent = 'Заполните имя, оценку и комментарий';
                    errorEl.style.display = 'block';
                }
                return;
            }

            if (errorEl) errorEl.style.display = 'none';
            submitBtn.disabled = true;

            try {
                await restaurantApi.createReview(restaurantId, {
                    author_name: author,
                    rating,
                    comment,
                });
                closeReviews();
            } catch {
                if (errorEl) {
                    errorEl.textContent = 'Не удалось отправить отзыв. Попробуйте ещё раз.';
                    errorEl.style.display = 'block';
                }
                submitBtn.disabled = false;
            }
        });
    };

    /**
     * Открывает модалку отзывов: подгружает отзывы (при ошибке показывает
     * пустое состояние), вставляет оверлей в DOM, навешивает обработчики
     * закрытия, инициализирует выбор оценки и форму отправки.
     */
    const openReviews = async (): Promise<void> => {
        let reviews: Review[] = [];
        try {
            reviews = await restaurantApi.getReviews(restaurantId);
        } catch {
            // Пустой список: показываем заглушку "Будьте первым".
        }

        const overlay = document.createElement('div');
        overlay.className = 'reviews-overlay js-reviews-overlay';
        overlay.innerHTML = buildReviewsModalHtml(reviews);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('reviews-overlay_open'));

        const closeBtn = overlay.querySelector('.js-reviews-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeReviews());
        }
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeReviews();
        });

        setupStarPicker(overlay);
        setupReviewForm(overlay);
    };

    /**
     * Обработчик скролла окна: подгружает следующую страницу блюд при
     * приближении к низу.
     */
    const handleScroll = (): void => {
        if (isFetching() || !hasMore() || !restaurantId) return;
        const doc = document.documentElement;
        const distance = doc.scrollHeight - doc.scrollTop - doc.clientHeight;
        if (distance > 200) return;
        void fetchNextPage();
    };

    /**
     * Document-level keydown: Escape закрывает и мобильные панели, и модалку
     * отзывов.
     *
     * @param e Событие keydown.
     */
    const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape') return;
        closePanels();
        closeReviews();
    };

    /**
     * Window resize: при росте ширины окна выше брейкпоинтов автоматически
     * скрываем открытые мобильные панели.
     */
    const handleResize = (): void => {
        const width = window.innerWidth;
        if (width > TABLET_BREAKPOINT) {
            closePanels();
            return;
        }
        if (width > MOBILE_BREAKPOINT) {
            menuOpen.set(false);
        }
    };

    onMount(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);

        const dishParam = getQueryParam('dish');
        if (dishParam) {
            void scrollToDishById(dishParam);
        }
    });

    onCleanup(() => {
        window.removeEventListener('scroll', handleScroll);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResize);
        if (searchTimer !== null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        // Если страница размонтировалась с открытой модалкой отзывов, уберём её
        // из body, чтобы не утекла.
        const lingering = document.querySelector('.js-reviews-overlay');
        if (lingering) lingering.remove();
    });

    return (
        <div
            class={(): string => {
                const classes = ['page-wrapper', 'restaurant-details-page'];
                if (menuOpen()) classes.push('restaurant-details-page_drawer-menu');
                if (cartOpen()) classes.push('restaurant-details-page_sheet-cart');
                return classes.join(' ');
            }}
        >
            <button
                type="button"
                class="menu-fab"
                aria-label="Открыть меню ресторана"
                onClick={openMenuDrawer}
            >
                <svg
                    class="menu-fab__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M7.2 3.5C5.55 3.5 4.2 4.85 4.2 6.5C4.2 8.15 5.55 9.5 7.2 9.5C8.85 9.5 10.2 8.15 10.2 6.5C10.2 4.85 8.85 3.5 7.2 3.5Z"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                    />
                    <path
                        d="M6.1 9.2L5.7 19.2C5.67 20.06 6.35 20.8 7.21 20.8C8.07 20.8 8.75 20.08 8.72 19.22L8.3 9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M16.9 3.7V9.2M14.4 3.7V9.2M19.4 3.7V9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M14.2 9.2H19.6"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M16.9 9.2L16.5 19.2C16.47 20.06 17.15 20.8 18.01 20.8C18.87 20.8 19.55 20.08 19.52 19.22L19.1 9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                </svg>
            </button>

            <button
                type="button"
                class="cart-fab"
                aria-label="Открыть корзину"
                onClick={openCartSheet}
            >
                <svg
                    class="cart-fab__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M4 5H5.4C6.1 5 6.42 5.27 6.58 5.86L6.94 7.2M6.94 7.2H18.6C19.58 7.2 20.18 8.02 19.92 8.96L18.84 12.86C18.64 13.58 17.98 14.08 17.24 14.08H9.18C8.38 14.08 7.69 13.54 7.5 12.76L6.94 7.2Z"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M9.6 18.2C10.2627 18.2 10.8 17.6627 10.8 17C10.8 16.3373 10.2627 15.8 9.6 15.8C8.93726 15.8 8.4 16.3373 8.4 17C8.4 17.6627 8.93726 18.2 9.6 18.2Z"
                        fill="#FFC1C1"
                    />
                    <path
                        d="M17.1 18.2C17.7627 18.2 18.3 17.6627 18.3 17C18.3 16.3373 17.7627 15.8 17.1 15.8C16.4373 15.8 15.9 16.3373 15.9 17C15.9 17.6627 16.4373 18.2 17.1 18.2Z"
                        fill="#FFC1C1"
                    />
                </svg>
            </button>

            <div class="mobile-overlay" onClick={closePanels} />

            <div class="main-layout">
                <aside class="side-column restaurant-menu-column">
                    <div class="card card_fixed">
                        <div class="mobile-panel-header">
                            <p class="label-text">Меню</p>
                            <button
                                type="button"
                                class="mobile-panel-close"
                                aria-label="Закрыть меню"
                                onClick={closePanels}
                            >
                                ×
                            </button>
                        </div>

                        <p class="label-text label-text_desktop">Меню</p>
                        <div class="categories-list">
                            <For
                                each={sections}
                                key={(s: DishSection, i: number): string =>
                                    `${i}-${s.name}-${s.dishes.length}-${s.dishes[0]?.id ?? 0}`
                                }
                            >
                                {(sec: DishSection, idx: number): VNode => (
                                    <div
                                        class="category-item"
                                        tabindex="0"
                                        role="button"
                                        onClick={(): void => {
                                            scrollToSection(idx);
                                            if (window.innerWidth <= MOBILE_BREAKPOINT) {
                                                closePanels();
                                            }
                                        }}
                                        onKeyDown={(e: Event): void => {
                                            const ke = e as KeyboardEvent;
                                            if (ke.key !== 'Enter' && ke.key !== ' ') return;
                                            ke.preventDefault();
                                            scrollToSection(idx);
                                        }}
                                    >
                                        <span>—</span>
                                        <span>{sec.name}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </aside>

                <main class="center-column">
                    <div class="sheet">
                        <div class="sheet__header restaurant-sheet-header">
                            <h1 class="sheet__title restaurant-sheet-title">
                                {props.restaurant.name}
                            </h1>
                        </div>

                        <div class="restaurant-hero">
                            <img
                                class="restaurant-hero__img"
                                src={props.restaurant.logo_url}
                                alt={props.restaurant.name}
                                onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/restaurants/default-restaurant-logo.webp'"
                            />
                        </div>

                        <div class="restaurant-search">
                            <div class="restaurant-search__box">
                                <svg
                                    class="restaurant-search__icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                        stroke="#7D7D7D"
                                        stroke-width="1.8"
                                    />
                                    <path
                                        d="M16.5 16.5L21 21"
                                        stroke="#7D7D7D"
                                        stroke-width="1.8"
                                        stroke-linecap="round"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    class="restaurant-search__input"
                                    placeholder="Поиск по меню ресторана"
                                    autocomplete="off"
                                    onInput={handleSearchInput}
                                    ref={(el: Element | null): void => {
                                        searchInputEl = el as HTMLInputElement | null;
                                    }}
                                />
                                <button
                                    type="button"
                                    class="restaurant-search__clear"
                                    style={(): string =>
                                        searchValue().trim() ? 'display: flex' : 'display: none'
                                    }
                                    onClick={handleSearchClear}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="reviews-btn"
                            onClick={(): void => {
                                void openReviews();
                            }}
                        >
                            <svg
                                class="reviews-btn__icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                                    stroke="#FFC1C1"
                                    stroke-width="1.8"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                            Отзывы
                        </button>

                        <div>
                            <For
                                each={sections}
                                key={(s: DishSection, i: number): string =>
                                    `${i}-${s.name}-${s.dishes.length}-${s.dishes[0]?.id ?? 0}`
                                }
                            >
                                {(sec: DishSection, idx: number): VNode => (
                                    <>
                                        <h2
                                            class="restaurant-section-title"
                                            id={`dish-section-${idx}`}
                                        >
                                            {sec.name}
                                        </h2>
                                        <div class="res-grid">
                                            <For
                                                each={(): readonly DishView[] => sec.dishes}
                                                key={(d: DishView): number => d.id}
                                            >
                                                {(d: DishView): VNode => (
                                                    <div class="dish-card" data-dish-id={d.id}>
                                                        <img
                                                            class="dish-card__img"
                                                            src={d.image_url}
                                                            alt={d.name}
                                                            onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'"
                                                        />
                                                        <div class="dish-card__prices">
                                                            <div class="dish-card__price">
                                                                {`${d.price_rub.toFixed(2)} ₽`}
                                                            </div>
                                                        </div>
                                                        <div class="dish-card__title">{d.name}</div>
                                                        <div class="dish-card__desc">
                                                            {d.description ?? 'Описание появится позже'}
                                                        </div>
                                                        <button
                                                            class="button dish-card__add-btn"
                                                            type="button"
                                                            data-id={d.id}
                                                            data-name={d.name}
                                                            data-price={d.price}
                                                            data-image={d.image_url}
                                                            onClick={(): void => {
                                                                void handleAdd(d);
                                                            }}
                                                        >
                                                            В корзину
                                                        </button>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </>
                                )}
                            </For>
                        </div>
                    </div>
                </main>

                <aside class="side-column restaurant-cart-column">
                    <div class="card card_cart">
                        <div class="cart-slot">
                            <CartWidget />
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    ) as VNode;
}
