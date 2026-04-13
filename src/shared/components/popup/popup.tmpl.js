export const popupTemplate = `
<div class="modal-overlay modal-overlay_active" style="z-index: 9999;">
    <div class="address-modal" style="width: 400px; padding: 30px; text-align: center; gap: 20px;">
        <h3 style="margin: 0; font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 500; color: #0E1117;">
            {{!it.message}}
        </h3>
        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
            {{? it.type === 'confirm' }}
                <button class="button button_ghost js-popup-cancel" style="flex: 1; height: 44px; margin: 0; background: #eee; color: #333;">
                    Отмена
                </button>
            {{?}}
            <button class="button button_primary js-popup-ok" style="flex: 1; height: 44px; margin: 0;">
                ОК
            </button>
        </div>
    </div>
</div>
`;
