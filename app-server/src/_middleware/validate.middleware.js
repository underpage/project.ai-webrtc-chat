import Joi from 'joi';

const validate = (schema) => {
  return (req, res, next) => {

    // 1. 검증 옵션 추가 (불필요한 필드 제거, 타입 변환)
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.validatedData = value;
    next();
  };
};

export default validate;