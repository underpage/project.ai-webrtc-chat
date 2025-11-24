import { getAllRooms, createRoom } from '../api/room.api.js';
import { Modal } from '../libs/modal.js'; 
import logger from '../utils/logger.js'; 


class LobbyPage {
  
  constructor() {
    this.createRoomBtnHeader = document.getElementById('create-room-btn'); 
    this.createRoomBtnMain = document.getElementById('create-room-btn-main'); 
    this.refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
    this.roomList = document.getElementById('room-list');
    this.modalElement = document.getElementById('create-room-modal');
    this.createRoomModal = new Modal('create-room-modal'); 
    this.createRoomForm = document.getElementById('create-room-form');
    this.searchInput = document.getElementById('search-input');
    this.searchButton = document.getElementById('search-button');

    // Hide createRoomBtnMain if user is not logged in
    if (!localStorage.getItem('accessToken')) {
        if (this.createRoomBtnMain) {
            this.createRoomBtnMain.style.display = 'none';
        }
    }

    logger.info('로비 페이지가 로드되었습니다.'); 
    this.addEventListeners(); 
    this.fetchRooms();        
  }

  
  addEventListeners() {
    if (this.createRoomBtnHeader) {
        this.createRoomBtnHeader.addEventListener('click', () => this.createRoomModal.show());
    }
    if (this.createRoomBtnMain) {
        this.createRoomBtnMain.addEventListener('click', () => this.createRoomModal.show());
    }
    if (this.createRoomForm) {
        this.createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
    }
    if (this.refreshRoomsBtn) {
        this.refreshRoomsBtn.addEventListener('click', () => this.fetchRooms());
    }
    if (this.searchButton) {
        this.searchButton.addEventListener('click', () => this.fetchRooms(this.searchInput.value));
    }
    if (this.searchInput) {
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.fetchRooms(this.searchInput.value);
            }
        });
    }
  }

  async handleCreateRoom(e) {
    e.preventDefault(); 

    const title = document.getElementById('room-title').value;
    const description = document.getElementById('room-description').value;
    const roomPassword = document.getElementById('room-password').value;
    const roomData = { title, description, roomPassword };

    try {
        
        const newRoom = await createRoom(roomData);
        alert(`회의실 "${newRoom.title}"이 성공적으로 생성되었습니다!`); 
        this.createRoomModal.hide(); 
        this.fetchRooms();

    } catch (error) {
        logger.error('회의실 생성 중 오류 발생:', error); 
        alert(`회의실 생성 실패: ${error.message}`);       
    }
  }

  async fetchRooms(searchQuery = '') {

    this.roomList.innerHTML = '<li class="room-item-placeholder"><p>회의실 목록을 불러오는 중...</p></li>';
    
    try {
      const response = await getAllRooms(searchQuery); 
      const rooms = response.rooms || [];
      this.renderRooms(rooms); 
    } catch (error) {
      logger.error('회의실 목록 가져오기 중 오류 발생:', error); 
      
      this.roomList.innerHTML = '<li class="room-item-placeholder"><p>회의실 목록을 가져올 수 없습니다. 다시 시도해 주세요.</p></li>';
    }
  }

  renderRooms(rooms) {
    if (!rooms || rooms.length === 0) {
      this.roomList.innerHTML = '<li class="room-item-placeholder"><p>현재 이용 가능한 회의실이 없습니다. 새로 만들어 보세요!</p></li>';
      return;
    }
    this.roomList.innerHTML = rooms
      .map(
        (room) => `
          <li class="room-item" data-room-id="${room.roomId}">
            <div class="room-info">
              <h3 class="room-title">${room.title}</h3>
              <p class="room-participants">
                참여자: ${room.currentParticipants || 0} / ${room.maxParticipants || 'N/A'} 명
              </p>
            </div>
            <button class="btn-small-outline btn-join" data-room-id="${room.roomId}">참여</button>
          </li>
        `
      )
      .join('');
    this.addJoinButtonListeners(); 
  }
  
  addJoinButtonListeners() {
    const joinButtons = document.querySelectorAll('.btn-join');
    joinButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const roomId = e.currentTarget.dataset.roomId;
        const accessToken = localStorage.getItem('accessToken');

        if (accessToken) {
            // Member: Redirect directly to room.html
            window.location.href = `/page/chat/room.html?roomId=${roomId}`;
        } else {
            // Non-member: Redirect to join.html without roomId in URL
            window.location.href = `/page/room/join.html`;
        }
      });
    });
  }
}

new LobbyPage();