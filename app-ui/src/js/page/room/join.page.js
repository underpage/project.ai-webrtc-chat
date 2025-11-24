import { joinRoom } from '../../api/room.api.js';
import { getMe } from '../../api/auth.api.js';
import logger from '../../utils/logger.js';

class JoinRoomPage {
    constructor() {
        this.initPage();
    }

    async initPage() {
        this.initDOMElements();
        this.addEventListeners();
        await this.checkLoginStatus();
        logger.info('JoinRoomPage loaded');
    }

    initDOMElements() {
        this.joinRoomForm = document.getElementById('joinRoomForm');
        this.roomIdInput = document.getElementById('roomId');
        this.roomPasswordInput = document.getElementById('roomPassword');
        this.nonMemberFields = document.getElementById('nonMemberFields');
        this.userNameInput = document.getElementById('userName');
        this.userDepartmentInput = document.getElementById('userDepartment');
        this.userCompanyInput = document.getElementById('userCompany');
        this.loggedInUserInfo = document.getElementById('loggedInUserInfo');
    }

    addEventListeners() {
        this.joinRoomForm.addEventListener('submit', (e) => this.handleJoinRoom(e));
    }

    async handleJoinRoom(e) {
        e.preventDefault();

        const roomId = this.roomIdInput.value;
        const roomPassword = this.roomPasswordInput.value;

        if (!roomId) {
            alert('Please enter a Room ID.');
            return;
        }

        let userData = {};
        if (this.nonMemberFields.style.display !== 'none') {
            const userName = this.userNameInput.value;
            const userDepartment = this.userDepartmentInput.value;
            const userCompany = this.userCompanyInput.value;

            if (!userName || !userDepartment || !userCompany) {
                alert('Please fill in all user details for non-members.');
                return;
            }
            userData = { name: userName, department: userDepartment, company: userCompany };
        }
        
        try {
            const { joinToken } = await joinRoom(roomId, roomPassword || null, userData);
            alert(`Successfully joined room ${roomId}!`);
            window.location.href = `/page/chat/room.html?roomId=${roomId}`;
        } catch (error) {
            alert(`Failed to join room: ${error.message}`);
            console.error('Join room error:', error);
        }
    }

    async checkLoginStatus() {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            try {
                const user = await getMe();
                logger.info('User is logged in:', user.name);
                this.nonMemberFields.style.display = 'none';
                this.userNameInput.removeAttribute('required');
                this.userDepartmentInput.removeAttribute('required');
                this.userCompanyInput.removeAttribute('required');
                if (this.loggedInUserInfo) {
                    this.loggedInUserInfo.textContent = `Logged in as ${user.name} (${user.department || ''}, ${user.company || ''})`;
                    this.loggedInUserInfo.style.display = 'block';
                }
            } catch (error) {
                logger.warn('Failed to fetch user info with existing token, treating as non-member:', error);
                this.displayNonMemberFields();
            }
        } else {
            logger.info('User is not logged in, displaying non-member fields.');
            this.displayNonMemberFields();
        }
    }

    displayNonMemberFields() {
        this.nonMemberFields.style.display = 'block';
        this.userNameInput.setAttribute('required', 'true');
        this.userDepartmentInput.setAttribute('required', 'true');
        this.userCompanyInput.setAttribute('required', 'true');
    }
}

new JoinRoomPage();
