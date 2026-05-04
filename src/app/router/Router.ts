import type { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';

/**
 * Фабрика роута: асинхронно возвращает свежий экземпляр компонента страницы и
 * пропсы для его монтирования.
 *
 * Возвращаемый промис позволяет лениво подгружать чанк страницы динамическим
 * импортом и при необходимости заранее запросить данные через статический
 * `load()` страницы.
 *
 * @template P Тип пропсов соответствующего компонента страницы.
 */
export type RouteFactory<P extends object> = () => Promise<{
    component: Component<P>;
    props: P;
}>;

/**
 * Запись таблицы роутов: хранит фабрику страницы со стёртым типом пропсов,
 * чтобы разные роуты с разными пропсами можно было держать в одной коллекции.
 */
interface RouteEntry {
    /** Фабрика, возвращающая компонент и пропсы для монтирования. */
    factory: () => Promise<{ component: Component<object>; props: object }>;
}

/**
 * Клиентский роутер на History API.
 *
 * Хранит таблицу путь → фабрика страницы, перехватывает клики по ссылкам с
 * классом `router-link` и навигацию `popstate`, монтирует страницу в общий
 * корневой узел и уничтожает предыдущую перед монтированием новой. Если путь
 * не зарегистрирован, отрисовывается роут `notFound`. Ошибка фабрики или
 * монтирования логируется и не прерывает работу приложения.
 */
export class Router {
    private readonly routes = new Map<string, RouteEntry>();
    private active: Component<object> | null = null;

    /**
     * @param root DOM-узел, в который монтируются страницы.
     */
    constructor(private readonly root: HTMLElement) {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const link = target.closest('.router-link') as HTMLAnchorElement | null;
            if (!link) return;
            const path = link.getAttribute('href');
            if (!path) return;
            e.preventDefault();
            this.go(path);
        });
        window.addEventListener('popstate', () => void this.render(window.location.pathname));
    }

    /**
     * Регистрирует фабрику страницы для указанного пути.
     *
     * Возвращает сам роутер, чтобы регистрации можно было сцеплять. Повторная
     * регистрация того же пути перезаписывает предыдущую запись.
     *
     * @template P Тип пропсов компонента страницы.
     * @param path Путь без query-строки, по которому будет смонтирована страница.
     * @param factory Асинхронная фабрика, создающая компонент и его пропсы.
     * @returns Этот же экземпляр роутера для сцепления вызовов.
     */
    register<P extends object>(path: string, factory: RouteFactory<P>): this {
        this.routes.set(path, { factory: factory as unknown as RouteEntry['factory'] });
        return this;
    }

    /**
     * Программно переходит на указанный путь.
     *
     * Добавляет запись в стек истории браузера и инициирует отрисовку. При
     * наличии query-строки она отбрасывается перед поиском записи в таблице,
     * так как роуты регистрируются по чистому пути.
     *
     * @param path Целевой путь, при необходимости с query-строкой.
     */
    go(path: string): void {
        window.history.pushState(null, '', path);
        void this.render(path.split('?')[0]);
    }

    /**
     * Отрисовывает страницу, соответствующую пути.
     *
     * Если путь не найден, используется фабрика роута `notFound`. Перед
     * монтированием новой страницы текущая активная уничтожается, чтобы её
     * подписки и таймеры освободились. Любая ошибка фабрики или монтирования
     * перехватывается и логируется: приложение остаётся в рабочем состоянии
     * со старой уничтоженной страницей и пустым корнем.
     *
     * @param path Чистый путь без query-строки.
     * @returns Промис, разрешающийся после монтирования или после обработки ошибки.
     */
    async render(path: string): Promise<void> {
        const entry = this.routes.get(path) ?? this.routes.get(ROUTES.notFound);
        if (!entry) return;

        if (this.active) {
            this.active.destroy();
            this.active = null;
        }

        try {
            const { component, props } = await entry.factory();
            component.mount(this.root, props);
            this.active = component;
        } catch (e) {
            console.warn(`router: route "${path}" failed`, e);
        }
    }
}
