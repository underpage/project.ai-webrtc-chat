import Joi from 'joi';

const login = Joi.object({
  userId: Joi.string().required(),
  password: Joi.string().required(),
});

const signup = Joi.object({
  userId: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')).required(),
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  department: Joi.string().optional().allow(''),
  company: Joi.string().optional().allow(''),
});

export const authSchema = {
  login,
  signup,
};
