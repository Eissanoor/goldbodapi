const web3Service = require('../services/web3Service');
const prismaService = require('../services/prismaService');
const crypto = require('crypto');

/**
 * Create a new group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ error: true, message: 'Group name is required' });
    }
    
    // Generate group hash
    const groupHash = crypto.createHash('sha256').update(`${name}-${Date.now()}`).digest('hex');
    
    // Create group on blockchain
    const receipt = await web3Service.createGroup(groupHash, name, description || '');
    
    // Create group in database
    const group = await prismaService.createGroup({
      groupHash,
      name,
      description: description || null
    });
    
    res.status(201).json({
      success: true,
      group,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get group by hash
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getGroup = async (req, res, next) => {
  try {
    const { groupHash } = req.params;
    
    // Get group from database
    const group = await prismaService.getGroupByHash(groupHash);
    
    if (!group) {
      return res.status(404).json({ error: true, message: 'Group not found' });
    }
    
    // Get containers in this group
    const containers = await prismaService.getContainersByGroupHash(groupHash);
    
    res.status(200).json({
      success: true,
      group,
      containers
    });
  } catch (error) {
    next(error);
  }
};
