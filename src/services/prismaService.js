const prisma = require('./db');

class PrismaService {
  /**
   * Create a new container in the database
   * @param {Object} data - Container data
   * @returns {Promise<Object>} - Created container
   */
  async createContainer(data) {
    const blockNumber = typeof data.blockNumber === 'bigint' ? Number(data.blockNumber) : data.blockNumber;
    return prisma.container.create({
      data: {
        tagId: data.tagId,
        rfid: data.rfid,
        grams: data.grams,
        tokens: data.tokens,
        blockNumber,
        groupHash: data.groupHash || null
      }
    });
  }

  /**
   * Get a container by tagId
   * @param {string} tagId - Container tag ID
   * @returns {Promise<Object>} - Container
   */
  async getContainerByTagId(tagId) {
    return prisma.container.findUnique({
      where: { tagId }
    });
  }

  /**
   * Update a container in the database
   * @param {string} tagId - Container tag ID
   * @param {Object} data - Updated container data
   * @returns {Promise<Object>} - Updated container
   */
  async updateContainer(tagId, data) {
    return prisma.container.update({
      where: { tagId },
      data
    });
  }

  /**
   * Create a new transaction in the database
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Created transaction
   */
  async createTransaction(data) {
    const blockNumber = typeof data.blockNumber === 'bigint' ? Number(data.blockNumber) : data.blockNumber;
    return prisma.transaction.create({
      data: {
        fromTagId: data.fromTagId,
        toTagId: data.toTagId,
        tokens: data.tokens,
        grams: data.grams,
        transactionHash: data.transactionHash,
        blockNumber
      }
    });
  }

  /**
   * Get transactions for a container
   * @param {string} tagId - Container tag ID
   * @returns {Promise<Array<Object>>} - Transactions
   */
  async getContainerTransactions(tagId) {
    return prisma.transaction.findMany({
      where: {
        OR: [
          { fromTagId: tagId },
          { toTagId: tagId }
        ]
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  /**
   * Create a new group in the database
   * @param {Object} data - Group data
   * @returns {Promise<Object>} - Created group
   */
  async createGroup(data) {
    return prisma.group.create({
      data: {
        groupHash: data.groupHash,
        name: data.name,
        description: data.description
      }
    });
  }

  /**
   * Get a group by groupHash
   * @param {string} groupHash - Group hash
   * @returns {Promise<Object>} - Group
   */
  async getGroupByHash(groupHash) {
    return prisma.group.findUnique({
      where: { groupHash }
    });
  }

  /**
   * Get containers by groupHash
   * @param {string} groupHash - Group hash
   * @returns {Promise<Array<Object>>} - Containers
   */
  async getContainersByGroupHash(groupHash) {
    return prisma.container.findMany({
      where: { groupHash }
    });
  }

  /**
   * Get all transactions with pagination
   * @param {number} page - Page number
   * @param {number} limit - Number of items per page
   * @returns {Promise<Object>} - Transactions and pagination info
   */
  async getAllTransactions(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' }
      }),
      prisma.transaction.count()
    ]);
    
    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Verify container exists in database, if not create it from blockchain data
   * @param {string} tagId - Container tag ID
   * @param {Object} blockchainData - Container data from blockchain
   * @returns {Promise<Object>} - Container
   */
  async verifyAndSyncContainer(tagId, blockchainData) {
    const container = await this.getContainerByTagId(tagId);
    
    if (!container) {
      return this.createContainer({
        tagId: blockchainData.tagId,
        rfid: blockchainData.rfid,
        grams: blockchainData.grams,
        tokens: blockchainData.tokens,
        blockNumber: blockchainData.blockNumber,
        groupHash: blockchainData.groupHash || null
      });
    }
    
    return container;
  }
}

module.exports = new PrismaService();
