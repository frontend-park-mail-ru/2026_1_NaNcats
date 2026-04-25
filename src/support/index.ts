// src/support/index.ts
import "./support.scss";
import { Ajax } from "../core/Ajax";

type Tab = "create" | "my" | "stats";

interface CategoryDTO {
  id: number;
  name: string;
  description: string;
  default_line: number;
}

interface TicketDTO {
  id: number;
  public_id: string;
  category_id: number;
  current_status: string;
  support_line: number;
  assignee_id?: number;
  resolution_rating?: number;
  created_at: string; // RFC3339
}

interface EventDTO {
  id: number;
  ticket_id: number;
  author_id?: number;
  author_role: string;
  event_type: string;
  payload: any; // json.RawMessage -> parsed json by fetch().json()
  created_at: string; // RFC3339
}

type CreateTicketRequest = {
  contact_email: string;
  category_id: number;
  first_message: string;
  client_meta: string; // JSON string
};

type RateTicketRequest = {
  rating: number;
};

const FALLBACK_CATEGORIES: CategoryDTO[] = [
  {
    id: 1,
    name: "Баг/техническая ошибка",
    description: "Ошибки на сайте или в приложении",
    default_line: 2,
  },
  {
    id: 2,
    name: "Вопрос по заказу",
    description: "Где курьер, отмена заказа, изменения",
    default_line: 1,
  },
  {
    id: 3,
    name: "Жалоба на доставку/продукт/ресторан",
    description: "Невкусно, холодное, недовес",
    default_line: 1,
  },
  {
    id: 4,
    name: "Предложение",
    description: "Идеи по улучшению сервиса",
    default_line: 1,
  },
];

const state: {
  categories: CategoryDTO[];
  tickets: TicketDTO[];
  selectedTicketPublicId: string | null;
  lastEventsByPublicId: Record<string, EventDTO[]>;
} = {
  categories: [],
  tickets: [],
  selectedTicketPublicId: null,
  lastEventsByPublicId: {},
};

//   Helpers

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qs<T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el as T;
}

function qsa<T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

function fmtStatus(s: string): string {
  const key = (s || "").toUpperCase();
  if (key === "OPEN") return "Открыто";
  if (key === "IN_PROGRESS") return "В работе";
  if (key === "CLOSED") return "Закрыто";
  return s || "UNKNOWN";
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryById(id: number): CategoryDTO | undefined {
  return state.categories.find((c) => c.id === id);
}

function ticketByPublicId(publicId: string): TicketDTO | undefined {
  return state.tickets.find((t) => t.public_id === publicId);
}

function setTab(tab: Tab): void {
  qsa<HTMLButtonElement>(".support__tab").forEach((b) => {
    b.classList.toggle("support__tab_active", b.dataset.tab === tab);
  });

  qsa<HTMLElement>(".support__panel").forEach((p) => {
    p.classList.toggle("support__panel_hidden", p.dataset.panel !== tab);
  });
}

function panel(tab: Tab): HTMLElement {
  return qs(`.support__panel[data-panel="${tab}"]`);
}

function renderToast(text: string): void {
  const root = qs("#support-root");
  let node = root.querySelector<HTMLElement>(".support-toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "support-toast";
    root.appendChild(node);
  }
  node.textContent = text;
  node.classList.add("support-toast_visible");
  window.setTimeout(
    () => node?.classList.remove("support-toast_visible"),
    2400,
  );
}

// апишка

async function apiGetCategories(): Promise<CategoryDTO[]> {
  const res = await Ajax.get("/support/categories");
  if (!res.ok) throw new Error(`GET /support/categories failed: ${res.status}`);
  const data = (await res.json()) as CategoryDTO[];
  return Array.isArray(data) ? data : [];
}

async function apiCreateTicket(
  payload: CreateTicketRequest,
): Promise<{ ticket_id: string }> {
  const res = await Ajax.post("/support/tickets", payload);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `POST /support/tickets failed: ${res.status} ${text}`.trim(),
    );
  }
  return (await res.json()) as { ticket_id: string };
}

async function apiGetMyTickets(): Promise<TicketDTO[]> {
  const res = await Ajax.get("/support/tickets");
  if (!res.ok) throw new Error(`GET /support/tickets failed: ${res.status}`);
  const data = (await res.json()) as TicketDTO[];
  return Array.isArray(data) ? data : [];
}

async function apiGetTicketEvents(publicId: string): Promise<EventDTO[]> {
  const res = await Ajax.get(
    `/support/tickets/${encodeURIComponent(publicId)}/events`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GET /support/tickets/${publicId}/events failed: ${res.status} ${text}`.trim(),
    );
  }
  const data = (await res.json()) as EventDTO[];
  return Array.isArray(data) ? data : [];
}

async function apiRateTicket(
  publicId: string,
  rating: number,
): Promise<{ success: boolean }> {
  const body: RateTicketRequest = { rating };
  const res = await Ajax.post(
    `/support/tickets/${encodeURIComponent(publicId)}/rate`,
    body,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `POST /support/tickets/${publicId}/rate failed: ${res.status} ${text}`.trim(),
    );
  }
  return (await res.json()) as { success: boolean };
}

//    UI render: Shell

function renderShell(): void {
  const root = qs("#support-root");
  root.innerHTML = `
    <div class="support">
      <header class="support__header">
        <div class="support__title">Поддержка</div>
        <nav class="support__tabs" aria-label="Навигация поддержки">
          <button class="support__tab support__tab_active" data-tab="create" type="button">Создать</button>
          <button class="support__tab" data-tab="my" type="button">Мои обращения</button>
          <button class="support__tab" data-tab="stats" type="button">Статистика</button>
        </nav>
      </header>

      <main class="support__body">
        <section class="support__panel" data-panel="create"></section>
        <section class="support__panel support__panel_hidden" data-panel="my"></section>
        <section class="support__panel support__panel_hidden" data-panel="stats"></section>
      </main>
    </div>
  `;
}

//    UI render: Create

function renderCreate(): void {
  const p = panel("create");

  const options = state.categories
    .map(
      (c) =>
        `<option value="${c.id}">${esc(c.name)} (линия ${esc(c.default_line)})</option>`,
    )
    .join("");

  const hints = state.categories
    .map(
      (c) => `
      <div class="support-form__cat-hint" data-hint="${c.id}">
        <div class="support-form__cat-title">${esc(c.name)}</div>
        <div class="support-form__cat-desc">${esc(c.description)}</div>
      </div>
    `,
    )
    .join("");

  p.innerHTML = `
    <form class="support-form" id="support-form">
      <div class="support-form__row">
        <label class="support-form__label">Email для ответа</label>
        <input class="support-form__control" name="contact_email" type="email" placeholder="name@mail.ru" required />
      </div>

      <div class="support-form__row">
        <label class="support-form__label">Категория</label>
        <select class="support-form__control" name="category_id" required>
          ${options}
        </select>
        <div class="support-form__cat-hints">${hints}</div>
      </div>

      <div class="support-form__row">
        <label class="support-form__label">Сообщение</label>
        <textarea class="support-form__control support-form__control_textarea"
          name="first_message" placeholder="Опишите проблему/вопрос…" required></textarea>
      </div>

      <button class="support-form__submit" type="submit">Отправить</button>
      <div class="support-form__hint" id="support-form-hint"></div>
    </form>
  `;

  const form = qs<HTMLFormElement>("#support-form", p);
  const select = qs<HTMLSelectElement>('select[name="category_id"]', form);

  const updateHint = () => {
    const id = String(select.value);
    qsa<HTMLElement>(".support-form__cat-hint", form).forEach((h) => {
      h.classList.toggle(
        "support-form__cat-hint_active",
        h.dataset.hint === id,
      );
    });
  };

  select.addEventListener("change", updateHint);
  updateHint();
}

//    UI render: My tickets list + details

function renderMyTicketsList(): void {
  const p = panel("my");

  if (state.selectedTicketPublicId) {
    // детальная карточка рендерится другой функцией
    return;
  }

  if (!state.tickets.length) {
    p.innerHTML = `<div class="support__empty">Пока нет обращений.</div>`;
    return;
  }

  p.innerHTML = `
    <div class="ticket-list">
      ${state.tickets
        .map((t) => {
          const cat = categoryById(t.category_id);
          const rating =
            typeof t.resolution_rating === "number" && t.resolution_rating > 0
              ? `<span class="ticket__badge ticket__badge_rating">Оценка: ${esc(t.resolution_rating)}</span>`
              : "";

          const assignee =
            typeof t.assignee_id === "number" && t.assignee_id > 0
              ? `<span class="ticket__badge ticket__badge_agent">Агент: ${esc(t.assignee_id)}</span>`
              : "";

          return `
            <article class="ticket ticket_clickable" data-public-id="${esc(t.public_id)}">
              <div class="ticket__top">
                <div class="ticket__subject">#${esc(t.public_id)}</div>
                <div class="ticket__status">${esc(fmtStatus(t.current_status))}</div>
              </div>

              <div class="ticket__meta">
                <span class="ticket__badge">${esc(cat?.name || `Категория ${t.category_id}`)}</span>
                <span class="ticket__badge ticket__badge_line">Линия ${esc(t.support_line)}</span>
                ${assignee}
                ${rating}
                <span class="ticket__date">${esc(fmtDate(t.created_at))}</span>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTicketDetails(
  publicId: string,
  events: EventDTO[] | null,
): void {
  const p = panel("my");
  const t = ticketByPublicId(publicId);

  if (!t) {
    state.selectedTicketPublicId = null;
    renderMyTicketsList();
    return;
  }

  const cat = categoryById(t.category_id);
  const statusText = fmtStatus(t.current_status);

  const ratingValue =
    typeof t.resolution_rating === "number" && t.resolution_rating > 0
      ? t.resolution_rating
      : 0;

  const showRating = String(t.current_status || "").toUpperCase() === "CLOSED";

  const ratingBlock = showRating
    ? `
      <div class="ticket-details__rating">
        <div class="ticket-details__rating-title">Оцените решение</div>

        ${
          ratingValue > 0
            ? `<div class="ticket-details__rating-done">Спасибо! Ваша оценка: <b>${esc(ratingValue)}</b></div>`
            : `
              <div class="ticket-details__rating-actions" data-rate-for="${esc(t.public_id)}">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (n) =>
                      `<button class="rate-btn" type="button" data-rate="${n}">${n}</button>`,
                  )
                  .join("")}
              </div>
            `
        }
      </div>
    `
    : "";

  const timeline = events
    ? `
      <div class="events">
        ${events
          .map((e) => {
            const payload = e.payload;
            const payloadText =
              payload && typeof payload === "object"
                ? JSON.stringify(payload)
                : payload != null
                  ? String(payload)
                  : "";

            const maybeText =
              payload && typeof payload === "object"
                ? (payload.text ?? payload.message ?? payload.body ?? null)
                : null;

            const mainText =
              maybeText != null ? String(maybeText) : payloadText;

            return `
              <div class="event">
                <div class="event__meta">
                  <span class="event__role">${esc(e.author_role)}</span>
                  <span class="event__type">${esc(e.event_type)}</span>
                  <span class="event__date">${esc(fmtDate(e.created_at))}</span>
                </div>
                ${
                  mainText
                    ? `<div class="event__text">${esc(mainText)}</div>`
                    : `<div class="event__text event__text_muted">Нет данных payload</div>`
                }
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : `<div class="support__loading">Загрузка истории…</div>`;

  p.innerHTML = `
    <div class="ticket-details">
      <button class="ticket-details__back" type="button" data-back="1">← Назад</button>

      <div class="ticket-details__head">
        <div class="ticket-details__title">Обращение #${esc(t.public_id)}</div>
        <div class="ticket-details__status">${esc(statusText)}</div>
      </div>

      <div class="ticket-details__meta">
        <span class="ticket__badge">${esc(cat?.name || `Категория ${t.category_id}`)}</span>
        <span class="ticket__badge ticket__badge_line">Линия ${esc(t.support_line)}</span>
        ${
          typeof t.assignee_id === "number" && t.assignee_id > 0
            ? `<span class="ticket__badge ticket__badge_agent">Агент: ${esc(t.assignee_id)}</span>`
            : ""
        }
        <span class="ticket__date">${esc(fmtDate(t.created_at))}</span>
      </div>

      ${ratingBlock}

      <div class="ticket-details__events">
        <div class="ticket-details__events-title">История</div>
        ${timeline}
      </div>
    </div>
  `;
}

//    UI render: Stats (пока заглушка)

function renderStatsStub(): void {
  panel("stats").innerHTML = `
    <div class="support__empty">
      Статистика пока в разработке (ручки ещё допиливаются).
    </div>
  `;
}

// Loaders

async function loadCategories(): Promise<void> {
  try {
    state.categories = await apiGetCategories();
    if (!state.categories.length) state.categories = FALLBACK_CATEGORIES;
  } catch (e) {
    console.warn("Failed to load categories, using fallback", e);
    state.categories = FALLBACK_CATEGORIES;
  }
}

async function loadTickets(): Promise<void> {
  const p = panel("my");
  p.innerHTML = `<div class="support__loading">Загрузка…</div>`;

  try {
    state.tickets = await apiGetMyTickets();
    state.selectedTicketPublicId = null;
    renderMyTicketsList();
  } catch (e) {
    console.error(e);
    p.innerHTML = `<div class="support__error">Не удалось загрузить обращения.</div>`;
  }
}

async function openTicketDetails(publicId: string): Promise<void> {
  state.selectedTicketPublicId = publicId;
  renderTicketDetails(publicId, null);

  try {
    const events = await apiGetTicketEvents(publicId);
    state.lastEventsByPublicId[publicId] = events;
    renderTicketDetails(publicId, events);
  } catch (e) {
    console.error(e);
    renderTicketDetails(publicId, []);
    const p = panel("my");
    const evWrap = p.querySelector(
      ".ticket-details__events",
    ) as HTMLElement | null;
    if (evWrap) {
      evWrap.insertAdjacentHTML(
        "beforeend",
        `<div class="support__error" style="margin-top:12px;">Не удалось загрузить историю тикета.</div>`,
      );
    }
  }
}

// Init

async function init(): Promise<void> {
  renderShell();
  renderStatsStub();

  await Ajax.fetchCsrf();

  await loadCategories();
  renderCreate();

  document.addEventListener("click", (e) => {
    const tabBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".support__tab",
    );
    if (tabBtn) {
      const tab = (tabBtn.dataset.tab as Tab) || "create";
      setTab(tab);
      if (tab === "my") void loadTickets();
      return;
    }

    const ticketCard = (e.target as HTMLElement).closest<HTMLElement>(
      ".ticket_clickable",
    );
    if (ticketCard) {
      const publicId = ticketCard.dataset.publicId;
      if (publicId) void openTicketDetails(publicId);
      return;
    }

    const backBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-back='1']",
    );
    if (backBtn) {
      state.selectedTicketPublicId = null;
      renderMyTicketsList();
      return;
    }

    const rateBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".rate-btn",
    );
    if (rateBtn) {
      const rating = parseInt(String(rateBtn.dataset.rate || "0"), 10);
      const wrap = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-rate-for]",
      );
      const publicId = wrap?.dataset.rateFor;

      if (!publicId || !rating || rating < 1 || rating > 5) return;

      void (async () => {
        try {
          await apiRateTicket(publicId, rating);

          const t = ticketByPublicId(publicId);
          if (t) t.resolution_rating = rating;

          renderToast("Спасибо за оценку!");

          const events = state.lastEventsByPublicId[publicId] || null;
          renderTicketDetails(publicId, events);
        } catch (err) {
          console.error(err);
          renderToast("Не удалось отправить оценку");
        }
      })();

      return;
    }
  });

  document.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>(
      "#support-form",
    );
    if (!form) return;

    e.preventDefault();

    const hint = document.getElementById(
      "support-form-hint",
    ) as HTMLElement | null;
    if (hint) hint.textContent = "";

    const fd = new FormData(form);
    const contact_email = String(fd.get("contact_email") || "").trim();
    const category_id = parseInt(String(fd.get("category_id") || "1"), 10);
    const first_message = String(fd.get("first_message") || "").trim();

    if (!contact_email || !first_message || Number.isNaN(category_id)) {
      if (hint) hint.textContent = "Заполните все поля корректно.";
      return;
    }

    const client_meta = JSON.stringify({
      page: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString(),
    });

    void (async () => {
      try {
        const resp = await apiCreateTicket({
          contact_email,
          category_id,
          first_message,
          client_meta,
        });

        if (hint) hint.textContent = `Обращение создано: #${resp.ticket_id}`;

        setTab("my");
        await loadTickets();
      } catch (err) {
        console.error(err);
        if (hint)
          hint.textContent = "Не удалось создать обращение. Попробуйте позже.";
      }
    })();
  });
}

void init();
