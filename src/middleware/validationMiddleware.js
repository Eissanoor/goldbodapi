const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Container validation rules
exports.createContainerRules = [
  body('tagId').notEmpty().withMessage('Tag ID is required'),
  body('rfid').notEmpty().withMessage('RFID is required'),
  body('grams').isNumeric().withMessage('Grams must be a number').custom(value => {
    if (value <= 0) {
      throw new Error('Grams must be greater than 0');
    }
    return true;
  }),
  body('groupHash').optional(),
  validate
];

// Transaction validation rules
exports.transferTokensRules = [
  body('fromTagId').notEmpty().withMessage('Source tag ID is required'),
  body('toTagId').notEmpty().withMessage('Destination tag ID is required'),
  body('tokenAmount').isNumeric().withMessage('Token amount must be a number').custom(value => {
    if (value <= 0) {
      throw new Error('Token amount must be greater than 0');
    }
    return true;
  }),
  validate
];

// Group validation rules
exports.createGroupRules = [
  body('name').notEmpty().withMessage('Group name is required'),
  body('description').optional(),
  validate
];

// Container param validation
exports.containerParamRules = [
  param('tagId').notEmpty().withMessage('Tag ID is required'),
  validate
];

// Group param validation
exports.groupParamRules = [
  param('groupHash').notEmpty().withMessage('Group hash is required'),
  validate
];

// Pagination validation
exports.paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate
];
