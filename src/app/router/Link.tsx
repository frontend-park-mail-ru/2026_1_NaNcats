/**
 * Компонент Link: ссылка, инициирующая программный переход через роутер.
 *
 * Рендерит обычный `<a href=...>`: для пользователя и для SEO это валидная
 * ссылка, по которой можно сделать middle-click "открыть в новой вкладке",
 * скопировать адрес и т.д. Перехват клика проходит только для основного
 * левого клика без модификаторов: остальные сценарии (ctrl/cmd для новой
 * вкладки, shift для нового окна, alt для скачивания, middle/right-click)
 * пропускаются дефолтному поведению браузера.
 *
 * Внутри обработчика клика вызывается router.go(to): он сам сделает pushState,
 * выставит pending-стейт и запустит загрузку. Document-level click handler в
 * роутере не нужен, потому что каждая ссылка приложения это Link.
 */

import type { VNode } from '@shared/lib/vdom';

import { router } from './index';

/**
 * Пропсы компонента Link.
 *
 * Поле to обязательно: это целевой URL. Остальные поля (class, id, aria-* и
 * пр.) намеренно вынесены в открытую index-signature, чтобы можно было
 * передавать любые валидные атрибуты `<a>` без повторного описания каждого
 * в типе. Конкретную проверку атрибутов делает рантайм-слой props.ts.
 */
export interface LinkProps {
    /** Целевой URL для перехода (с query-частью или без). */
    to: string;
    /** Дочерние узлы, отображаемые внутри ссылки. */
    children?: unknown;
    /** Любые дополнительные пропсы (class, id, aria-* и т.п.). */
    [prop: string]: unknown;
}

/**
 * Проверяет, что click это обычный левый клик без модификаторов.
 *
 * Браузер по умолчанию для модификаторных кликов делает специальные действия
 * (открыть в новой вкладке, в новом окне, начать скачивание). SPA не должен
 * это поведение перехватывать, иначе ломается UX (пользователь ждёт нового
 * таба, а получает молчаливый no-op).
 *
 * @param event Событие клика.
 * @returns true, если событие следует перехватить и обработать через роутер.
 */
function isPlainLeftClick(event: MouseEvent): boolean {
    return (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
    );
}

/**
 * Создаёт ссылку, делегирующую переход роутеру.
 *
 * Реализация намеренно тонкая: всё, что выходит за пределы перехвата клика,
 * остаётся на стороне обычного `<a>`. Это совместимо с reader-mode браузеров,
 * screen-reader-ами и тем, как пользователи копируют адреса.
 *
 * @param props Поле to обязательно; остальные пропсы пробрасываются на `<a>`.
 * @returns VNode с `<a href={to} onClick=...>`, готовый к монтированию.
 */
export function Link(props: LinkProps): VNode {
    const { to, children, ...rest } = props;

    const handleClick = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        if (!isPlainLeftClick(mouseEvent)) {
            return;
        }
        mouseEvent.preventDefault();
        void router.go(to);
    };

    return (
        <a href={to} onClick={handleClick} {...rest}>
            {children}
        </a>
    ) as VNode;
}
