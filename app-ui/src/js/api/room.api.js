import { httpClient } from './http-client.js';
import logger from '../utils/logger.js';

export const createRoom = (roomData) => {
  return httpClient.post('/rooms', roomData, true);
};

export const getAllRooms = async (searchQuery = '') => {
  try {
    let url = '/rooms';
    if (searchQuery) {
      url += `?search=${encodeURIComponent(searchQuery)}`;
    }
    return await httpClient.get(url);
    
  } catch (error) {
    logger.warn('실제 회의실을 가져오는 데 실패했습니다. 목 데이터를 반환합니다:', error);
    
    return {
      rooms: [
        { roomId: 'mock-1', title: '테스트 회의실 1 (모의)', currentParticipants: 2, maxParticipants: 5 },
        { roomId: 'mock-2', title: '프로젝트 알파 (모의)', currentParticipants: 1, maxParticipants: 10 },
        { roomId: 'mock-3', title: '일일 스탠드업 (모의)', currentParticipants: 4, maxParticipants: 8 },
      ]
    };
  }
};

export const joinRoom = (roomId, password = null, userData = {}) => {
  const payload = {
    password,
    ...userData,
  };
  return httpClient.post(`/rooms/${roomId}/join`, payload, false);
};