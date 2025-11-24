import crypto from 'crypto';
import { janusManager } from '../janus/janus.client.js';
import { pool } from '../_config/db.config.js';
import logger from '../_utils/logger.js';
import { janusConfig } from '../_config/janus.config.js';

class RoomService {
  async createRoom({ title, description, maxParticipants = 6, roomPassword, requestedRoomId }, hostId) {
    let roomId = requestedRoomId; // Use requestedId if provided
    let janusRoomId = null;
    let isNewJanusRoom = false; // Flag to indicate if we created a new Janus room
    
    const dbConnection = await pool.getConnection();

    try {
      // If a specific room ID is requested, check if it's the static room 9999
      if (roomId === '9999') {
        const existingJanusRoom = await janusManager.getRoomDetails(9999);
        if (existingJanusRoom) {
          // Room 9999 exists, use its details (or just its ID for now)
          janusRoomId = 9999;
          logger.info(`✅ 정적 Janus 룸 9999 사용: ${janusRoomId}`);
          // We don't create a new Janus room, so no need to destroy on rollback
        } else {
          // Static room 9999 was requested but not found in Janus
          throw new Error('요청된 정적 룸 (9999)을 Janus에서 찾을 수 없습니다.');
        }
      } else {
        // No specific roomId requested, or it's not 9999, so generate a new one
        roomId = crypto.randomUUID().replace(/-/g, '');
        const janusOptions = {
          room: roomId,
          description: title,
          publishers: maxParticipants,
          pin: roomPassword,
        };
        janusRoomId = await janusManager.createRoom(janusOptions);
        isNewJanusRoom = true; // We created a new Janus room
        
        if (janusRoomId.toString() !== roomId) {
          throw new Error(`Janus가 예상과 다른 룸 ID(${janusRoomId})로 룸을 생성했습니다. (${roomId})`);
        }
      }

      await dbConnection.beginTransaction();
      
      const [result] = await dbConnection.execute(
        `INSERT INTO rooms (id, title, description, max_participants, password, host_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [roomId, title, description, maxParticipants, roomPassword || null, hostId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('데이터베이스에 회의실 정보를 저장하지 못했습니다.');
      }
      
      await dbConnection.commit();
      logger.info(`✅ 회의실 ${roomId}가 성공적으로 생성되어 DB에 저장되었습니다.`);

      return {
        roomId,
        hostId,
        title,
      };

    } catch (error) {
      logger.error(`❌ 호스트 ${hostId}의 회의실 생성 실패: ${error.message}`);
      
      await dbConnection.rollback();
      logger.info(`회의실 ${roomId}에 대한 DB 트랜잭션이 롤백되었습니다.`);

      if (isNewJanusRoom && janusRoomId) { // Only destroy if we created it
        await janusManager.destroyRoom(janusRoomId);
      }

      const err = new Error('회의실을 생성할 수 없습니다.');
      err.code = 'INTERNAL_SERVER_ERROR';
      throw err;
      
    } finally {
      dbConnection.release();
    }
  }

  async prepareJoin({ roomId, password, user, guestInfo, isGuest }) {
    const dbConnection = await pool.getConnection();
    try {
      const [rows] = await dbConnection.execute(
        `SELECT r.*, (SELECT COUNT(id) FROM room_participants WHERE room_id = r.id AND status = 'active') as participant_count
         FROM rooms r WHERE r.id = ? AND r.status = 'active'`,
        [roomId]
      );

      if (rows.length === 0) {
        const err = new Error('요청한 회의실이 존재하지 않거나 활성화되어 있지 않습니다.');
        err.code = 'ROOM_NOT_FOUND';
        throw err;
      }

      const room = rows[0];

      if (room.password && room.password !== password) {
        const err = new Error('회의실 비밀번호가 올바르지 않습니다.');
        err.code = 'INVALID_PASSWORD';
        throw err;
      }

      if (room.participant_count >= room.max_participants) {
        const err = new Error('회의실 정원이 꽉 찼습니다.');
        err.code = 'ROOM_FULL';
        throw err;
      }
      
      const joinToken = crypto.randomUUID();
      const userId = isGuest ? null : user.uid;
      const displayName = isGuest ? guestInfo.name : user.name;
      const guestDetails = isGuest ? JSON.stringify(guestInfo) : null;
      
      await dbConnection.execute(
        `INSERT INTO room_participants (room_id, user_id, display_name, guest_info, join_token, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [roomId, userId, displayName, guestDetails, joinToken]
      );
      
      logger.info(`✅ 사용자 '${displayName}'가 회의실 ${roomId} 참여 준비 완료. 토큰 발급.`);
      
      return {
        roomId,
        joinToken,
        participants: []
      };

    } catch (error) {
      logger.error(`❌ 회의실 ${roomId} 참여 준비 실패: ${error.message}`);
      if (error.code) throw error;
      const genericError = new Error('회의실 참여 준비에 실패했습니다.');
      genericError.code = 'INTERNAL_SERVER_ERROR';
      throw genericError;
    } finally {
      dbConnection.release();
    }
  }

  async getAllRooms() {
    const dbConnection = await pool.getConnection();
    try {
      let rooms = [];

      // 1. Get static room 9999 from Janus
      try {
        const staticRoomId = 9999;
        const janusStaticRoom = await janusManager.getRoomDetails(staticRoomId);
        if (janusStaticRoom) {
          // Construct a room object for the static room
          // Use default values for properties not available directly from Janus
          rooms.push({
            roomId: staticRoomId.toString(),
            title: `정적 테스트 룸 (${staticRoomId})`, // Default title
            description: 'Janus Gateway에 미리 설정된 정적 테스트 회의실입니다.', // Default description
            maxParticipants: janusStaticRoom.bitrate_cap || 6, // Use Janus info if available, else default
            currentParticipants: janusStaticRoom.num_participants || 0, // Get current participants from Janus
            createdAt: new Date().toISOString(),
            isStatic: true, // Indicate this is a static room
          });
          logger.info(`✅ 정적 Janus 룸 ${staticRoomId} 정보를 목록에 추가했습니다.`);
        }
      } catch (janusError) {
        logger.warn(`⚠️ 정적 Janus 룸 9999 정보를 가져오는 데 실패했습니다: ${janusError.message}`);
        // Continue to fetch DB rooms even if static room fails
      }

      // 2. Get rooms from the database
      const [dbRows] = await dbConnection.execute(
        `SELECT 
           r.id as roomId, 
           r.title, 
           r.description, 
           r.max_participants as maxParticipants,
           COUNT(rp.id) as currentParticipants,
           r.created_at as createdAt
         FROM rooms r
         LEFT JOIN room_participants rp ON r.id = rp.room_id AND rp.status = 'active'
         WHERE r.status = 'active'
         GROUP BY r.id
         ORDER BY r.created_at DESC`
      );
      
      // Combine and return
      rooms = rooms.concat(dbRows);
      
      logger.info('✅ 모든 활성 회의실 목록을 성공적으로 가져왔습니다.');
      return rooms;

    } catch (error) {
      logger.error(`❌ 모든 회의실 목록 조회 실패: ${error.message}`);
      const err = new Error('회의실 목록을 가져올 수 없습니다.');
      err.code = 'INTERNAL_SERVER_ERROR';
      throw err;
    } finally {
      dbConnection.release();
    }
  }

  async deleteRoom(roomId, userId) {
    const dbConnection = await pool.getConnection();
    try {
      await dbConnection.beginTransaction();

      const [roomRows] = await dbConnection.execute(
        `SELECT host_id FROM rooms WHERE id = ? AND status = 'active'`,
        [roomId]
      );

      if (roomRows.length === 0) {
        const err = new Error('회의실을 찾을 수 없습니다.');
        err.code = 'ROOM_NOT_FOUND';
        throw err;
      }

      const room = roomRows[0];
      if (room.host_id !== userId) {
        const err = new Error('회의실을 삭제할 권한이 없습니다.');
        err.code = 'FORBIDDEN';
        throw err;
      }

      const [updateResult] = await dbConnection.execute(
        `UPDATE rooms SET status = 'deleted', updated_at = NOW() WHERE id = ?`,
        [roomId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('룸 상태 업데이트에 실패했습니다.');
      }

      await janusManager.destroyRoom(roomId);

      await dbConnection.commit();
      logger.info(`✅ 회의실 ${roomId}가 성공적으로 삭제되었습니다.`);

    } catch (error) {
      await dbConnection.rollback();
      logger.error(`❌ 회의실 ${roomId} 삭제 실패: ${error.message}`);
      if (error.code) throw error;
      const err = new Error('회의실 삭제에 실패했습니다.');
      err.code = 'INTERNAL_SERVER_ERROR';
      throw err;
    } finally {
      dbConnection.release();
    }
  }

  async leaveRoom(roomId, userId) {
    const dbConnection = await pool.getConnection();
    try {
      await dbConnection.beginTransaction();

      const [participantRows] = await dbConnection.execute(
        `SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND status = 'active'`,
        [roomId, userId]
      );

      if (participantRows.length === 0) {
        const err = new Error('참여 정보를 찾을 수 없거나 이미 퇴장했습니다.');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      const participantId = participantRows[0].id;

      const [updateResult] = await dbConnection.execute(
        `UPDATE room_participants SET status = 'inactive', left_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [participantId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('참여자 상태 업데이트에 실패했습니다.');
      }

      await dbConnection.commit();
      logger.info(`✅ 사용자 ${userId}가 회의실 ${roomId}에서 퇴장했습니다.`);

    } catch (error) {
      await dbConnection.rollback();
      logger.error(`❌ 사용자 ${userId}의 회의실 ${roomId} 퇴장 실패: ${error.message}`);
      if (error.code) throw error;
      const err = new Error('룸 퇴장에 실패했습니다.');
      err.code = 'INTERNAL_SERVER_ERROR';
      throw err;
    } finally {
      dbConnection.release();
    }
  }

  /**
   * Kicks a participant from a room. Only the host can kick participants.
   * @param {string} roomId - The ID of the room.
   * @param {string} participantUserId - The ID of the participant user to kick.
   * @param {string} hostId - The ID of the host performing the kick.
   */
  async kickParticipant(roomId, participantUserId, hostId) {
    const dbConnection = await pool.getConnection();
    try {
      await dbConnection.beginTransaction();

      // Verify host privileges and room existence
      const [roomRows] = await dbConnection.execute(
        `SELECT host_id FROM rooms WHERE id = ? AND status = 'active'`,
        [roomId]
      );

      if (roomRows.length === 0) {
        const err = new Error('회의실을 찾을 수 없습니다.');
        err.code = 'ROOM_NOT_FOUND';
        throw err;
      }

      const room = roomRows[0];
      if (room.host_id !== hostId) {
        const err = new Error('참여자를 강퇴할 권한이 없습니다.');
        err.code = 'FORBIDDEN';
        throw err;
      }

      // Find the participant record
      const [participantRows] = await dbConnection.execute(
        `SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND status = 'active'`,
        [roomId, participantUserId]
      );

      if (participantRows.length === 0) {
        const err = new Error('강퇴할 참여자를 찾을 수 없거나 이미 퇴장했습니다.');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      const participantId = participantRows[0].id;

      // Update participant status to 'inactive' (kicked)
      const [updateResult] = await dbConnection.execute(
        `UPDATE room_participants SET status = 'kicked', left_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [participantId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('참여자 상태 업데이트에 실패했습니다.');
      }

      // TODO: Signal Janus to remove participant's media (if any)
      // TODO: Notify client via WebSocket that participant was kicked

      await dbConnection.commit();
      logger.info(`✅ 호스트 ${hostId}가 회의실 ${roomId}에서 사용자 ${participantUserId}를 강퇴했습니다.`);

    } catch (error) {
      await dbConnection.rollback();
      logger.error(`❌ 호스트 ${hostId}의 회의실 ${roomId}에서 사용자 ${participantUserId} 강퇴 실패: ${error.message}`);
      if (error.code) throw error;
      const err = new Error('참여자 강퇴에 실패했습니다.');
      err.code = 'INTERNAL_SERVER_ERROR';
      throw err;
    } finally {
      dbConnection.release();
    }
  }
}

export const roomService = new RoomService();


