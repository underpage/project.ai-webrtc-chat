import { createRoom } from '../../api/room.api.js';
import logger from '../../utils/logger.js';

class CreateRoomPage {
    constructor() {
        this.initPage();
    }

    async initPage() {
        mainElement.innerHTML = `
            <div class="container">
                <div class="form-header">
                    <h1 class="form-title">Create New Room</h1>
                    <p class="form-subtitle">Set up your meeting room details.</p>
                </div>

                <form id="createRoomForm">
                    <div class="form-group">
                        <label class="form-label" for="title">Room Title</label>
                        <input id="title" type="text" class="form-input" placeholder="e.g., Q4 Project Planning" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="description">Description (Optional)</label>
                        <input id="description" type="text" class="form-input" placeholder="A brief description of the room">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="roomPassword">Password (Optional)</label>
                        <input id="roomPassword" type="password" class="form-input" placeholder="Leave blank for a public room">
                    </div>
                    
                    <button type="submit" class="btn-submit">Create Room</button>
                </form>

                 <div class="footer-text">
                    <a href="/" class="link">Back to Lobby</a>
                </div>
            </div>
        `;

        this.createRoomForm = document.getElementById('createRoomForm');
        this.titleInput = document.getElementById('title');
        this.descriptionInput = document.getElementById('description');
        this.roomPasswordInput = document.getElementById('roomPassword');

        this.addEventListeners();
        logger.info('CreateRoomPage loaded');
    }

    addEventListeners() {
        this.createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
    }

    async handleCreateRoom(e) {
        e.preventDefault();

        const title = this.titleInput.value;
        const description = this.descriptionInput.value;
        const roomPassword = this.roomPasswordInput.value;

        const roomData = {
            title,
            description,
            roomPassword,
        };

        try {
            const newRoom = await createRoom(roomData);
            alert(`Room "${newRoom.title}" created successfully! Redirecting to room.`);
            window.location.href = `/page/chat/room.html?roomId=${newRoom.roomId}`; 
        } catch (error) {
            alert(`Failed to create room: ${error.message}`);
            console.error('Create room error:', error);
        }
    }
}

new CreateRoomPage();