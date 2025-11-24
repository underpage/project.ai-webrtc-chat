import logger from '../utils/logger.js';

document.addEventListener('DOMContentLoaded', () => {
    const headerActions = document.getElementById('header-actions-container');
    if (!headerActions) {
        logger.warn('Header actions container not found.');
        return;
    }

    const accessToken = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (accessToken && userData) {
        try {
            const user = JSON.parse(userData);
            headerActions.innerHTML = `
                <a href="/my-page.html" class="btn-header btn-primary">${user.name || 'My Page'}</a>
                <button id="logout-btn" class="btn-header btn-outline">Logout</button>
            `;
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('user');
                    window.location.href = '/'; // Redirect to lobby
                });
            }
        } catch (error) {
            logger.error('Error parsing user data from localStorage:', error);
            // Fallback to default buttons if user data is corrupted
            headerActions.innerHTML = `
                <a href="/page/auth/signup.html" class="btn-header btn-outline">Sign Up</a>
                <a href="/page/auth/login.html" class="btn-header btn-primary">Login</a>
            `;
        }
    } else {
        // If not logged in, ensure default buttons are present (they should be from HTML)
        // No action needed here, as the HTML already provides these.
    }
});
