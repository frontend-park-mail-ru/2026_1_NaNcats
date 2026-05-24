// Стор промокодов: загрузка с бэкенда, привязка, применение к корзине.
// Синхронизирует состояние между модалкой профиля, корзиной и чекаутом.

import { signal } from '@shared/lib/signals';
import { httpClient } from '@shared/api/http/HttpClient';
import { dtoToPromo, type Promo, type PromoDTO } from './types';

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
        promos.set(dtos.map(dtoToPromo));
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
        promos.set([...promos.peek(), dtoToPromo(dto)]);
        return true;
    } catch {
        return false;
    }
}
