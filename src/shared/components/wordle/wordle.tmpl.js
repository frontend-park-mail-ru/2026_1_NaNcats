export const wordleTemplate = `
<div class="modal-overlay" id="wordle-modal">
    <div class="address-modal wordle-modal" style="width: 500px; position: relative;">
        <div class="address-modal__close" id="close-wordle-modal">&times;</div>
        
        <h2 class="section-title" style="margin-bottom: 20px;">5 Букв</h2>
        
        <div id="wordle-toast" class="wordle-toast"></div>
        
        <div class="wordle-board" id="wordle-board">
            <!-- 6 строк по 5 ячеек -->
        </div>

        <div class="wordle-keyboard" id="wordle-keyboard">
            <!-- Клавиатура -->
        </div>
    </div>
</div>
`;
