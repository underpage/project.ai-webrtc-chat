import { signup } from '../../api/auth.api.js';
import logger from '../../utils/logger.js';

class SignupPage {
    constructor() {
        this.signupForm = document.getElementById('signupForm');
        this.nameInput = document.getElementById('name');
        this.emailInput = document.getElementById('email');
        this.userIdInput = document.getElementById('userId');
        this.passwordInput = document.getElementById('password');

        this.addEventListeners();
        logger.info('SignupPage loaded');
    }

    addEventListeners() {
        this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    async handleSignup(e) {
        e.preventDefault();

        const name = this.nameInput.value;
        const email = this.emailInput.value;
        const userId = this.userIdInput.value;
        const password = this.passwordInput.value;

        const signupData = {
            name,
            email,
            userId,
            password,
        };

        try {
            await signup(signupData);
            alert('Signup successful! Please log in.');
            window.location.href = '/page/auth/login.html'; 
        } catch (error) {
            alert(`Signup failed: ${error.message}`);
            console.error('Signup error:', error);
        }
    }
}

new SignupPage();