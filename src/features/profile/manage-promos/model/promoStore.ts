// Стор промокодов: загрузка с бэкенда, привязка, применение к корзине.
// Синхронизирует состояние между модалкой профиля, корзиной и чекаутом.

import { signal } from '@shared/lib/signals';
import { httpClient } from '@shared/api/http/HttpClient';
import { cartStore } from '@entities/cart';
import { restaurantApi } from '@entities/restaurant';
import { dtoToPromo, type Promo, type PromoDTO } from './types';

/** Кэш названий брендов по id, чтобы не запрашивать одно и то же дважды. */
const brandNameCache = new Map<string, string>();

/**
 * Возвращает карту «id бренда → название» для брендов из промокодов. Запрашивает
 * только незнакомые id; неизвестные (например, удалённые) молча пропускаются —
 * для них останется обобщённый текст условия.
 *
 * @param dtos Промокоды, из которых берутся id брендов.
 * @returns Карта «id → название бренда».
 */
async function resolveBrandNames(dtos: PromoDTO[]): Promise<Record<string, string>> {
    const ids = [...new Set(dtos.flatMap((d) => d.restaurant_brand_ids ?? []).map(String))];
    const missing = ids.filter((id) => !brandNameCache.has(id));
    await Promise.all(
        missing.map(async (id) => {
            try {
                const brand = await restaurantApi.getBrand(id);
                brandNameCache.set(id, brand.name);
            } catch {
                // Бренд не найден/удалён — оставляем без названия.
            }
        }),
    );
    const result: Record<string, string> = {};
    for (const id of ids) {
        const name = brandNameCache.get(id);
        if (name !== undefined) result[id] = name;
    }
    return result;
}

/** Список промокодов пользователя. */
const promos = signal<Promo[]>([]);

const STORAGE_KEY = 'nancats:applied_promo';

/** Код применённого промокода или пустая строка. Восстанавливается из sessionStorage. */
const appliedCode = signal<string>(
    (() => {
        try {
            return sessionStorage.getItem(STORAGE_KEY) ?? '';
        } catch {
            return '';
        }
    })(),
);

/** Флаг: данные загружены хотя бы раз. */
let loaded = false;

/** Загружает промокоды пользователя с бэкенда. */
export async function loadPromos(): Promise<void> {
    try {
        const resp = await httpClient.get('/promos');
        if (!resp.ok) return;
        const dtos: PromoDTO[] = await resp.json();
        const brandNames = await resolveBrandNames(dtos);
        promos.set(dtos.map((dto) => dtoToPromo(dto, brandNames)));
    } catch (e) {
        console.warn('promoStore: loadPromos failed', e);
    } finally {
        loaded = true;
    }
}

/** Загружает, если ещё не загружали. */
export async function ensureLoaded(): Promise<void> {
    if (!loaded) await loadPromos();
}

/** Реактивный аксессор списка промокодов. */
export const promosAccessor = promos;

/** Реактивный аксессор применённого кода. */
export const appliedCodeAccessor = appliedCode;

/** Возвращает актуальный массив промокодов. */
export function getPromos(): Promo[] {
    return promos();
}

/** Возвращает код применённого промокода. */
export function getAppliedCode(): string {
    return appliedCode();
}

/** Сохраняет код в sessionStorage. */
function persistCode(code: string): void {
    try {
        if (code) sessionStorage.setItem(STORAGE_KEY, code);
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* noop */
    }
}

/** Применяет промокод к корзине и автоматически привязывает к профилю.
 *  409 = уже привязан — промокод остаётся применённым(нормальное поведение).
 *  4xx (кроме 409) = промокод не найден или истёк — сбрасываем применение.
 */
export function applyPromo(code: string): void {
    const c = code.toUpperCase().trim();
    appliedCode.set(c);
    persistCode(c);
    if (c) {
        void httpClient
            .post('/promos/bind', { code: c })
            .then((resp) => {
                // 409 = уже привязан - всё норм, оставляем как есть.
                if (!resp.ok && resp.status !== 409) {
                    // Промокод не найден, истёк и т.п. — снимаем применение.
                    appliedCode.set('');
                    persistCode('');
                }
            })
            .catch(() => {
                // Сетевая ошибка —  validate на чекауте исправит.
            });
    }
}

/** Результат проверки и применения промокода против текущей корзины. */
export interface ApplyPromoResult {
    ok: boolean;
    /** Бэкендовский reason при ok=false; пустая строка при ok=true. */
    reason: string;
}

/**
 * Валидирует промокод против текущего состояния корзины и применяет его,
 * если валидация прошла. В отличие от {@link applyPromo}, не даёт «пустого»
 * apply, который потом тихо снимается на чекауте.
 *
 * Используется в местах, где у пользователя ещё нет визуального
 * подтверждения скидки (модалка профиля, поле ввода промокода в корзине).
 */
export async function tryApplyPromo(code: string): Promise<ApplyPromoResult> {
    const c = code.toUpperCase().trim();
    if (!c) return { ok: false, reason: 'promo not found' };

    const snap = cartStore.getState();
    try {
        const resp = await httpClient.post('/promos/validate', {
            code: c,
            restaurant_brand_id: snap.restaurantId,
            order_amount: snap.totalCost,
            delivery_cost: 0,
            service_fee: 0,
        });
        if (!resp.ok) return { ok: false, reason: 'promo not found' };
        const data = await resp.json();
        if (data.valid !== true) {
            return { ok: false, reason: String(data.reason ?? '') };
        }
        applyPromo(c);
        return { ok: true, reason: '' };
    } catch {
        return { ok: false, reason: 'promo not found' };
    }
}

/** Удаляет применённый промокод. */
export function removeAppliedPromo(): void {
    appliedCode.set('');
    persistCode('');
}

/** Проверяет, является ли промокод применённым. */
export function isApplied(code: string): boolean {
    return appliedCode() === code;
}

/**
 * Привязывает промокод по коду к профилю пользователя.
 * Возвращает true при успехе, false если код не найден или уже привязан.
 */
export async function addPromo(code: string): Promise<boolean> {
    const trimmed = code.toUpperCase().trim();
    if (!trimmed) return false;

    if (promos.peek().some((p) => p.code === trimmed)) return false;

    try {
        const resp = await httpClient.post('/promos/bind', { code: trimmed });
        if (!resp.ok) return false;
        const dto: PromoDTO = await resp.json();
        const brandNames = await resolveBrandNames([dto]);
        promos.set([...promos.peek(), dtoToPromo(dto, brandNames)]);
        return true;
    } catch {
        return false;
    }
}
