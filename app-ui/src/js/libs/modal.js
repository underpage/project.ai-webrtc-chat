export class Modal {
    constructor(modalElementId) {
        this.modalElement = document.getElementById(modalElementId);
        if (!this.modalElement) {
            console.error(`Modal element with ID "${modalElementId}" not found.`);
            return;
        }
        this.closeButton = this.modalElement.querySelector('.close-btn');
        this._addEventListeners();
    }

    _addEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }
        
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.hide();
            }
        });
    }

    show() {
        this.modalElement.style.display = 'flex';

    }

    hide() {
        this.modalElement.style.display = 'none';

    }
}
