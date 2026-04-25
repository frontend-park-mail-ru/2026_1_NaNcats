import "./support.scss";

export class Support {
  private static instance: Support | null = null;

  private root: HTMLElement;
  private prevBodyOverflow: string = "";
  private url: string;

  static open(url: string): void {
    if (Support.instance) return;
    Support.instance = new Support(url);
    Support.instance.mount();
  }

  static close(): void {
    Support.instance?.destroy();
    Support.instance = null;
  }

  private constructor(url: string) {
    this.url = url;

    this.root = document.createElement("div");
    this.root.className = "support-modal";
    this.root.innerHTML = `
      <div class="support-modal__backdrop js-support-close"></div>

      <section class="support-modal__panel" role="dialog" aria-modal="true" aria-label="Поддержка">
        <header class="support-modal__header">
          <div class="support-modal__title">Поддержка</div>
          <button class="support-modal__close js-support-close" type="button" aria-label="Закрыть">×</button>
        </header>

        <div class="support-modal__content">
          <iframe
            class="support-modal__iframe"
            src="${this.escapeAttr(this.url)}"
            title="Окно поддержки"
            loading="lazy"
            referrerpolicy="no-referrer"
          ></iframe>
        </div>
      </section>
    `;
  }

  private mount(): void {
    this.prevBodyOverflow = document.body.style.overflow; // шоб заблокировать скролл под модалкой
    document.body.style.overflow = "hidden";

    document.body.appendChild(this.root);

    this.root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".js-support-close")) {
        Support.close();
      }
    });

    window.addEventListener("keydown", this.handleEsc, { passive: true });
  }

  private destroy(): void {
    window.removeEventListener("keydown", this.handleEsc);
    document.body.style.overflow = this.prevBodyOverflow;
    this.root.remove();
  }

  private handleEsc = (e: KeyboardEvent): void => {
    if (e.key === "Escape") Support.close();
  };

  private escapeAttr(s: string): string {
    return String(s).replace(/"/g, "&quot;");
  }
}
