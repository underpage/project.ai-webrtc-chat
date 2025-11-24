import Joi from 'joi';

// Schema for POST /api/rooms
const createRoom = Joi.object({
  title: Joi.string().max(100).required(),
  description: Joi.string().max(255).optional().allow(''),
  maxParticipants: Joi.number().integer().min(2).max(50).optional().default(6),
  roomPassword: Joi.string().min(4).max(20).optional().allow(''),
  requestedRoomId: Joi.string().optional(),
});

// Schema for POST /api/rooms/:roomId/join
const joinRoom = Joi.object({
  // roomId is in params, not body
  password: Joi.string().optional().allow(''),
  guestInfo: Joi.object({
    name: Joi.string().required(),
    dept: Joi.string().optional().allow(''),
    company: Joi.string().optional().allow(''),
  }).optional(),
});

export const roomSchema = {
  createRoom,
  joinRoom,
};