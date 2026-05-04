import './restaurant.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { Popup } from '@shared/ui/popup';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { restaurantApi, type Restaurant, type Dish, type Review } from '@entities/restaurant';
import { userStore } from '@entities/user';
import { cartStore, fromMicros } from '@entities/cart';
import { addToCart } from '@features/cart/add-to-cart';
import { Header } from '@widgets/header';
import { CartWidget } from '@widgets/cart-widget';
import { restaurantPageTemplate } from './restaurant.tmpl.js';

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
 */
interface RestaurantPageProps {
    /** Данные ресторана (бренда). */
    restaurant: Restaurant;
    /** Загруженные блюда первой страницы. */
    dishes: DishView[];
    /** Секции меню, построенные по списку блюд. */
    sections: DishSection[];
}

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

const categorize = (dish: DishView): string => {
    const name = dish.name.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some((kw) => name.includes(kw))) return rule.name;
    }
    return 'Основное меню';
};

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

const PAGE_SIZE = 20;
const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 900;

const FALLBACK_RESTAURANT: Restaurant = {
    id: 0,
    name: 'Ресторан недоступен (оффлайн)',
    logo_url: '',
};

const toView = (d: Dish): DishView => ({ ...d, price_rub: fromMicros(d.price) });

/**
 * Страница ресторана с меню.
 *
 * Загружает данные бренда и первую страницу блюд по идентификатору из
 * адресной строки. Группирует блюда по эвристическим категориям, монтирует
 * шапку и виджет корзины. Поддерживает добавление блюд в корзину,
 * подгрузку следующих страниц по скроллу, поиск блюд внутри ресторана с
 * дебаунсом, переход к конкретному блюду по якорю в адресной строке,
 * мобильные шторки меню и корзины, модалку отзывов с формой отправки.
 */
export class RestaurantPage extends Component<RestaurantPageProps> {
    private restaurantId = 0;
    private offset = 0;
    private hasMore = true;
    private isFetching = false;
    private pageEl: HTMLElement | null = null;
    private allDishes: DishView[] = [];
    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super(restaurantPageTemplate);
    }

    protected slots = {
        header: '.js-header-slot',
        cart: '.js-cart-slot',
    };

    /**
     * Подготавливает данные страницы.
     *
     * При отсутствии параметра id возвращает заглушку для оффлайн-режима.
     * Подгружает текущего пользователя (без падения при ошибке) и для
     * авторизованного дополнительно загружает корзину. Параллельно
     * запрашивает данные бренда и первую страницу блюд; при ошибке любого
     * из запросов используется значение по умолчанию.
     *
     * @returns Промис с пропсами страницы ресторана.
     */
    static async load(): Promise<RestaurantPageProps> {
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
     * Монтирует дочерние виджеты, навешивает обработчики добавления в
     * корзину, навигации по секциям, скролла подгрузки, поиска по меню,
     * мобильных панелей, модалки отзывов и переходит к блюду по якорю.
     */
    protected onMount(): void {
        this.pageEl = this.root?.querySelector('.js-restaurant-page') as HTMLElement | null;

        const idParam = getQueryParam('id');
        this.restaurantId = idParam ? parseInt(idParam, 10) : 0;
        this.offset = this.props.dishes.length;
        this.hasMore = this.props.dishes.length === PAGE_SIZE;
        this.allDishes = this.props.dishes.slice();

        const user = userStore.getState().user;

        this.mountChild('header', new Header(), {
            user,
            mode: 'back',
            hideSearch: true,
            onBack: () => window.router.go(ROUTES.home),
            onLogin: () => window.router.go(ROUTES.login),
            onRegister: () => window.router.go(ROUTES.register),
            onLoggedOut: () => window.router.go(ROUTES.home),
        });

        this.mountChild('cart', new CartWidget(), CartWidget.buildProps(cartStore.getState().items));

        const dishContent = this.root?.querySelector('.js-dish-content');
        if (dishContent) {
            this.on(dishContent, 'click', (e) => {
                const btn = (e.target as HTMLElement).closest('.js-add-to-cart') as HTMLElement | null;
                if (!btn) return;
                void this.handleAdd(btn);
            });
        }

        const restaurantCategoriesList = this.root?.querySelector('.js-restaurant-categories');
        if (restaurantCategoriesList) {
            this.on(restaurantCategoriesList, 'click', (e) => {
                const item = (e.target as HTMLElement).closest('.js-restaurant-cat') as HTMLElement | null;
                if (!item) return;
                this.scrollToSection(item.dataset.sectionIdx ?? '0');
                if (window.innerWidth <= MOBILE_BREAKPOINT) this.closePanels();
            });
        }

        const scrollContainer = this.root?.querySelector('.center-column');
        if (scrollContainer) {
            this.on(scrollContainer, 'scroll', () => void this.handleScroll(scrollContainer as HTMLElement));
        }

        this.setupRestaurantSearch();

        const openMenuBtns = this.root?.querySelectorAll('.js-open-menu-drawer') ?? [];
        const openCartBtns = this.root?.querySelectorAll('.js-open-cart-sheet') ?? [];
        const overlay = this.root?.querySelector('.js-mobile-overlay');
        const closeBtns = this.root?.querySelectorAll('.js-close-panels') ?? [];
        const menuDrawer = this.root?.querySelector('.js-menu-drawer');

        openMenuBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.openMenuDrawer());
        });

        openCartBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.openCartSheet());
        });

        if (overlay) {
            this.on(overlay, 'click', () => this.closePanels());
        }

        closeBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.closePanels());
        });

        if (menuDrawer) {
            this.on(menuDrawer, 'click', (e) => {
                const item = (e.target as HTMLElement).closest('.category-item');
                if (item && window.innerWidth <= MOBILE_BREAKPOINT) {
                    this.closePanels();
                }
            });
        }

        this.on(document, 'keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Escape') {
                this.closePanels();
                this.closeReviews();
            }
        });

        const reviewsBtn = this.root?.querySelector('.js-reviews-btn');
        if (reviewsBtn) {
            this.on(reviewsBtn, 'click', () => void this.openReviews());
        }

        this.on(window, 'resize', () => {
            const width = window.innerWidth;

            if (width > TABLET_BREAKPOINT) {
                this.closePanels();
                return;
            }

            if (width > MOBILE_BREAKPOINT) {
                this.pageEl?.classList.remove('restaurant-details-page_drawer-menu');
            }
        });

        const dishParam = getQueryParam('dish');
        if (dishParam) {
            void this.scrollToDishById(dishParam);
        }
    }

    /**
     * Прокручивает страницу к карточке блюда по идентификатору.
     *
     * Если карточки ещё нет в DOM, последовательно подгружает следующие
     * страницы блюд (до жёсткого лимита), пока карточка не появится либо
     * пагинация не закончится.
     *
     * @param dishId Идентификатор искомого блюда.
     */
    private async scrollToDishById(dishId: string): Promise<void> {
        const MAX_PAGES = 20;
        for (let i = 0; i < MAX_PAGES; i++) {
            const card = this.root?.querySelector(`.dish-card[data-dish-id="${dishId}"]`) as HTMLElement | null;
            if (card) {
                this.highlightAndScroll(card);
                return;
            }
            if (!this.hasMore || this.isFetching) {
                if (this.isFetching) {
                    await new Promise((r) => setTimeout(r, 150));
                    continue;
                }
                return;
            }
            await this.fetchNextPage();
        }
    }

    /**
     * Загружает следующую страницу блюд и добавляет её к уже отрисованным.
     *
     * Игнорирует параллельные вызовы (флаг isFetching) и ничего не делает
     * при отсутствии идентификатора ресторана либо когда подгружать больше
     * нечего. При ошибке отключает дальнейшую пагинацию.
     */
    private async fetchNextPage(): Promise<void> {
        if (this.isFetching || !this.hasMore || !this.restaurantId) return;
        this.isFetching = true;
        try {
            const next = await restaurantApi.listDishes(this.restaurantId, PAGE_SIZE, this.offset);
            this.appendDishes(next.map(toView));
            this.offset += next.length;
            if (next.length < PAGE_SIZE) this.hasMore = false;
        } catch (e) {
            console.error('restaurant: fetchNextPage failed', e);
            this.hasMore = false;
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Прокручивает к карточке блюда и подсвечивает её.
     *
     * Подсветка снимается на первое пользовательское взаимодействие
     * (клик/тач/клавиша/колесо), но не на программный smooth-scroll.
     *
     * @param card Карточка блюда, к которой нужно прокрутить.
     */
    private highlightAndScroll(card: HTMLElement): void {
        const scrollContainer = this.root?.querySelector('.center-column') as HTMLElement | null;
        if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const offset = cardRect.top - containerRect.top + scrollContainer.scrollTop - 80;
            scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        } else {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        card.classList.add('dish-card_highlighted');

        // Подсветка снимается на первое взаимодействие пользователя со страницей.
        // Программный smooth-scroll выше не должен её снимать, поэтому слушаем
        // только пользовательские события (клик/тач/клавиша/колесо).
        const dismiss = () => {
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
    }

    /**
     * Открывает мобильную шторку меню и закрывает лист корзины.
     */
    private openMenuDrawer(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('restaurant-details-page_drawer-menu');
        this.pageEl.classList.remove('restaurant-details-page_sheet-cart');
    }

    /**
     * Открывает мобильный лист корзины и закрывает шторку меню.
     */
    private openCartSheet(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('restaurant-details-page_sheet-cart');
        this.pageEl.classList.remove('restaurant-details-page_drawer-menu');
    }

    /**
     * Закрывает обе мобильные панели (меню и корзину).
     */
    private closePanels(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.remove('restaurant-details-page_drawer-menu');
        this.pageEl.classList.remove('restaurant-details-page_sheet-cart');
    }

    /**
     * Обрабатывает клик по кнопке добавления блюда в корзину.
     *
     * Неавторизованного пользователя перенаправляет на страницу входа.
     * Считывает данные блюда из data-атрибутов кнопки и делегирует
     * добавление фиче addToCart, при необходимости показывая попап
     * подтверждения смены ресторана.
     *
     * @param btn Нажатая кнопка с data-атрибутами блюда.
     */
    private async handleAdd(btn: HTMLElement): Promise<void> {
        if (!userStore.getState().user) {
            window.router.go(ROUTES.login);
            return;
        }

        const dish = {
            id: parseInt(btn.dataset.id || '0', 10),
            name: btn.dataset.name || '',
            price: parseInt(btn.dataset.price || '0', 10),
            image_url: btn.dataset.image || '',
        };

        try {
            await addToCart(dish, this.restaurantId, () =>
                Popup.confirm('В корзине уже есть блюда из другого ресторана. Очистить и добавить новое?'),
            );
        } catch (e) {
            console.error('restaurant: addToCart failed', e);
            const msg = e instanceof Error && e.message ? e.message : 'Не удалось добавить блюдо.';
            await Popup.alert(`Не удалось добавить блюдо: ${msg}`);
        }
    }

    /**
     * Обрабатывает скролл контейнера и подгружает следующую страницу блюд
     * при приближении к концу списка.
     *
     * @param container Прокручиваемый контейнер с карточками блюд.
     */
    private async handleScroll(container: HTMLElement): Promise<void> {
        if (this.isFetching || !this.hasMore || !this.restaurantId) return;

        const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distance > 200) return;

        await this.fetchNextPage();
    }

    /**
     * Добавляет блюда к полному списку и перерисовывает содержимое меню.
     *
     * @param items Список новых блюд для добавления.
     */
    private appendDishes(items: DishView[]): void {
        const merged = [...this.allDishes, ...items];
        this.allDishes = merged;
        this.props.dishes = merged;
        this.renderDishContent(merged);
    }

    /**
     * Перестраивает разметку секций меню и список категорий по переданным
     * блюдам.
     *
     * @param dishes Блюда, по которым нужно построить секции.
     */
    private renderDishContent(dishes: DishView[]): void {
        const content = this.root?.querySelector('.js-dish-content');
        if (!content) return;

        this.props.sections = buildSections(dishes);

        content.innerHTML = this.props.sections
            .map(
                (sec, idx) => `
                <h2 class="restaurant-section-title" id="dish-section-${idx}">${sec.name}</h2>
                <div class="res-grid">
                    ${sec.dishes
                        .map(
                            (d) => `
                            <div class="dish-card" data-dish-id="${d.id}">
                                <img class="dish-card__img" src="${d.image_url}" alt="${d.name}"
                                    onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                                <div class="dish-card__prices">
                                    <div class="dish-card__price">${d.price_rub.toFixed(2)} ₽</div>
                                </div>
                                <div class="dish-card__title">${d.name}</div>
                                <div class="dish-card__desc">${d.description || 'Описание появится позже'}</div>
                                <button class="button js-add-to-cart dish-card__add-btn" type="button"
                                    data-id="${d.id}" data-name="${d.name}" data-price="${d.price}" data-image="${d.image_url}">
                                    В корзину
                                </button>
                            </div>`,
                        )
                        .join('')}
                </div>`,
            )
            .join('');

        const categoriesList = this.root?.querySelector('.js-restaurant-categories');
        if (categoriesList) {
            categoriesList.innerHTML = this.props.sections
                .map(
                    (sec, idx) => `
                    <div class="category-item js-restaurant-cat" data-section-idx="${idx}" tabindex="0" role="button">
                        <span>—</span><span>${sec.name}</span>
                    </div>`,
                )
                .join('');
        }
    }

    /**
     * Подключает поиск блюд внутри ресторана с дебаунсом.
     *
     * При пустом запросе восстанавливается полный список загруженных блюд.
     * Кнопка очистки сбрасывает поле и таймер дебаунса.
     */
    private setupRestaurantSearch(): void {
        const input = this.root?.querySelector('.js-restaurant-search-input') as HTMLInputElement | null;
        const clear = this.root?.querySelector('.js-restaurant-search-clear') as HTMLElement | null;
        if (!input) return;

        const SEARCH_DEBOUNCE_MS = 300;

        const runSearch = async (q: string) => {
            if (!q) {
                this.renderDishContent(this.allDishes);
                return;
            }
            try {
                const dishes = await restaurantApi.searchDishesInRestaurant(this.restaurantId, q, 50);
                const view: DishView[] = dishes.map((d) => ({
                    id: typeof d.id === 'string' ? parseInt(d.id, 10) : d.id,
                    name: d.name,
                    description: d.description,
                    image_url: d.image_url,
                    price: d.price,
                    price_rub: fromMicros(d.price),
                }));
                this.renderDishContent(view);
            } catch (e) {
                console.warn('restaurant: dish search failed', e);
            }
        };

        this.on(input, 'input', () => {
            const q = input.value.trim();
            if (clear) clear.style.display = q ? 'flex' : 'none';

            if (this.searchTimer !== null) clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => {
                this.searchTimer = null;
                void runSearch(q);
            }, SEARCH_DEBOUNCE_MS);
        });

        if (clear) {
            this.on(clear, 'click', () => {
                input.value = '';
                clear.style.display = 'none';
                if (this.searchTimer !== null) {
                    clearTimeout(this.searchTimer);
                    this.searchTimer = null;
                }
                this.renderDishContent(this.allDishes);
            });
        }
    }

    /**
     * Прокручивает страницу к секции меню по её индексу.
     *
     * @param idxStr Индекс секции в виде строки (из data-атрибута).
     */
    private scrollToSection(idxStr: string): void {
        const target = this.root?.querySelector(`#dish-section-${idxStr}`) as HTMLElement | null;
        const scrollContainer = this.root?.querySelector('.center-column') as HTMLElement | null;
        if (!target || !scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop - 12;
        scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }

    /**
     * Открывает модалку отзывов: подгружает отзывы (при ошибке показывает
     * пустое состояние), вставляет оверлей в DOM, навешивает обработчики
     * закрытия, инициализирует выбор оценки и форму отправки.
     */
    private async openReviews(): Promise<void> {
        let reviews: Review[] = [];
        try {
            reviews = await restaurantApi.getReviews(this.restaurantId);
        } catch {
            // show empty state
        }

        const overlay = document.createElement('div');
        overlay.className = 'reviews-overlay js-reviews-overlay';
        overlay.innerHTML = this.buildReviewsModal(reviews);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('reviews-overlay_open'));

        const closeBtn = overlay.querySelector('.js-reviews-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeReviews());
        }
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeReviews();
        });

        this.setupStarPicker(overlay);
        this.setupReviewForm(overlay);
    }

    /**
     * Собирает HTML модалки отзывов: список существующих отзывов или
     * сообщение о пустом списке плюс форму нового отзыва.
     *
     * @param reviews Список отзывов для отображения.
     * @returns Готовая HTML-разметка модалки.
     */
    private buildReviewsModal(reviews: Review[]): string {
        const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

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
    }

    /**
     * Подключает интерактивный выбор оценки звёздами в модалке отзывов.
     *
     * Наведение временно подсвечивает звёзды до курсора, клик фиксирует
     * оценку в data-атрибуте контейнера. Уход курсора возвращает подсветку
     * к зафиксированному значению.
     *
     * @param overlay Корневой элемент модалки отзывов.
     */
    private setupStarPicker(overlay: HTMLElement): void {
        const picker = overlay.querySelector('.js-star-picker') as HTMLElement | null;
        if (!picker) return;

        const stars = picker.querySelectorAll('.js-star');

        const highlight = (n: number) => {
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
    }

    /**
     * Подключает форму отправки отзыва.
     *
     * Валидирует имя, оценку и комментарий перед отправкой; при успехе
     * закрывает модалку, при ошибке возвращает кнопку в активное
     * состояние и показывает сообщение.
     *
     * @param overlay Корневой элемент модалки отзывов.
     */
    private setupReviewForm(overlay: HTMLElement): void {
        const submitBtn = overlay.querySelector('.js-review-submit');
        if (!submitBtn) return;

        submitBtn.addEventListener('click', async () => {
            const author = (overlay.querySelector('.js-review-author') as HTMLInputElement)?.value.trim();
            const comment = (overlay.querySelector('.js-review-comment') as HTMLTextAreaElement)?.value.trim();
            const rating = parseInt(
                (overlay.querySelector('.js-star-picker') as HTMLElement)?.dataset.rating ?? '0',
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
            (submitBtn as HTMLButtonElement).disabled = true;

            try {
                await restaurantApi.createReview(this.restaurantId, {
                    author_name: author,
                    rating,
                    comment,
                });
                this.closeReviews();
            } catch {
                if (errorEl) {
                    errorEl.textContent = 'Не удалось отправить отзыв. Попробуйте ещё раз.';
                    errorEl.style.display = 'block';
                }
                (submitBtn as HTMLButtonElement).disabled = false;
            }
        });
    }

    /**
     * Закрывает модалку отзывов с анимацией: снимает класс открытия и
     * удаляет оверлей по окончанию transition.
     */
    private closeReviews(): void {
        const overlay = document.querySelector('.js-reviews-overlay');
        if (!overlay) return;
        overlay.classList.remove('reviews-overlay_open');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }
}
