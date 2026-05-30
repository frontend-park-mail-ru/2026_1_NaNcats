/**
 * «Голый» layout-shell без шапки: для самостоятельных страниц, открываемых в
 * отдельной вкладке (политика конфиденциальности, условия использования).
 *
 * Сам является скролл-контейнером (на десктопе `#root` имеет overflow:hidden),
 * поэтому длинный документ прокручивается внутри `.bare-layout`. На мобилке
 * скролл отдаётся документу (см. layout.scss). `#modal-root`/`<ModalRoot/>`
 * включены на случай попапов из общих компонентов.
 */

import './layout.scss';
import { Outlet } from '@app/router';
import { ModalRoot } from '@shared/lib/portal';
import type { VNode } from '@shared/lib/vdom';

export function BareLayout(): VNode {
    return (
        <div class="bare-layout">
            <main class="bare-main">
                <Outlet />
            </main>
            <div id="modal-root" />
            <ModalRoot />
        </div>
    ) as VNode;
}
