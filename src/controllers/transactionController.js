const web3Service = require('../services/web3Service');
const prismaService = require('../services/prismaService');

/**
 * Transfer tokens between containers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.transferTokens = async (req, res, next) => {
  try {
    const { fromTagId, toTagId, tokenAmount } = req.body;
    
    // Validate input
    if (!fromTagId || !toTagId || !tokenAmount) {
      return res.status(400).json({ error: true, message: 'fromTagId, toTagId, and tokenAmount are required' });
    }
    
    // Check if source container exists
    const sourceContainer = await prismaService.getContainerByTagId(fromTagId);
    if (!sourceContainer) {
      return res.status(404).json({ error: true, message: 'Source container not found' });
    }
    
    // Check if source container has enough tokens
    if (sourceContainer.tokens < tokenAmount) {
      return res.status(400).json({ error: true, message: 'Insufficient tokens in source container' });
    }
    
    // Calculate grams to transfer
    const gramsToTransfer = tokenAmount * 10;
    
    // Transfer tokens on blockchain
    const receipt = await web3Service.transferTokens(fromTagId, toTagId, tokenAmount);
    
    // Update source container in database
    await prismaService.updateContainer(fromTagId, {
      tokens: sourceContainer.tokens - tokenAmount,
      grams: sourceContainer.grams - gramsToTransfer
    });
    
    // Check if destination container exists
    const destContainer = await prismaService.getContainerByTagId(toTagId);
    
    if (destContainer) {
      // Update destination container
      await prismaService.updateContainer(toTagId, {
        tokens: destContainer.tokens + tokenAmount,
        grams: destContainer.grams + gramsToTransfer
      });
    } else {
      // Create destination container
      await prismaService.createContainer({
        tagId: toTagId,
        rfid: '',
        grams: gramsToTransfer,
        tokens: tokenAmount,
        blockNumber: receipt.blockNumber,
        groupHash: null
      });
    }
    
    // Create transaction record
    const transaction = await prismaService.createTransaction({
      fromTagId,
      toTagId,
      tokens: tokenAmount,
      grams: gramsToTransfer,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
    
    res.status(200).json({
      success: true,
      transaction,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all transactions with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await prismaService.getAllTransactions(page, limit);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};
