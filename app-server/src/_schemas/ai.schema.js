import Joi from 'joi';

/**
 * GEMINI NOTE:
 * Schema for validating incoming AI query messages from the client,
 * as per the structure defined in API.md.
 */
export const aiQuerySchema = Joi.object({
  type: Joi.string().valid('ai-query').required(),
  data: Joi.object({
    roomId: Joi.string().required(),
    query: Joi.string().min(1).max(1000).required(),
  }).required(),
});
