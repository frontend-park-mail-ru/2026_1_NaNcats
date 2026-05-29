// Панель владельца ресторана. Layout: 'root'.

import './owner.scss';

import { ownerApi } from '@entities/owner';
import type { OwnerBrand, OwnerDish, OwnerStats } from '@entities/owner';
import { signal, effect, onCleanup } from '@shared/lib/signals';
import { For, Show, onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';

// LocalStorage-хелпер для хранения списка ресторанов
const LS_KEY = 'nancats:owner_brands';

function loadBrandsFromStorage(): OwnerBrand[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as OwnerBrand[]) : [];
    } catch {
        return [];
    }
}

function saveBrandsToStorage(brands: OwnerBrand[]): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(brands));
    } catch {
        /* ignore */
    }
}

// Конвертация денег
const MONEY_MULTIPLIER = 1_000_000;

function rawToRubles(raw: number): number {
    return Math.round(raw / MONEY_MULTIPLIER);
}

function rublesDisplay(rubles: number): string {
    return `${rubles.toLocaleString('ru-RU')} ₽`;
}

function secToMin(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s === 0 ? `${m} мин` : `${m} мин ${s} с`;
}

// Формат даты
function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

// Цвета и названия статусов
const STATUS_COLORS: Record<string, string> = {
    finished: '#2ecc71',
    in_progress: '#f39c12',
    waiting: '#3498db',
    delivering: '#9b59b6',
    cancelled: '#e74c3c',
    created: '#95a5a6',
    paid: '#1abc9c',
    failed: '#e74c3c',
};

const STATUS_LABELS: Record<string, string> = {
    finished: 'Выполнен',
    in_progress: 'Готовится',
    waiting: 'Ожидает курьера',
    delivering: 'Доставляется',
    cancelled: 'Отменён',
    created: 'Создан',
    paid: 'Оплачен',
    failed: 'Ошибка',
    cart_locked: 'Корзина заблокирована',
    payment_ready: 'Готов к оплате',
};

const FALLBACK_LOGO = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';
const FALLBACK_DISH = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

// Общий модальный контейнер
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: VNode | VNode[] }): VNode {
    const handleBackdrop = (e: Event) => {
        if ((e.target as HTMLElement).classList.contains('owner-modal-backdrop')) onClose();
    };
    return (
        <div class="owner-modal-backdrop" onClick={handleBackdrop}>
            <div class="owner-modal">
                <h3 class="owner-modal__title">{title}</h3>
                {children}
            </div>
        </div>
    );
}

// SVG Line Chart (только CSS/SVG, без библиотек)
function LineChart({ data: dataAccessor }: { data: () => Array<{ label: string; revenue: number }> }): VNode {
    const data = dataAccessor();
    if (data.length === 0) {
        return <div class="owner-loading">Нет данных за выбранный период</div>;
    }

    const W = 600,
        H = 160,
        padL = 52,
        padR = 16,
        padT = 12,
        padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = data.length;
    const maxRev = Math.max(...data.map((d) => d.revenue), 1);

    const toX = (i: number) => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
    const toY = (v: number) => padT + chartH - (v / maxRev) * chartH;

    const linePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`)
        .join(' ');

    const fillPath =
        `M${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} ` +
        data.map((d, i) => `L${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`).join(' ') +
        ` L${toX(n - 1).toFixed(1)},${(padT + chartH).toFixed(1)} Z`;

    const gridPcts = [0, 0.25, 0.5, 0.75, 1];
    const xStep = Math.max(1, Math.ceil(n / 6));
    const xLabels = data.map((d, i) => ({ i, label: d.label })).filter(({ i }) => i % xStep === 0 || i === n - 1);

    return (
        <div class="owner-chart">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet">
                <defs>
                    <linearGradient id="ownerChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#fda522" stop-opacity="0.22" />
                        <stop offset="100%" stop-color="#fda522" stop-opacity="0" />
                    </linearGradient>
                </defs>

                {gridPcts.map((pct) => {
                    const y = padT + chartH * (1 - pct);
                    const val = Math.round(maxRev * pct);
                    const label = val >= 1000 ? `${Math.round(val / 1000)}к` : String(val);
                    return (
                        <>
                            <line
                                x1={padL}
                                y1={y.toFixed(1)}
                                x2={W - padR}
                                y2={y.toFixed(1)}
                                stroke="#f0f0f0"
                                stroke-width="1"
                            />
                            <text x={padL - 4} y={(y + 4).toFixed(1)} text-anchor="end" font-size="9" fill="#aaa">
                                {label}
                            </text>
                        </>
                    );
                })}

                <path d={fillPath} fill="url(#ownerChartGrad)" />
                <path
                    d={linePath}
                    fill="none"
                    stroke="#fda522"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                />

                {data.map((d, i) => (
                    <circle
                        cx={toX(i).toFixed(1)}
                        cy={toY(d.revenue).toFixed(1)}
                        r="3.5"
                        fill="#fda522"
                        stroke="white"
                        stroke-width="1.5"
                    />
                ))}

                {xLabels.map(({ i, label }) => (
                    <text x={toX(i).toFixed(1)} y={H - 4} text-anchor="middle" font-size="9" fill="#aaa">
                        {label}
                    </text>
                ))}
            </svg>
        </div>
    );
}

// Вкладка аналитики
interface AnalyticsTabProps {
    getBrandId: () => string;
}

function AnalyticsTab({ getBrandId }: AnalyticsTabProps): VNode {
    const startDate = signal(daysAgoStr(30));
    const endDate = signal(todayStr());
    const stats = signal<OwnerStats | null>(null);
    const loading = signal(false);
    const error = signal('');

    let startDateEl: HTMLInputElement | null = null;
    let endDateEl: HTMLInputElement | null = null;

    const fetchStats = async () => {
        const id = getBrandId();
        if (!id) return;
        loading.set(true);
        error.set('');
        try {
            const data = await ownerApi.getAnalytics(id, startDate.peek(), endDate.peek());
            stats.set(data);
        } catch (e) {
            error.set(e instanceof Error ? e.message : 'Ошибка загрузки статистики');
            stats.set(null);
        } finally {
            loading.set(false);
        }
    };

    onMount(() => {
        void fetchStats();
    });

    const fin = () => stats()?.financial;
    const oper = () => stats()?.operational;
    const dishes = () => stats()?.dishes ?? [];
    const orderTypes = () => stats()?.order_types ?? [];
    const timeline = () => stats()?.timeline ?? [];

    const totalRevenue = () => rawToRubles(fin()?.total_revenue_raw ?? 0);
    const avgTicket = () => rawToRubles(fin()?.average_ticket_raw ?? 0);
    const discounts = () => rawToRubles(fin()?.total_discounts_raw ?? 0);
    const totalOrders = () => fin()?.total_orders_count ?? 0;
    const avgCook = () => secToMin(oper()?.avg_cooking_time_sec ?? 0);

    const discountPct = () => {
        const rev = fin()?.total_revenue_raw ?? 0;
        const disc = fin()?.total_discounts_raw ?? 0;
        return rev + disc === 0 ? 0 : Math.round((disc / (rev + disc)) * 100);
    };

    const statusCounts = () => oper()?.status_counts ?? {};
    const totalStatus = () => Object.values(statusCounts()).reduce((a, b) => a + b, 0);
    const cancelPct = () => {
        const c = statusCounts()['cancelled'] ?? 0;
        return totalStatus() === 0 ? 0 : Math.round((c / totalStatus()) * 100);
    };
    const kitchenLoad = () => (statusCounts()['in_progress'] ?? 0) + (statusCounts()['waiting'] ?? 0);

    const avgDailyRev = () => {
        const tl = timeline();
        if (!tl.length) return 0;
        return rawToRubles(tl.reduce((s, p) => s + p.revenue_raw, 0) / tl.length);
    };
    const avgDailyOrders = () => {
        const tl = timeline();
        if (!tl.length) return 0;
        return Math.round(tl.reduce((s, p) => s + p.orders_count, 0) / tl.length);
    };
    const peakDay = () => {
        const tl = timeline();
        if (!tl.length) return null;
        return tl.reduce((best, d) => (d.revenue_raw > best.revenue_raw ? d : best));
    };

    const chartData = () =>
        timeline().map((p) => ({
            label: formatDate(p.date),
            revenue: rawToRubles(p.revenue_raw),
        }));
    const maxDishRev = () => Math.max(...dishes().map((d) => d.total_revenue_raw), 1);

    const handleShow = () => {
        if (startDateEl) startDate.set(startDateEl.value);
        if (endDateEl) endDate.set(endDateEl.value);
        void fetchStats();
    };

    return (
        <div style="display:flex;flex-direction:column;gap:20px;">
            {/* Фильтр дат */}
            <div class="owner-filter">
                <span class="owner-filter__label">Период:</span>
                <input
                    type="date"
                    class="owner-date-input"
                    value={startDate.peek()}
                    ref={(el: Element | null) => {
                        startDateEl = el as HTMLInputElement | null;
                    }}
                />
                <span class="owner-filter__label">—</span>
                <input
                    type="date"
                    class="owner-date-input"
                    value={endDate.peek()}
                    max={todayStr()}
                    ref={(el: Element | null) => {
                        endDateEl = el as HTMLInputElement | null;
                    }}
                />
                <button type="button" class="owner-btn owner-btn_primary" onClick={handleShow}>
                    Показать
                </button>
            </div>

            <Show when={() => error() !== ''}>
                <div class="owner-error">{error}</div>
            </Show>
            <Show when={loading}>
                <div class="owner-loading">⏳ Загружаем статистику…</div>
            </Show>

            <Show when={() => !loading() && stats() !== null}>
                {/* KPI */}
                <div class="owner-kpi-grid">
                    <div class="owner-kpi owner-kpi_accent">
                        <span class="owner-kpi__label">Выручка</span>
                        <span class="owner-kpi__value">{() => rublesDisplay(totalRevenue())}</span>
                        <span class="owner-kpi__sub">{() => `${totalOrders()} заказов`}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Средний чек</span>
                        <span class="owner-kpi__value">{() => rublesDisplay(avgTicket())}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Скидки</span>
                        <span class="owner-kpi__value">{() => rublesDisplay(discounts())}</span>
                        <span class="owner-kpi__sub">{() => `${discountPct()}% от оборота`}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Ср. время готовки</span>
                        <span class="owner-kpi__value">{avgCook}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Заказов на кухне</span>
                        <span class="owner-kpi__value">{kitchenLoad}</span>
                        <span class="owner-kpi__sub">прямо сейчас</span>
                    </div>
                    <div class="owner-kpi owner-kpi_red">
                        <span class="owner-kpi__label">Отмены</span>
                        <span class="owner-kpi__value">{() => `${cancelPct()}%`}</span>
                        <span class="owner-kpi__sub">{() => `${statusCounts()['cancelled'] ?? 0} заказов`}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Ср. выручка/день</span>
                        <span class="owner-kpi__value">{() => rublesDisplay(avgDailyRev())}</span>
                    </div>
                    <div class="owner-kpi">
                        <span class="owner-kpi__label">Ср. заказов/день</span>
                        <span class="owner-kpi__value">{avgDailyOrders}</span>
                    </div>
                </div>

                {/* Лучший день */}
                <Show when={() => peakDay() !== null}>
                    <div class="owner-peak">
                        <span class="owner-peak__icon">🏆</span>
                        <div class="owner-peak__info">
                            <div class="owner-peak__label">Лучший день периода</div>
                            <div class="owner-peak__date">{() => formatDate(peakDay()?.date ?? '')}</div>
                            <div class="owner-peak__value">
                                {() =>
                                    `${rublesDisplay(rawToRubles(peakDay()?.revenue_raw ?? 0))} · ${peakDay()?.orders_count ?? 0} заказов`
                                }
                            </div>
                        </div>
                    </div>
                </Show>

                {/* График */}
                <div class="owner-section">
                    <div class="owner-section__head">
                        <h3 class="owner-section__title">Динамика выручки по дням</h3>
                    </div>
                    <Show
                        when={() => !loading() && chartData().length > 0}
                        fallback={
                            <div class="owner-loading">
                                {() => (loading() ? 'Загрузка…' : 'Нет данных за выбранный период')}
                            </div>
                        }
                    >
                        <LineChart data={chartData} />
                    </Show>
                </div>

                {/* Топ блюд */}
                <Show when={() => dishes().length > 0}>
                    <div class="owner-section">
                        <div class="owner-section__head">
                            <h3 class="owner-section__title">Топ блюд</h3>
                        </div>
                        <table class="owner-dishes-table">
                            <thead>
                                <tr>
                                    <th>Блюдо</th>
                                    <th>Продаж</th>
                                    <th class="owner-dishes-table__bar-cell" />
                                    <th>Выручка</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={dishes} key={(d) => String(d.dish_id)}>
                                    {(d) => (
                                        <tr>
                                            <td>{d.dish_name}</td>
                                            <td>{d.units_sold}</td>
                                            <td class="owner-dishes-table__bar-cell">
                                                <div class="owner-dishes-table__bar-wrap">
                                                    <div
                                                        class="owner-dishes-table__bar-fill"
                                                        style={`width:${Math.round((d.total_revenue_raw / maxDishRev()) * 100)}%`}
                                                    />
                                                </div>
                                            </td>
                                            <td>{rublesDisplay(rawToRubles(d.total_revenue_raw))}</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </Show>

                {/* Статусы заказов */}
                <Show when={() => Object.keys(statusCounts()).length > 0}>
                    <div class="owner-section">
                        <div class="owner-section__head">
                            <h3 class="owner-section__title">Статусы заказов</h3>
                        </div>
                        <div class="owner-status-list">
                            <For each={() => Object.entries(statusCounts())} key={([k]) => k}>
                                {([status, count]) => (
                                    <div class="owner-status-item">
                                        <span
                                            class="owner-status-item__dot"
                                            style={`background:${STATUS_COLORS[status] ?? '#ccc'}`}
                                        />
                                        <span class="owner-status-item__label">{STATUS_LABELS[status] ?? status}</span>
                                        <span class="owner-status-item__count">{count}</span>
                                        <span class="owner-status-item__pct">
                                            {totalStatus() > 0 ? `${Math.round((count / totalStatus()) * 100)}%` : '0%'}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                {/* Типы заказов */}
                <Show when={() => orderTypes().length > 0}>
                    <div class="owner-section">
                        <div class="owner-section__head">
                            <h3 class="owner-section__title">Типы заказов</h3>
                        </div>
                        <div class="owner-order-types">
                            <For each={orderTypes} key={(t) => t.order_type}>
                                {(t) => (
                                    <div class="owner-order-type">
                                        <span class="owner-order-type__label">
                                            {t.order_type === 'solo' ? '🧑 Одиночный' : '👥 Совместный'}
                                        </span>
                                        <span class="owner-order-type__count">{t.orders_count}</span>
                                        {t.order_type === 'shared' ? (
                                            <span class="owner-order-type__sub">{`~${t.avg_group_size.toFixed(1)} чел./заказ`}</span>
                                        ) : null}
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}

// Вкладка меню
interface MenuTabProps {
    getBrandId: () => string;
}

function MenuTab({ getBrandId }: MenuTabProps): VNode {
    const dishes = signal<OwnerDish[]>([]);
    const loading = signal(false);
    const error = signal('');
    const showModal = signal(false);
    const editingDish = signal<OwnerDish | null>(null);

    // Поля формы
    let nameEl: HTMLInputElement | null = null;
    let descEl: HTMLTextAreaElement | null = null;
    let priceEl: HTMLInputElement | null = null;
    let fileEl: HTMLInputElement | null = null;

    const formFile = signal<File | null>(null);
    const formPreview = signal('');
    const formSaving = signal(false);
    const formError = signal('');

    const loadDishes = async () => {
        const id = getBrandId();
        if (!id) return;
        loading.set(true);
        error.set('');
        try {
            dishes.set(await ownerApi.getDishes(id));
        } catch (e) {
            error.set(e instanceof Error ? e.message : 'Ошибка загрузки меню');
        } finally {
            loading.set(false);
        }
    };

    onMount(() => {
        void loadDishes();
    });

    const openAdd = () => {
        editingDish.set(null);
        formFile.set(null);
        formPreview.set('');
        formError.set('');
        showModal.set(true);
        // DOM inputs сбрасываем через ref в onMount модалки
    };

    const openEdit = (dish: OwnerDish) => {
        editingDish.set(dish);
        formFile.set(null);
        formPreview.set(dish.image_url);
        formError.set('');
        showModal.set(true);
    };

    const closeModal = () => {
        showModal.set(false);
        editingDish.set(null);
    };

    const handleFileChange = () => {
        const f = fileEl?.files?.[0];
        if (!f) return;
        formFile.set(f);
        formPreview.set(URL.createObjectURL(f));
    };

    const handleSave = async () => {
        const name = nameEl?.value.trim() ?? '';
        const desc = descEl?.value.trim() ?? '';
        const priceRubles = parseFloat(priceEl?.value ?? '');

        if (!name) {
            formError.set('Введите название блюда');
            return;
        }
        if (isNaN(priceRubles) || priceRubles <= 0) {
            formError.set('Введите корректную цену в рублях');
            return;
        }

        const priceRaw = Math.round(priceRubles * MONEY_MULTIPLIER);
        formSaving.set(true);
        formError.set('');

        try {
            const editing = editingDish.peek();
            if (editing) {
                const updated = await ownerApi.updateDish(editing.id, {
                    name,
                    description: desc,
                    price: priceRaw,
                    image: formFile.peek() ?? undefined,
                });
                const upd: OwnerDish = { ...updated, id: String(updated.id), price: Number(updated.price) };
                dishes.set(dishes.peek().map((d) => (d.id === editing.id ? upd : d)));
            } else {
                const created = await ownerApi.createDish(getBrandId(), {
                    name,
                    description: desc,
                    price: priceRaw,
                    image: formFile.peek() ?? undefined,
                });
                const cr: OwnerDish = { ...created, id: String(created.id), price: Number(created.price) };
                dishes.set([...dishes.peek(), cr]);
            }
            closeModal();
        } catch (e) {
            formError.set(e instanceof Error ? e.message : 'Ошибка при сохранении');
        } finally {
            formSaving.set(false);
        }
    };

    const handleDelete = async (dish: OwnerDish) => {
        const ok = await Popup.confirm(`Удалить «${dish.name}» из меню?`);
        if (!ok) return;
        try {
            await ownerApi.deleteDish(dish.id);
            dishes.set(dishes.peek().filter((d) => d.id !== dish.id));
        } catch (e) {
            void Popup.alert(e instanceof Error ? e.message : 'Ошибка при удалении');
        }
    };

    return (
        <div class="owner-section">
            <div class="owner-section__head">
                <h3 class="owner-section__title">Меню</h3>
                <button type="button" class="owner-btn owner-btn_primary" onClick={openAdd}>
                    + Добавить блюдо
                </button>
            </div>

            <Show when={() => error() !== ''}>
                <div class="owner-error">{error}</div>
            </Show>
            <Show when={loading}>
                <div class="owner-loading">Загружаем меню…</div>
            </Show>
            <Show when={() => !loading() && dishes().length === 0 && error() === ''}>
                <div style="color:var(--text-gray);font-size:14px;padding:16px 0;">
                    Меню пока пусто — добавьте первое блюдо!
                </div>
            </Show>

            <div class="owner-menu">
                <For each={dishes} key={(d) => d.id}>
                    {(dish) => (
                        <div class="owner-dish-row">
                            <img
                                class="owner-dish-row__img"
                                src={dish.image_url || FALLBACK_DISH}
                                alt={dish.name}
                                onError={(e: Event) => {
                                    (e.target as HTMLImageElement).src = FALLBACK_DISH;
                                }}
                            />
                            <div class="owner-dish-row__info">
                                <div class="owner-dish-row__name">{dish.name}</div>
                                <div class="owner-dish-row__desc">{dish.description}</div>
                            </div>
                            <div class="owner-dish-row__price">{rublesDisplay(rawToRubles(dish.price))}</div>
                            <div class="owner-dish-row__actions">
                                <button
                                    type="button"
                                    class="owner-btn owner-btn_icon"
                                    title="Редактировать"
                                    onClick={() => openEdit(dish)}
                                >
                                    ✏️
                                </button>
                                <button
                                    type="button"
                                    class="owner-btn owner-btn_icon-danger"
                                    title="Удалить"
                                    onClick={() => {
                                        void handleDelete(dish);
                                    }}
                                >
                                    🗑
                                </button>
                            </div>
                        </div>
                    )}
                </For>
            </div>

            {/* Модалка добавления/редактирования */}
            <Show when={showModal}>
                <Modal title={editingDish.peek() ? 'Редактировать блюдо' : 'Добавить блюдо'} onClose={closeModal}>
                    <div class="owner-form-group">
                        <label>Название *</label>
                        <input
                            type="text"
                            class="owner-input"
                            placeholder="Название блюда"
                            value={editingDish.peek()?.name ?? ''}
                            ref={(el: Element | null) => {
                                nameEl = el as HTMLInputElement | null;
                            }}
                        />
                    </div>
                    <div class="owner-form-group">
                        <label>Описание</label>
                        <textarea
                            class="owner-textarea"
                            placeholder="Краткое описание"
                            ref={(el: Element | null) => {
                                descEl = el as HTMLTextAreaElement | null;
                                if (descEl) descEl.value = editingDish.peek()?.description ?? '';
                            }}
                        />
                    </div>
                    <div class="owner-form-group">
                        <label>Цена, ₽ *</label>
                        <input
                            type="number"
                            class="owner-input"
                            placeholder="0"
                            min="0"
                            step="0.01"
                            value={() => {
                                const d = editingDish();
                                return d ? String(rawToRubles(d.price)) : '';
                            }}
                            ref={(el: Element | null) => {
                                priceEl = el as HTMLInputElement | null;
                            }}
                        />
                    </div>
                    <div class="owner-form-group">
                        <label>Фото (webp / png / jpg)</label>
                        <div class="owner-file-pick">
                            <Show when={() => formPreview() !== ''}>
                                <img class="owner-file-pick__preview" src={formPreview} alt="preview" />
                            </Show>
                            <button type="button" class="owner-file-pick__btn" onClick={() => fileEl?.click()}>
                                {() => (formPreview() ? 'Изменить фото' : 'Выбрать фото')}
                            </button>
                            <input
                                type="file"
                                accept="image/webp,image/png,image/jpeg"
                                hidden
                                ref={(el: Element | null) => {
                                    fileEl = el as HTMLInputElement | null;
                                }}
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    <Show when={() => formError() !== ''}>
                        <div class="owner-error">{formError}</div>
                    </Show>

                    <div class="owner-modal__footer">
                        <button type="button" class="owner-btn owner-btn_ghost" onClick={closeModal}>
                            Отмена
                        </button>
                        <button
                            type="button"
                            class="owner-btn owner-btn_primary"
                            onClick={() => {
                                void handleSave();
                            }}
                            disabled={formSaving}
                        >
                            {() => (formSaving() ? 'Сохраняем…' : 'Сохранить')}
                        </button>
                    </div>
                </Modal>
            </Show>
        </div>
    );
}

// Вкладка настроек ресторана
interface SettingsTabProps {
    getBrand: () => OwnerBrand;
    onUpdate: (updated: OwnerBrand) => void;
    onDelete: () => void;
}

function SettingsTab({ getBrand, onUpdate, onDelete }: SettingsTabProps): VNode {
    let nameEl: HTMLInputElement | null = null;
    let descEl: HTMLTextAreaElement | null = null;
    let logoEl: HTMLInputElement | null = null;

    const logoPreview = signal(getBrand().logo_url);
    const logoSaving = signal(false);
    const saving = signal(false);
    const saveError = signal('');
    const saveOk = signal(false);

    const handleSaveInfo = async () => {
        const name = nameEl?.value.trim() ?? '';
        if (!name) {
            saveError.set('Название не может быть пустым');
            return;
        }
        saving.set(true);
        saveError.set('');
        saveOk.set(false);
        try {
            const updated = await ownerApi.updateBrand(getBrand().id, {
                name,
                description: descEl?.value.trim() ?? '',
            });
            onUpdate({ ...getBrand(), ...updated, id: getBrand().id });
            saveOk.set(true);
            setTimeout(() => saveOk.set(false), 3000);
        } catch (e) {
            saveError.set(e instanceof Error ? e.message : 'Ошибка при сохранении');
        } finally {
            saving.set(false);
        }
    };

    const handleLogoChange = async () => {
        const file = logoEl?.files?.[0];
        if (!file) return;
        logoPreview.set(URL.createObjectURL(file));
        logoSaving.set(true);
        try {
            await ownerApi.updateBrandLogo(getBrand().id, file);
        } catch (e) {
            void Popup.alert(e instanceof Error ? e.message : 'Ошибка при загрузке логотипа');
            logoPreview.set(getBrand().logo_url);
        } finally {
            logoSaving.set(false);
        }
    };

    const handleDelete = async () => {
        const ok = await Popup.confirm(`Удалить ресторан «${getBrand().name}»? Это действие нельзя отменить.`);
        if (!ok) return;
        try {
            await ownerApi.deleteBrand(getBrand().id);
            onDelete();
        } catch (e) {
            void Popup.alert(e instanceof Error ? e.message : 'Ошибка при удалении');
        }
    };

    return (
        <div class="owner-settings">
            {/* Логотип */}
            <div class="owner-settings-section">
                <h4 class="owner-settings-section__title">Логотип</h4>
                <div class="owner-logo-edit">
                    <img
                        class="owner-logo-edit__img"
                        src={logoPreview}
                        alt="logo"
                        onError={(e: Event) => {
                            (e.target as HTMLImageElement).src = FALLBACK_LOGO;
                        }}
                    />
                    <div class="owner-logo-edit__info">
                        <button
                            type="button"
                            class="owner-btn owner-btn_ghost"
                            disabled={logoSaving}
                            onClick={() => logoEl?.click()}
                        >
                            {() => (logoSaving() ? 'Загружаем…' : 'Изменить логотип')}
                        </button>
                        <span class="owner-logo-edit__hint">PNG, JPG или WebP · до 5 МБ</span>
                    </div>
                    <input
                        type="file"
                        accept="image/webp,image/png,image/jpeg"
                        hidden
                        ref={(el: Element | null) => {
                            logoEl = el as HTMLInputElement | null;
                        }}
                        onChange={() => {
                            void handleLogoChange();
                        }}
                    />
                </div>
            </div>

            {/* Основная информация */}
            <div class="owner-settings-section">
                <h4 class="owner-settings-section__title">Основная информация</h4>
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div class="owner-form-group">
                        <label>Название ресторана *</label>
                        <input
                            type="text"
                            class="owner-input"
                            value={getBrand().name}
                            ref={(el: Element | null) => {
                                nameEl = el as HTMLInputElement | null;
                            }}
                        />
                    </div>
                    <div class="owner-form-group">
                        <label>Описание</label>
                        <textarea
                            class="owner-textarea"
                            ref={(el: Element | null) => {
                                descEl = el as HTMLTextAreaElement | null;
                                if (descEl) descEl.value = getBrand().description ?? '';
                            }}
                        />
                    </div>

                    <Show when={() => saveError() !== ''}>
                        <div class="owner-error">{saveError}</div>
                    </Show>
                    <Show when={saveOk}>
                        <div style="color:#2ecc71;font-size:13px;">✓ Сохранено</div>
                    </Show>

                    <button
                        type="button"
                        class="owner-btn owner-btn_primary"
                        disabled={saving}
                        onClick={() => {
                            void handleSaveInfo();
                        }}
                    >
                        {() => (saving() ? 'Сохраняем…' : 'Сохранить изменения')}
                    </button>
                </div>
            </div>

            {/* Опасная зона */}
            <div class="owner-settings-section" style="border:1.5px solid rgba(231,76,60,0.25);">
                <h4 class="owner-settings-section__title" style="color:#e74c3c;">
                    Опасная зона
                </h4>
                <p style="font-size:13px;color:var(--text-gray);margin:0 0 14px;">
                    Удаление ресторана безвозвратно удалит все блюда и данные.
                </p>
                <button
                    type="button"
                    class="owner-btn owner-btn_danger"
                    onClick={() => {
                        void handleDelete();
                    }}
                >
                    🗑 Удалить ресторан
                </button>
            </div>
        </div>
    );
}

// Форма создания нового ресторана
interface CreateBrandModalProps {
    onCreated: (brand: OwnerBrand) => void;
    onClose: () => void;
}

function CreateBrandModal({ onCreated, onClose }: CreateBrandModalProps): VNode {
    let nameEl: HTMLInputElement | null = null;
    let descEl: HTMLTextAreaElement | null = null;
    let fileEl: HTMLInputElement | null = null;

    const logoPreview = signal('');
    const saving = signal(false);
    const error = signal('');
    let logoFile: File | null = null;

    const handleFileChange = () => {
        const f = fileEl?.files?.[0];
        if (!f) return;
        logoFile = f;
        logoPreview.set(URL.createObjectURL(f));
    };

    const handleCreate = async () => {
        const name = nameEl?.value.trim() ?? '';
        if (!name) {
            error.set('Введите название ресторана');
            return;
        }
        saving.set(true);
        error.set('');
        try {
            const created = await ownerApi.createBrand({
                name,
                description: descEl?.value.trim() ?? '',
                logo: logoFile ?? undefined,
            });
            onCreated({ ...created, id: String(created.id) });
        } catch (e) {
            error.set(e instanceof Error ? e.message : 'Ошибка при создании');
        } finally {
            saving.set(false);
        }
    };

    return (
        <Modal title="Новый ресторан" onClose={onClose}>
            <div class="owner-form-group">
                <label>Название *</label>
                <input
                    type="text"
                    class="owner-input"
                    placeholder="Название ресторана"
                    ref={(el: Element | null) => {
                        nameEl = el as HTMLInputElement | null;
                    }}
                />
            </div>
            <div class="owner-form-group">
                <label>Описание</label>
                <textarea
                    class="owner-textarea"
                    placeholder="Пара слов о ресторане"
                    ref={(el: Element | null) => {
                        descEl = el as HTMLTextAreaElement | null;
                    }}
                />
            </div>
            <div class="owner-form-group">
                <label>Логотип (необязательно)</label>
                <div class="owner-file-pick">
                    <Show when={() => logoPreview() !== ''}>
                        <img class="owner-file-pick__preview" src={logoPreview} alt="logo preview" />
                    </Show>
                    <button type="button" class="owner-file-pick__btn" onClick={() => fileEl?.click()}>
                        Выбрать файл
                    </button>
                    <input
                        type="file"
                        accept="image/webp,image/png,image/jpeg"
                        hidden
                        ref={(el: Element | null) => {
                            fileEl = el as HTMLInputElement | null;
                        }}
                        onChange={handleFileChange}
                    />
                    <span class="owner-file-pick__hint">PNG, JPG, WebP · до 5 МБ</span>
                </div>
            </div>

            <Show when={() => error() !== ''}>
                <div class="owner-error">{error}</div>
            </Show>

            <div class="owner-modal__footer">
                <button type="button" class="owner-btn owner-btn_ghost" onClick={onClose}>
                    Отмена
                </button>
                <button
                    type="button"
                    class="owner-btn owner-btn_primary"
                    disabled={saving}
                    onClick={() => {
                        void handleCreate();
                    }}
                >
                    {() => (saving() ? 'Создаём…' : 'Создать')}
                </button>
            </div>
        </Modal>
    );
}

// Главная страница владельца
export interface OwnerPageProps {
    isOwner: boolean;
}

export async function load(): Promise<OwnerPageProps> {
    // checkOwnerAccess вызывает API напрямую — не зависит от состояния userStore,
    // поэтому работает корректно при перезагрузке страницы (сессия читается из cookie,
    // а не из in-memory стора, который ещё не восстановлен).
    const isOwner = await ownerApi.checkOwnerAccess();
    return { isOwner };
}

type TabName = 'analytics' | 'menu' | 'settings';

export function OwnerPage({ isOwner }: OwnerPageProps): VNode {
    if (!isOwner) {
        return (
            <div class="owner-page">
                <div class="owner-main">
                    <div class="owner-forbidden">
                        <span class="owner-forbidden__icon">🔒</span>
                        <h2 class="owner-forbidden__title">Доступ запрещён</h2>
                        <p class="owner-forbidden__text">Панель владельца доступна только аккаунтам с ролью owner.</p>
                    </div>
                </div>
            </div>
        );
    }

    const brands = signal<OwnerBrand[]>(loadBrandsFromStorage());
    const selectedId = signal<string | null>(brands.peek()[0]?.id ?? null);
    // tabKey меняется когда меняется активная вкладка ИЛИ выбранный ресторан
    const activeTab = signal<TabName>('analytics');
    const showCreateModal = signal(false);

    // Сохраняем brands в localStorage при изменении
    const unsubBrands = brands.subscribe((next) => {
        saveBrandsToStorage(next);
    });
    onCleanup(unsubBrands);

    // Синхронизируем список брендов с сервером при монтировании.
    // Это исправляет «призраков» в localStorage (бренды, удалённые из БД вне фронта).
    onMount(() => {
        void ownerApi
            .getMyBrands()
            .then((serverBrands) => {
                brands.set(serverBrands);
                // Если текущий выбранный бренд исчез с сервера — выбираем первый из актуальных
                const currentId = selectedId.peek();
                if (currentId && !serverBrands.find((b) => b.id === currentId)) {
                    selectedId.set(serverBrands[0]?.id ?? null);
                } else if (!currentId && serverBrands.length > 0) {
                    selectedId.set(serverBrands[0].id);
                }
            })
            .catch(() => {
                // При недоступности API оставляем данные из localStorage без изменений
            });
    });

    const selectedBrand = (): OwnerBrand | null => brands().find((b) => b.id === selectedId()) ?? null;

    const handleBrandCreated = (brand: OwnerBrand) => {
        brands.set([...brands.peek(), brand]);
        selectedId.set(brand.id);
        showCreateModal.set(false);
    };

    const handleBrandUpdated = (updated: OwnerBrand) => {
        brands.set(brands.peek().map((b) => (b.id === updated.id ? updated : b)));
    };

    const handleBrandDeleted = () => {
        const next = brands.peek().filter((b) => b.id !== selectedId.peek());
        brands.set(next);
        selectedId.set(next[0]?.id ?? null);
        activeTab.set('analytics');
    };

    const handleSelectBrand = (id: string) => {
        if (selectedId.peek() === id) return;
        // Сбрасываем вкладку чтобы принудительно remount tab-компонентов
        activeTab.set('menu');
        selectedId.set(id);
        requestAnimationFrame(() => activeTab.set('analytics'));
    };

    const TAB_LABELS: Record<TabName, string> = {
        analytics: '📊 Аналитика',
        menu: '🍽 Меню',
        settings: '⚙️ Настройки',
    };

    return (
        <div class="owner-page">
            {/* Sidebar */}
            <aside class="owner-sidebar">
                <div class="owner-sidebar__title">Мои рестораны</div>
                <div class="owner-sidebar__list">
                    <For each={brands} key={(b) => b.id}>
                        {(brand) => (
                            <div
                                class={() =>
                                    selectedId() === brand.id
                                        ? 'owner-sidebar__item owner-sidebar__item_active'
                                        : 'owner-sidebar__item'
                                }
                                role="button"
                                tabindex="0"
                                onClick={() => handleSelectBrand(brand.id)}
                            >
                                <img
                                    class="owner-sidebar__item-logo"
                                    src={brand.logo_url || FALLBACK_LOGO}
                                    alt={brand.name}
                                    onError={(e: Event) => {
                                        (e.target as HTMLImageElement).src = FALLBACK_LOGO;
                                    }}
                                />
                                <span class="owner-sidebar__item-name">{brand.name}</span>
                            </div>
                        )}
                    </For>
                </div>
                <button type="button" class="owner-sidebar__add-btn" onClick={() => showCreateModal.set(true)}>
                    ＋ Добавить ресторан
                </button>
            </aside>

            {/* Основной контент */}
            <main class="owner-main">
                <Show
                    when={() => selectedBrand() !== null}
                    fallback={
                        <div class="owner-empty">
                            <span class="owner-empty__icon">🍴</span>
                            <h2 class="owner-empty__title">Нет ресторанов</h2>
                            <p class="owner-empty__text">
                                Создайте первый ресторан, чтобы управлять меню и видеть статистику.
                            </p>
                            <button type="button" class="owner-empty__btn" onClick={() => showCreateModal.set(true)}>
                                Создать ресторан
                            </button>
                        </div>
                    }
                >
                    {/* Заголовок ресторана */}
                    <div class="owner-rest-header">
                        <img
                            class="owner-rest-header__logo"
                            src={() => selectedBrand()?.logo_url || FALLBACK_LOGO}
                            alt="logo"
                            onError={(e: Event) => {
                                (e.target as HTMLImageElement).src = FALLBACK_LOGO;
                            }}
                        />
                        <div class="owner-rest-header__info">
                            <div class="owner-rest-header__name">{() => selectedBrand()?.name ?? ''}</div>
                            <div class="owner-rest-header__desc">{() => selectedBrand()?.description ?? ''}</div>
                        </div>
                        <div class="owner-rest-header__actions">
                            <span style="font-size:12px;color:var(--text-gray);">
                                {() => `ID: ${selectedBrand()?.id ?? ''}`}
                            </span>
                        </div>
                    </div>

                    {/* Вкладки */}
                    <div class="owner-tabs">
                        {(['analytics', 'menu', 'settings'] as TabName[]).map((tab) => (
                            <button
                                type="button"
                                class={() =>
                                    activeTab() === tab ? 'owner-tabs__btn owner-tabs__btn_active' : 'owner-tabs__btn'
                                }
                                onClick={() => activeTab.set(tab)}
                            >
                                {TAB_LABELS[tab]}
                            </button>
                        ))}
                    </div>

                    {/* Аналитика */}
                    <Show when={() => activeTab() === 'analytics' && selectedBrand() !== null}>
                        <AnalyticsTab getBrandId={() => selectedBrand()?.id ?? ''} />
                    </Show>

                    {/* Меню */}
                    <Show when={() => activeTab() === 'menu' && selectedBrand() !== null}>
                        <MenuTab getBrandId={() => selectedBrand()?.id ?? ''} />
                    </Show>

                    {/* Настройки */}
                    <Show when={() => activeTab() === 'settings' && selectedBrand() !== null}>
                        <SettingsTab
                            getBrand={() => selectedBrand()!}
                            onUpdate={handleBrandUpdated}
                            onDelete={handleBrandDeleted}
                        />
                    </Show>
                </Show>
            </main>

            {/* Создание ресторана */}
            <Show when={showCreateModal}>
                <CreateBrandModal onCreated={handleBrandCreated} onClose={() => showCreateModal.set(false)} />
            </Show>
        </div>
    );
}
