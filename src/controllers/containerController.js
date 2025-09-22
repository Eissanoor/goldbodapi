const web3Service = require('../services/web3Service');
const prismaService = require('../services/prismaService');

/**
 * Create a new container
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.createContainer = async (req, res, next) => {
  try {
    const { tagId, rfid, grams, groupHash } = req.body;
    
    // Validate input
    if (!tagId || !rfid || !grams) {
      return res.status(400).json({ error: true, message: 'tagId, rfid, and grams are required' });
    }
    
    // Check if container already exists
    const existingContainer = await prismaService.getContainerByTagId(tagId);
    if (existingContainer) {
      return res.status(409).json({ error: true, message: 'Container with this tagId already exists' });
    }
    
    // Create container on blockchain
    const receipt = await web3Service.createContainer(tagId, rfid, grams, groupHash || '');
    
    // Calculate tokens (10 grams = 1 token)
    const tokens = Math.floor(grams / 10);
    
    // Create container in database
    const container = await prismaService.createContainer({
      tagId,
      rfid,
      grams,
      tokens,
      blockNumber: receipt.blockNumber,
      groupHash: groupHash || null
    });
    
    res.status(201).json({
      success: true,
      container,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get container by tagId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getContainer = async (req, res, next) => {
  try {
    const { tagId } = req.params;
    
    // Get container from database
    const container = await prismaService.getContainerByTagId(tagId);
    
    if (!container) {
      return res.status(404).json({ error: true, message: 'Container not found' });
    }
    
    res.status(200).json({
      success: true,
      container
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get container history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getContainerHistory = async (req, res, next) => {
  try {
    const { tagId } = req.params;
    
    // Check if container exists
    const container = await prismaService.getContainerByTagId(tagId);
    
    if (!container) {
      return res.status(404).json({ error: true, message: 'Container not found' });
    }
    
    // Get container transactions
    const transactions = await prismaService.getContainerTransactions(tagId);
    
    // Get container history from blockchain
    const blockchainHistory = await web3Service.getContainerHistory(tagId);
    
    res.status(200).json({
      success: true,
      container,
      transactions,
      blockchainHistory
    });
  } catch (error) {
    next(error);
  }
};
