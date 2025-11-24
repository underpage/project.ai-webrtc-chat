import { $ } from '../utils/dom.js';
import { logger } from '../utils/logger.js';

export class VideoGridManager {
  constructor() {
    this.gridEl = $('#video-grid');
    if (!this.gridEl) {
      throw new Error('Video grid element not found.');
    }
    
    this.observer = new MutationObserver(() => this.updateLayout());
    this.observer.observe(this.gridEl, { childList: true });
    
    logger.info('VideoGridManager initialized.');
    this.updateLayout();
  }

  updateLayout() {
    const count = this.gridEl.children.length;
    logger.debug(`Updating video grid layout for ${count} participant(s).`);

    this.gridEl.className = 'video-grid-container';

    if (count === 0) return;

    if (count === 1) {
      this.gridEl.classList.add('layout-solo');
    } else if (count === 2) {
      this.gridEl.classList.add('layout-duo');
    } else if (count > 2 && count <= 4) {
      this.gridEl.classList.add('layout-quad');
    } else if (count > 4) {
      this.gridEl.classList.add('layout-multi');
    }
  }

  destroy() {
    this.observer.disconnect();
  }
}