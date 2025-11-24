import express from 'express';
import validate from '../_middleware/validate.middleware.js';
import { roomService } from '../services/room.service.js';
import { protect } from '../_middleware/auth.middleware.js';
import { roomSchema } from '../_schemas/room.schema.js';
import { sendSuccess, sendError } from '../_utils/response.js';
import logger from '../_utils/logger.js';
import { findUserByAccessToken } from '../_utils/mock.users.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const rooms = await roomService.getAllRooms(searchQuery);
    sendSuccess(res, { rooms }, '회의실 목록을 성공적으로 가져왔습니다.');
  } catch (error) {
    logger.error(`❌ GET /api/rooms 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '회의실 목록을 가져올 수 없습니다.');
  }
});

router.post('/', protect, validate(roomSchema.createRoom), async (req, res) => {
  try {
    const roomData = req.validatedData;
    const hostId = req.user.userId;

    logger.debug('회의실 생성 요청 데이터:', roomData);

    const newRoom = await roomService.createRoom({ ...roomData, requestedRoomId: roomData.requestedRoomId }, hostId);
    logger.debug('생성된 회의실 정보:', newRoom);

    sendSuccess(res, newRoom, '회의실이 성공적으로 생성되었습니다.');

  } catch (error) {
    logger.error(`❌ POST /api/rooms 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '회의실을 생성할 수 없습니다.');
  }
});

router.post('/:roomId/join', validate(roomSchema.joinRoom), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password, guestInfo } = req.validatedData;
    
    let user = null;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      user = findUserByAccessToken(token);
    }

    const isGuest = !user; 

    const joinData = await roomService.prepareJoin({
      roomId,
      password,
      user,
      guestInfo: isGuest ? guestInfo : null,
      isGuest,
    });

    sendSuccess(res, joinData, '참여 토큰이 발급되었습니다.');

  } catch (error) {
    logger.error(`❌ POST /api/rooms/:roomId/join 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '회의실 참여 준비에 실패했습니다.');
  }
});

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete a room
 * @access  Private (Host only)
 */
router.delete('/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    await roomService.deleteRoom(roomId, userId);
    sendSuccess(res, null, '룸이 삭제되었습니다.');
  } catch (error) {
    logger.error(`❌ DELETE /api/rooms/:roomId 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '룸 삭제에 실패했습니다.');
  }
});

/**
 * @route   DELETE /api/rooms/:roomId/participants/me
 * @desc    Leave a room
 * @access  Private
 */
router.delete('/:roomId/participants/me', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    await roomService.leaveRoom(roomId, userId);
    sendSuccess(res, null, '룸에서 퇴장했습니다.');
  } catch (error) {
    logger.error(`❌ DELETE /api/rooms/:roomId/participants/me 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '룸 퇴장에 실패했습니다.');
  }
});

/**
 * @route   DELETE /api/rooms/:roomId/participants/:userId
 * @desc    Kick a participant from a room
 * @access  Private (Host only)
 */
router.delete('/:roomId/participants/:userId', protect, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const hostId = req.user.userId;

    await roomService.kickParticipant(roomId, userId, hostId);
    sendSuccess(res, null, '참여자가 강퇴되었습니다.');
  } catch (error) {
    logger.error(`❌ DELETE /api/rooms/:roomId/participants/:userId 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '참여자 강퇴에 실패했습니다.');
  }
});

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get details of a specific room
 * @access  Public
 */
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await roomService.getRoomDetails(roomId);

    if (!room) {
      return sendError(res, 'ROOM_NOT_FOUND', '회의실을 찾을 수 없습니다.');
    }

    sendSuccess(res, room, '회의실 정보를 성공적으로 가져왔습니다.');
  } catch (error) {
    logger.error(`❌ GET /api/rooms/:roomId 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '회의실 정보를 가져올 수 없습니다.');
  }
});

/**
 * @route   GET /api/rooms/:roomId/participants
 * @desc    Get list of participants in a specific room
 * @access  Public
 */
router.get('/:roomId/participants', async (req, res) => {
  try {
    const { roomId } = req.params;
    const participants = await roomService.getParticipants(roomId);

    sendSuccess(res, { participants }, '회의실 참여자 목록을 성공적으로 가져왔습니다.');
  } catch (error) {
    logger.error(`❌ GET /api/rooms/:roomId/participants 오류 발생: ${error.message}`);
    sendError(res, error.code || 'INTERNAL_SERVER_ERROR', error.message || '회의실 참여자 목록을 가져올 수 없습니다.');
  }
});

export default router;
