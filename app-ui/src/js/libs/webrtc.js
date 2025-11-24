import { getSocketClient } from './socket.js';
import logger from '../utils/logger.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class WebRTCManager {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.socket = getSocketClient();
  }

  async createPublisherConnection(localStream) {
    this.localStream = localStream;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.setupPeerConnectionListeners();
    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream);
    });

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      logger.info('Created SDP offer for publishing.');
      this.socket.send({
        type: 'sdp-offer',
        data: {
          usage: 'publish',
          jsep: offer,
        },
      });

    } catch (error) {
      logger.error('Error creating publisher connection:', error);
    }
  }

  setupPeerConnectionListeners() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.send({
          type: 'ice-candidate',
          data: {
            usage: 'publish',
            candidate: event.candidate,
          },
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      logger.info(`ICE connection state changed to: ${this.pc.iceConnectionState}`);
    };

    this.pc.ontrack = (event) => {
      logger.info('Received remote track (unexpected for publisher).', event);
    };
  }

  async handleRemoteAnswer(answer) {
    if (!this.pc) {
      logger.warn('PeerConnection not initialized when handling answer.');
      return;
    }
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      logger.info('Set remote SDP answer successfully.');
    } catch (error) {
      logger.error('Error setting remote description:', error);
    }
  }

  async handleRemoteIceCandidate(candidate) {
    if (!this.pc) {
      logger.warn('PeerConnection not initialized when handling ICE candidate.');
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      logger.error('Error adding received ICE candidate:', error);
    }
  }
  
  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.localStream = null;
    logger.info('WebRTC connection closed.');
  }
}

export const webrtcManager = new WebRTCManager();