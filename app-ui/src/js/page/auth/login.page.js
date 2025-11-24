import { login } from '../../api/auth.api.js';
import logger from '../../utils/logger.js';

class LoginPage {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.userIdInput = this.loginForm.querySelector('input[type="text"]');
        this.passwordInput = this.loginForm.querySelector('input[type="password"]');
        this.createMeetingBtn = document.getElementById('create-meeting-btn');
        this.joinMeetingBtn = document.getElementById('join-meeting-btn');

        this.addEventListeners();
        logger.info('LoginPage loaded');
    }

    addEventListeners() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        if (this.createMeetingBtn) {
            this.createMeetingBtn.addEventListener('click', () => {
                window.location.href = '/page/room/create.html';
            });
        }
        if (this.joinMeetingBtn) {
            this.joinMeetingBtn.addEventListener('click', () => {
                window.location.href = '/page/room/join.html';
            });
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const userId = this.userIdInput.value;
        const password = this.passwordInput.value;

        if (!userId || !password) {
            alert('Please enter both User ID and Password.');
            return;
        }

        // Mock login for 'test/test'
        if (userId === 'test' && password === 'test') {
            localStorage.setItem('accessToken', 'mock-test-token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', userId: 'test', department: 'QA', company: 'Gemini' }));
            alert('Mock Login successful! Redirecting to the lobby...');
            window.location.href = '/';
            return;
        }

        try {
            const { accessToken, user } = await login(userId, password);
            
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('user', JSON.stringify(user));

            alert('Login successful! Redirecting to the lobby...');
            window.location.href = '/';

        } catch (error) {
            alert(`Login failed: ${error.message}`);
            console.error('Login error:', error);
        }
    }
}

new LoginPage();