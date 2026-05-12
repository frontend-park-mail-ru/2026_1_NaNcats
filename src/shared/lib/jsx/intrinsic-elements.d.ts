/**
 * Минимальная типизация JSX-namespace для собственного importSource
 * (jsxImportSource: '@shared/lib/jsx' в tsconfig.json). Узкие override'ы для
 * ходовых тегов дают подсказки IDE; конкретные значения остаются unknown,
 * точную проверку пропсов делает рантайм props.ts.
 */

declare namespace JSX {
    /** Тип, который возвращают фабрики jsx, jsxs и jsxDEV (VNode из ядра VDOM). */
    type Element = import('@shared/lib/vdom').VNode;

    /** Имя пропа, в котором JSX-компилятор хранит вложенных детей. */
    interface ElementChildrenAttribute {
        children: object;
    }

    /**
     * Общая база для узких override'ов: open index-signature по unknown плюс
     * самые ходовые пропсы. Все поля опциональные и unknown, чтобы не
     * расходиться с аксессорами сигналов и обработчиками событий.
     */
    interface HTMLAttributesBase {
        /** Идентификатор элемента. */
        id?: unknown;
        /** Класс через class или className: оба ключа равноправны. */
        class?: unknown;
        /** React-совместимая запись класса. */
        className?: unknown;
        /** Инлайновые стили: строка или объект (рантайм оба обрабатывает). */
        style?: unknown;
        /** title-атрибут с подсказкой. */
        title?: unknown;
        /** Атрибут видимости для accessibility-флоу. */
        hidden?: unknown;
        /** Tabindex для управления фокусом. */
        tabIndex?: unknown;
        /** ARIA-роль элемента. */
        role?: unknown;
        /** Атрибут для view transitions API. */
        'view-transition-name'?: unknown;
        /** ref-обработчик: колбэк или объект с current. */
        ref?: unknown;
        /** key для согласования списков; читается фабрикой h. */
        key?: unknown;
        /** Дети, которые JSX-компилятор кладёт сюда автоматически. */
        children?: unknown;

        /** Обработчик клика. */
        onClick?: unknown;
        /** Двойной клик. */
        onDblClick?: unknown;
        /** Mousedown по элементу. */
        onMouseDown?: unknown;
        /** Mouseup по элементу. */
        onMouseUp?: unknown;
        /** Mouseenter по элементу. */
        onMouseEnter?: unknown;
        /** Mouseleave по элементу. */
        onMouseLeave?: unknown;
        /** Mouseover по элементу. */
        onMouseOver?: unknown;
        /** Mouseout по элементу. */
        onMouseOut?: unknown;
        /** Получение фокуса. */
        onFocus?: unknown;
        /** Потеря фокуса. */
        onBlur?: unknown;
        /** Нажатие клавиши. */
        onKeyDown?: unknown;
        /** Отпускание клавиши. */
        onKeyUp?: unknown;
        /** Нажатие и отпускание клавиши. */
        onKeyPress?: unknown;

        /** Любые data-* и aria-* атрибуты, а также неизвестные пропсы. */
        [prop: string]: unknown;
    }

    /** Пропсы div: только база, специфичных полей у div нет. */
    interface HTMLDivAttributes extends HTMLAttributesBase {}

    /** Пропсы span: только база. */
    interface HTMLSpanAttributes extends HTMLAttributesBase {}

    /** Пропсы label: контролируется атрибут htmlFor (или его HTML-вариант for). */
    interface HTMLLabelAttributes extends HTMLAttributesBase {
        /** React-стиль: связь label с инпутом по id. */
        htmlFor?: unknown;
        /** HTML-стиль: связь label с инпутом по id. */
        for?: unknown;
    }

    /** Пропсы button: type, disabled, формовые атрибуты. */
    interface HTMLButtonAttributes extends HTMLAttributesBase {
        /** Кнопочный type: submit, reset или button. */
        type?: unknown;
        /** Флаг недоступности кнопки. */
        disabled?: unknown;
        /** Атрибут name внутри формы. */
        name?: unknown;
        /** Значение, которое уйдёт в form data при submit. */
        value?: unknown;
        /** Привязка к форме по id, если кнопка вне формы. */
        form?: unknown;
        /** Автофокус при mount. */
        autoFocus?: unknown;
    }

    /** Пропсы input: type, value, события ввода. */
    interface HTMLInputAttributes extends HTMLAttributesBase {
        /** Тип инпута: text, password, email и т.д. */
        type?: unknown;
        /** Текущее значение. */
        value?: unknown;
        /** Начальное значение для неконтролируемого инпута. */
        defaultValue?: unknown;
        /** Подсказка внутри инпута. */
        placeholder?: unknown;
        /** Атрибут name. */
        name?: unknown;
        /** Флаг недоступности. */
        disabled?: unknown;
        /** Флаг read-only. */
        readOnly?: unknown;
        /** Обязательное поле формы. */
        required?: unknown;
        /** Минимальная длина для строковых типов. */
        minLength?: unknown;
        /** Максимальная длина для строковых типов. */
        maxLength?: unknown;
        /** Регулярка для валидации. */
        pattern?: unknown;
        /** Состояние чекбокса или radio. */
        checked?: unknown;
        /** Дефолтное состояние чекбокса. */
        defaultChecked?: unknown;
        /** Список autocomplete-подсказок. */
        autoComplete?: unknown;
        /** Автофокус при mount. */
        autoFocus?: unknown;
        /** Шаг для числовых инпутов. */
        step?: unknown;
        /** Минимум для числовых инпутов. */
        min?: unknown;
        /** Максимум для числовых инпутов. */
        max?: unknown;

        /** Изменение значения через клавиатуру или вставку. */
        onInput?: unknown;
        /** Завершение редактирования. */
        onChange?: unknown;
    }

    /** Пропсы textarea: те же события ввода, что у input. */
    interface HTMLTextareaAttributes extends HTMLAttributesBase {
        /** Текущее значение. */
        value?: unknown;
        /** Дефолтное значение. */
        defaultValue?: unknown;
        /** Подсказка. */
        placeholder?: unknown;
        /** Атрибут name. */
        name?: unknown;
        /** Флаг недоступности. */
        disabled?: unknown;
        /** Флаг read-only. */
        readOnly?: unknown;
        /** Обязательное поле формы. */
        required?: unknown;
        /** Число строк. */
        rows?: unknown;
        /** Число колонок. */
        cols?: unknown;
        /** Перенос строк. */
        wrap?: unknown;

        /** Изменение значения. */
        onInput?: unknown;
        /** Завершение редактирования. */
        onChange?: unknown;
    }

    /** Пропсы select: связан со списком option. */
    interface HTMLSelectAttributes extends HTMLAttributesBase {
        /** Текущее значение. */
        value?: unknown;
        /** Атрибут name. */
        name?: unknown;
        /** Флаг недоступности. */
        disabled?: unknown;
        /** Множественный выбор. */
        multiple?: unknown;
        /** Обязательное поле. */
        required?: unknown;

        /** Завершение редактирования. */
        onChange?: unknown;
    }

    /** Пропсы option: значение и disabled. */
    interface HTMLOptionAttributes extends HTMLAttributesBase {
        /** Текущее значение. */
        value?: unknown;
        /** Флаг недоступности. */
        disabled?: unknown;
        /** Дефолтно выбран. */
        selected?: unknown;
    }

    /** Пропсы a: href и target. */
    interface HTMLAnchorAttributes extends HTMLAttributesBase {
        /** Адрес перехода. */
        href?: unknown;
        /** Целевая вкладка или фрейм. */
        target?: unknown;
        /** rel-атрибут для безопасности и SEO. */
        rel?: unknown;
        /** Скачивание по клику. */
        download?: unknown;
    }

    /** Пропсы img: src, alt, размеры. */
    interface HTMLImageAttributes extends HTMLAttributesBase {
        /** Адрес изображения. */
        src?: unknown;
        /** Альтернативный текст. */
        alt?: unknown;
        /** Ширина в пикселях. */
        width?: unknown;
        /** Высота в пикселях. */
        height?: unknown;
        /** Стратегия загрузки. */
        loading?: unknown;
        /** Декодирование. */
        decoding?: unknown;
        /** srcset для адаптивных картинок. */
        srcset?: unknown;
        /** sizes для адаптивных картинок. */
        sizes?: unknown;
    }

    /** Пропсы form: action, method, события submit. */
    interface HTMLFormAttributes extends HTMLAttributesBase {
        /** Адрес отправки. */
        action?: unknown;
        /** Метод HTTP. */
        method?: unknown;
        /** Тип кодирования. */
        encType?: unknown;
        /** Имя формы. */
        name?: unknown;
        /** Атрибут target формы. */
        target?: unknown;
        /** Отключить браузерную валидацию. */
        noValidate?: unknown;
        /** Auto-complete-режим. */
        autoComplete?: unknown;

        /** Submit формы. */
        onSubmit?: unknown;
        /** Reset формы. */
        onReset?: unknown;
    }

    /**
     * Карта intrinsic-тегов JSX: открытая index-signature пускает любой тег,
     * узкие override'ы дают подсказки IDE по ходовым тегам.
     */
    interface IntrinsicElements {
        div: HTMLDivAttributes;
        span: HTMLSpanAttributes;
        label: HTMLLabelAttributes;
        button: HTMLButtonAttributes;
        input: HTMLInputAttributes;
        textarea: HTMLTextareaAttributes;
        select: HTMLSelectAttributes;
        option: HTMLOptionAttributes;
        a: HTMLAnchorAttributes;
        img: HTMLImageAttributes;
        form: HTMLFormAttributes;

        [tag: string]: HTMLAttributesBase;
    }
}
