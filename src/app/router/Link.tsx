/**
 * Компонент Link: ссылка, инициирующая программный переход через роутер.
 *
 * Рендерит обычный `<a href=...>`, чтобы работали middle-click, копирование адреса
 * и SEO. Перехват клика только для обычного левого клика без модификаторов; ctrl/cmd,
 * shift, alt, middle/right-click уходят дефолтному поведению браузера.
 */

import type { VNode } from '@shared/lib/vdom';

import { router } from './index';

/** Пропсы Link: обязателен только `to`, остальные атрибуты `<a>` идут через index-signature. */
export interface LinkProps {
    /** Целевой URL для перехода (с query-частью или без). */
    to: string;
    /** Дочерние узлы, отображаемые внутри ссылки. */
    children?: unknown;
    /** Любые дополнительные пропсы (class, id, aria-* и т.п.). */
    [prop: string]: unknown;
}

/** true, если это обычный левый клик без модификаторов (модификаторные клики оставляем браузеру). */
function isPlainLeftClick(event: MouseEvent): boolean {
    return (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
    );
}

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
