// Обёртка для юридических страниц (политика конфиденциальности, условия
// использования): единый контейнер, шапка с реквизитами и типографика тела.

import './legal.scss';

import { ROUTES } from '@shared/config/routes';
import type { VNode } from '@shared/lib/vdom';

/** Реквизиты документа для шапки. */
export interface LegalMeta {
    /** Подпись и значение, напр. «Сервис» / «FoodCourt». */
    label: string;
    value: string;
}

export interface LegalDocumentProps {
    /** Заголовок документа. */
    title: string;
    /** Реквизиты в шапке (сервис, оператор, контакт, редакция). */
    meta: LegalMeta[];
    /** Тело документа. */
    children: VNode | VNode[];
}

/** Контейнер юридической страницы с шапкой-реквизитами и телом. */
export function LegalDocument(props: LegalDocumentProps): VNode {
    return (
        <div class="legal-page">
            <article class="legal-doc">
                <h1 class="legal-doc__title">{props.title}</h1>
                <dl class="legal-doc__meta">
                    {props.meta.map((m) => (
                        <div class="legal-doc__meta-row">
                            <dt class="legal-doc__meta-label">{m.label}</dt>
                            <dd class="legal-doc__meta-value">{m.value}</dd>
                        </div>
                    ))}
                </dl>
                <div class="legal-doc__body">{props.children}</div>
                <div class="legal-doc__footer">
                    <a href={ROUTES.home} class="legal-doc__home-link">
                        ← На главную
                    </a>
                </div>
            </article>
        </div>
    );
}
