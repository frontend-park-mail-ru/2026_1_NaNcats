// Виджет «Колесо пиццули»: модалка с круглым колесом из 9 секторов и
// стикером-пиццулей. Управление императивное через controllerRef, чтобы
// открывать из шапки. Само вращение делает CSS-transition, сектор выпавшего
// приза определяет бэкенд через POST /api/profile/wheel/spin.

import './luckyWheelModal.scss';

import { ApiError } from '@shared/api/http';
import { wheelApi, type WheelSector, type WheelSpinResult } from '@entities/wheel';
import { refreshAchievements } from '@features/profile/achievements';
import { computed, signal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/**
 * Стикер «пиццуля» — внешняя гифка. Если URL станет недоступен, используем
 * fallback-эмодзи в onError.
 */
const PIZZULYA_GIF_URL = 'https://cdn.dprofile.ru/public/60222/109261/5023ee194828983.6606f5d69fbe5.gif';

/** Палитра из 9 пастельных цветов; подобрана так, чтобы соседние сектора отличались. */
const SECTOR_COLORS = [
    '#FFD8B1',
    '#FFB1C1',
    '#C1E0FF',
    '#D8FFC1',
    '#FFEEC1',
    '#E1C1FF',
    '#FFC1F0',
    '#B1FFEC',
    '#FFC1B1',
];

/** Длительность анимации вращения (мс). Должна совпадать с CSS-transition. */
const SPIN_DURATION_MS = 4200;

/** Сколько полных оборотов «накручиваем» перед остановкой — добавляет драматизма. */
const FULL_ROTATIONS_BEFORE_LAND = 5;

export interface LuckyWheelModalController {
    open(): void;
    close(): void;
}

export interface LuckyWheelModalProps {
    controllerRef?: (ctl: LuckyWheelModalController | null) => void;
}

interface SectorGeom {
    sector: WheelSector;
    /** Путь d="..." для SVG-сектора. */
    path: string;
    /** Положение эмодзи в SVG-координатах (центр дуги, радиус ~30). */
    emojiX: number;
    emojiY: number;
    /** Угол центра сектора в градусах (0° — сверху, по часовой стрелке). */
    centerAngle: number;
    color: string;
}

/**
 * Конвертирует полярные координаты (угол от 12 часов, по часовой) в декартовы
 * для SVG. radius — расстояние от центра колеса.
 */
function polar(angleDeg: number, radius: number, cx = 50, cy = 50) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/**
 * Строит SVG-path сектора круга радиуса 48 с центром (50,50), от startAngle
 * до endAngle (в градусах, 0° = верх, по часовой стрелке).
 */
function sectorPath(startAngle: number, endAngle: number): string {
    const r = 48;
    const start = polar(startAngle, r);
    const end = polar(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M 50 50 L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function buildGeometry(sectors: WheelSector[]): SectorGeom[] {
    if (sectors.length === 0) return [];
    const step = 360 / sectors.length;
    return sectors.map((sector, i) => {
        const startAngle = i * step;
        const endAngle = startAngle + step;
        const centerAngle = startAngle + step / 2;
        const emojiPos = polar(centerAngle, 30);
        return {
            sector,
            path: sectorPath(startAngle, endAngle),
            emojiX: emojiPos.x,
            emojiY: emojiPos.y,
            centerAngle,
            color: SECTOR_COLORS[i % SECTOR_COLORS.length],
        };
    });
}

/**
 * Возвращает финальный угол поворота колеса в градусах для того, чтобы центр
 * сектора с индексом winnerIdx оказался под стрелкой (сверху).
 *
 * Стрелка зафиксирована вверху колеса (12 часов = 0°). Центр сектора N лежит
 * на угле centerAngle от 12 часов. Чтобы сектор оказался под стрелкой, колесо
 * нужно повернуть так, чтобы centerAngle сместился к 0° — т.е. на -centerAngle
 * (отрицательное вращение по часовой). Чтобы CSS-rotate шёл вперёд и был
 * драматичным, добавляем N полных оборотов.
 */
function calcLandingRotation(winnerIdx: number, totalSectors: number, currentRotation: number): number {
    const step = 360 / totalSectors;
    const centerAngle = winnerIdx * step + step / 2;
    // Округляем currentRotation до полного оборота, чтобы стартовать с «нуля» и не накапливать дрожание.
    const fullRotations = Math.ceil(currentRotation / 360) + FULL_ROTATIONS_BEFORE_LAND;
    return fullRotations * 360 - centerAngle;
}

/** Колесо пиццули в виде модалки. */
export function LuckyWheelModal(props: LuckyWheelModalProps): VNode {
    const isOpen = signal<boolean>(false);
    const sectors = signal<WheelSector[]>([]);
    const sectorsLoaded = signal<boolean>(false);
    const sectorsError = signal<string>('');
    const isSpinning = signal<boolean>(false);
    /** Результат последней прокрутки в текущей сессии модалки; null до первого спина. */
    const result = signal<WheelSpinResult | null>(null);
    /** Сообщение об ошибке оплаты (кулдаун, сеть и т.п.). */
    const spinError = signal<string>('');
    /** Накопленный угол вращения колеса в градусах. */
    const rotation = signal<number>(0);
    /** Флаг короткой обратной связи на кнопке «Скопировать». */
    const promoCopied = signal<boolean>(false);
    let promoCopiedTimer: ReturnType<typeof setTimeout> | null = null;
    /** Сообщение от пиццули. Меняется в зависимости от состояния. */
    const characterMessage = computed<string>(() => {
        if (spinError() !== '') return spinError();
        const r = result();
        if (r !== null) return r.message;
        if (isSpinning()) return 'Крутим-вертим…';
        return 'Привет! Нажми «Крутить», чтобы испытать удачу 🎰';
    });

    const geometry = computed<SectorGeom[]>(() => buildGeometry(sectors()));

    const ensureSectors = async () => {
        if (sectorsLoaded.peek()) return;
        try {
            const resp = await wheelApi.getSectors();
            sectors.set(resp.sectors);
            sectorsLoaded.set(true);
            sectorsError.set('');
        } catch (e) {
            console.error('lucky-wheel: failed to load sectors', e);
            sectorsError.set('Не удалось загрузить колесо. Попробуйте позже.');
        }
    };

    const handleSpin = async () => {
        if (isSpinning.peek()) return;
        if (sectors.peek().length === 0) return;
        spinError.set('');
        result.set(null);
        isSpinning.set(true);
        try {
            const r = await wheelApi.spin();
            // Раскручиваем колесо до выпавшего сектора.
            const idx = sectors.peek().findIndex((s) => s.id === r.sector_id);
            if (idx >= 0) {
                rotation.set(calcLandingRotation(idx, sectors.peek().length, rotation.peek()));
            }
            // Показываем результат только после окончания вращения, чтобы
            // не спойлерить пользователю выигрыш заранее.
            window.setTimeout(() => {
                result.set(r);
                isSpinning.set(false);
            }, SPIN_DURATION_MS);
            // Бэк после спина мог выдать first_spin / lucky_wheel_winner —
            // обновляем кэш ачивок, чтобы счётчик в профиле сразу подтянулся.
            void refreshAchievements();
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Не удалось крутануть колесо';
            spinError.set(msg);
            isSpinning.set(false);
        }
    };

    const handleCopyPromo = () => {
        const code = result.peek()?.promo_code;
        if (!code) return;
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(code).catch(() => {
                /* ignore */
            });
        }
        promoCopied.set(true);
        if (promoCopiedTimer !== null) clearTimeout(promoCopiedTimer);
        promoCopiedTimer = setTimeout(() => {
            promoCopied.set(false);
            promoCopiedTimer = null;
        }, 1800);
    };

    const open = () => {
        if (isOpen.peek()) return;
        isOpen.set(true);
        result.set(null);
        spinError.set('');
        promoCopied.set(false);
        if (promoCopiedTimer !== null) {
            clearTimeout(promoCopiedTimer);
            promoCopiedTimer = null;
        }
        void ensureSectors();
    };
    const close = () => {
        if (!isOpen.peek()) return;
        isOpen.set(false);
        if (promoCopiedTimer !== null) {
            clearTimeout(promoCopiedTimer);
            promoCopiedTimer = null;
        }
        promoCopied.set(false);
    };

    const controller: LuckyWheelModalController = { open, close };
    if (props.controllerRef) props.controllerRef(controller);

    /** Класс кнопки спина — disabled пока крутится или нет секторов. */
    const spinBtnDisabled = computed<boolean>(() => {
        if (isSpinning()) return true;
        if (sectors().length === 0) return true;
        // Дополнительная попытка («реролл», sector_id=8) сбрасывает кулдаун на бэке,
        // поэтому после неё снова разрешаем спин (result сбрасывается ниже).
        return false;
    });

    return (
        <div
            class={() => (isOpen() ? 'wheel-modal-overlay wheel-modal-overlay_open' : 'wheel-modal-overlay')}
            onClick={(e: Event) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div class="wheel-modal">
                <button type="button" class="wheel-modal__close" aria-label="Закрыть" onClick={close}>
                    ×
                </button>
                <h2 class="wheel-modal__title">Колесо Пиццули</h2>

                <Show
                    when={() => sectorsError() === ''}
                    fallback={<div class="wheel-modal__error">{sectorsError}</div>}
                >
                    <div class="wheel-modal__body">
                        <div class="wheel-stage">
                            <div class="wheel-pointer" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="34" height="34">
                                    <path d="M12 22 L4 6 L20 6 Z" fill="#0e1117" />
                                    <path d="M12 22 L4 6 L20 6 Z" fill="none" stroke="#fff" stroke-width="1.5" />
                                </svg>
                            </div>
                            <div
                                class={() => (isSpinning() ? 'wheel-disc wheel-disc_spinning' : 'wheel-disc')}
                                style={() => `transform: rotate(${rotation()}deg);`}
                            >
                                <svg viewBox="0 0 100 100" class="wheel-disc__svg" aria-hidden="true">
                                    <For each={geometry} key={(g) => g.sector.id}>
                                        {(g) => (
                                            <g>
                                                <path d={g.path} fill={g.color} stroke="#0e1117" stroke-width="0.5" />
                                                <text
                                                    x={String(g.emojiX)}
                                                    y={String(g.emojiY)}
                                                    text-anchor="middle"
                                                    dominant-baseline="central"
                                                    font-size="9"
                                                    transform={`rotate(${g.centerAngle} ${g.emojiX} ${g.emojiY})`}
                                                >
                                                    {g.sector.emoji}
                                                </text>
                                            </g>
                                        )}
                                    </For>
                                    <circle cx="50" cy="50" r="6" fill="#fff" stroke="#0e1117" stroke-width="0.8" />
                                </svg>
                            </div>
                        </div>

                        <div class="wheel-character">
                            <div class="wheel-speech" aria-live="polite">
                                {characterMessage}
                                <Show when={() => result() !== null && (result()?.promo_code ?? '') !== ''}>
                                    <div class="wheel-speech__promo">
                                        <div class="wheel-speech__promo-label">Ваш промокод:</div>
                                        <div class="wheel-speech__promo-row">
                                            <code class="wheel-speech__promo-code">
                                                {() => result()?.promo_code ?? ''}
                                            </code>
                                            <button
                                                type="button"
                                                class={() =>
                                                    promoCopied()
                                                        ? 'wheel-speech__promo-copy wheel-speech__promo-copy_copied'
                                                        : 'wheel-speech__promo-copy'
                                                }
                                                onClick={handleCopyPromo}
                                                title="Копировать промокод"
                                            >
                                                <Show when={promoCopied} fallback={'Скопировать'}>
                                                    ✓ Скопировано
                                                </Show>
                                            </button>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                            <img
                                class="wheel-character__sticker"
                                src={PIZZULYA_GIF_URL}
                                alt="Пиццуля"
                                onError={(e: Event) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallback = img.nextElementSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                            <div class="wheel-character__fallback">🍕</div>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="wheel-modal__spin-btn"
                        disabled={spinBtnDisabled}
                        onClick={() => {
                            void handleSpin();
                        }}
                    >
                        {() => (isSpinning() ? 'Крутим…' : 'Крутить')}
                    </button>
                </Show>
            </div>
        </div>
    );
}
