import { joinRoom as apiJoinRoom } from '../../api/room.api.js';
import { getSocketClient } from '../../libs/socket.js';
import { webrtcManager } from '../../libs/webrtc.js';
import { Modal } from '../../libs/modal.js';
import logger from '../../utils/logger.js';

class RoomPage {
    constructor() {
        this.localStream = null;
        this.videoOn = true;
        this.audioOn = true;
        this.roomId = new URLSearchParams(window.location.search).get('roomId');
        this.socket = getSocketClient();

        
        this.preJoinModalInstance = null; 

        this.initPage();
    }

    async initPage() {
        
        
        this.initDOMElements();
        this.initEventListeners();
        
        
        this.preJoinModalInstance = new Modal('pre-join-modal');
        this.preJoinModalInstance.show(); 
        
        this.initPreJoin();
        logger.info(`RoomPage loaded for room: ${this.roomId}`);
    }

    initDOMElements() {
        
        this.videoBtn = document.getElementById('videoBtn');
        this.audioBtn = document.getElementById('audioBtn');
        this.participantsToggleBtn = document.getElementById('participantsToggleBtn');
        this.chatToggleBtn = document.getElementById('chatToggleBtn');
        this.participantsPopup = document.getElementById('participantsPopup');
        this.closeParticipantsBtn = this.participantsPopup.querySelector('.close-btn');
        this.endMeetingBtn = document.getElementById('end-meeting-btn'); 

        
        this.tabs = document.querySelectorAll('.sidebar-tabs .tab');
        this.panels = document.querySelectorAll('.tab-panel');

        
        this.localVideoPreview = document.getElementById('local-video-preview');
        this.modalMicBtn = document.getElementById('modal-mic-btn');
        this.modalCamBtn = document.getElementById('modal-cam-btn');
        this.joinBtn = document.getElementById('join-btn');

        
        this.mainVideoPlaceholder = document.getElementById('main-video-placeholder');
    }

    initEventListeners() {
        if (this.videoBtn) this.videoBtn.addEventListener('click', () => this.toggleVideo());
        if (this.audioBtn) this.audioBtn.addEventListener('click', () => this.toggleAudio());
        if (this.participantsToggleBtn) this.participantsToggleBtn.addEventListener('click', () => this.toggleParticipants());
        if (this.closeParticipantsBtn) this.closeParticipantsBtn.addEventListener('click', () => this.toggleParticipants());
        if (this.chatToggleBtn) this.chatToggleBtn.addEventListener('click', () => this.switchTab(0));
        
        this.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => this.switchTab(index));
        });

        if (this.joinBtn) this.joinBtn.addEventListener('click', () => this.joinRoom());
        if (this.modalMicBtn) this.modalMicBtn.addEventListener('click', () => this.toggleAudio(this.modalMicBtn));
        if (this.modalCamBtn) this.modalCamBtn.addEventListener('click', () => this.toggleVideo(this.modalCamBtn));
        if (this.endMeetingBtn) this.endMeetingBtn.addEventListener('click', () => this.endMeeting());
    }

    async initPreJoin() {
        try {
            logger.debug('Attempting to get user media...');
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            logger.debug('User media obtained successfully.');
            if (this.localVideoPreview) {
                this.localVideoPreview.srcObject = this.localStream;
            }
            if (this.joinBtn) {
                this.joinBtn.disabled = false;
                this.joinBtn.textContent = `Join Room ${this.roomId}`;
            }
        } catch (error) {
            logger.error('Error getting media devices.', error);
            if(this.joinBtn) this.joinBtn.textContent = `카메라/마이크 접근 실패: ${error.message}`;
            alert(`카메라와 마이크에 접근할 수 없습니다. 권한을 확인하고 다시 시도해 주세요. 오류: ${error.message}`);
        }
    }

    async joinRoom() {
        if (!this.localStream) {
            return alert('미디어 스트림 없이 회의실에 참여할 수 없습니다.');
        }
        logger.info(`Attempting to join room ${this.roomId}...`);
        if (this.joinBtn) {
            this.joinBtn.disabled = true;
            this.joinBtn.textContent = '참여 중...';
        }

        try {
            logger.debug('Calling apiJoinRoom...');
            const { joinToken, participants } = await apiJoinRoom(this.roomId);
            logger.info('Successfully received joinToken and initial participants.');

            logger.debug('Initializing SocketClient...');
            this.socket.initialize(joinToken);
            this.setupSocketListeners();
            logger.debug('Connecting to WebSocket...');
            await this.socket.connect();
            
            if (this.preJoinModalInstance) this.preJoinModalInstance.hide();
            logger.info('Socket connected, room joined successfully.');
            
            this.mainVideoPlaceholder.srcObject = this.localStream;
            this.mainVideoPlaceholder.muted = true;
            
            this.renderInitialParticipants(participants);

        } catch (error) {
            logger.error('Failed to join room:', error);
            if (this.joinBtn) {
                this.joinBtn.disabled = false;
                this.joinBtn.textContent = '회의실 참여';
            }
            alert(`회의실 참여 실패: ${error.message}`);
        }
    }
    
    setupSocketListeners() {
        logger.debug('Setting up SocketClient listeners...');
        this.socket.on('open', () => {
            logger.info('Socket connection opened. Starting WebRTC publisher connection.');
            webrtcManager.createPublisherConnection(this.localStream);
        });

        this.socket.on('sdp-answer', (data) => {
            logger.info('Received sdp-answer from server.');
            webrtcManager.handleRemoteAnswer(data.jsep);
        });

        this.socket.on('ice-candidate', (data) => {
            logger.info('Received ice-candidate from server.');
            webrtcManager.handleRemoteIceCandidate(data.candidate);
        });
        
        this.socket.on('error', (error) => {
            logger.error('Socket error:', error);
            alert('연결 오류가 발생했습니다. 페이지를 새로고침해 주세요.');
        });
        
        this.socket.on('close', (event) => logger.warn('Socket connection closed.', event));
    }
    
    renderInitialParticipants(participants) {
        logger.info('Rendering initial participants:', participants);
        
    }

    toggleVideo(btn = this.videoBtn) {
        if (!this.localStream) {
            logger.warn('로컬 스트림을 사용할 수 없어 비디오를 토글할 수 없습니다.');
            return;
        }
        this.videoOn = !this.videoOn;
        this.localStream.getVideoTracks().forEach(track => track.enabled = this.videoOn);
        
        const icon = btn.querySelector('.control-icon');
        const label = btn.querySelector('.control-label');
        
        if (this.videoOn) {
            btn.classList.remove('off');
            btn.classList.add('on');
            icon.textContent = '📹';
            label.textContent = '비디오 켜짐';
        } else {
            btn.classList.remove('on');
            btn.classList.add('off');
            icon.textContent = '📹';
            label.textContent = '비디오 꺼짐';
        }
    }

    toggleAudio(btn = this.audioBtn) {
        if (!this.localStream) {
            logger.warn('로컬 스트림을 사용할 수 없어 오디오를 토글할 수 없습니다.');
            return;
        }
        this.audioOn = !this.audioOn;
        this.localStream.getAudioTracks().forEach(track => track.enabled = this.audioOn);
        
        const btnElement = btn; 
        const icon = btnElement.querySelector('.control-icon');
        const label = btnElement.querySelector('.control-label');
        
        if (this.audioOn) {
            btnElement.classList.remove('off');
            btnElement.classList.add('on');
            icon.textContent = '🎤';
            label.textContent = '오디오 켜짐';
        } else {
            btnElement.classList.remove('on');
            btnElement.classList.add('off');
            icon.textContent = '🔇';
            label.textContent = '오디오 꺼짐';
        }
    }

    switchTab(index) {
        this.tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
        this.panels.forEach((panel, i) => panel.classList.toggle('active', i === index));
    }

    toggleParticipants() {
        this.participantsPopup.classList.toggle('active');
    }

    endMeeting() {
        logger.info('Ending meeting and redirecting to lobby.');
        
        
        if (this.socket) {
            this.socket.disconnect();
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        window.location.href = '/index.html';
    }
}

new RoomPage();
