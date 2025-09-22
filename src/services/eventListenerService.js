const web3Service = require('./web3Service');
const prismaService = require('./prismaService');

class EventListenerService {
  constructor() {
    this.isListening = false;
  }

  /**
   * Start listening for blockchain events
   */
  startListening() {
    if (this.isListening) {
      console.log('Event listener is already running');
      return;
    }

    try {
      web3Service.setupEventListeners(
        this.handleContainerCreated.bind(this),
        this.handleTokensTransferred.bind(this),
        this.handleGroupCreated.bind(this)
      );
      
      this.isListening = true;
      console.log('Blockchain event listener started');
    } catch (error) {
      console.error('Failed to start event listener:', error);
    }
  }

  /**
   * Handle ContainerCreated event
   * @param {Object} eventData - Event data
   */
  async handleContainerCreated(eventData) {
    try {
      console.log('ContainerCreated event received:', eventData);
      
      // Create container in database
      await prismaService.createContainer({
        tagId: eventData.tagId,
        rfid: eventData.rfid,
        grams: eventData.grams,
        tokens: eventData.tokens,
        blockNumber: eventData.blockNumber,
        groupHash: eventData.groupHash || null
      });
      
      console.log(`Container ${eventData.tagId} synced to database`);
    } catch (error) {
      console.error('Error handling ContainerCreated event:', error);
    }
  }

  /**
   * Handle TokensTransferred event
   * @param {Object} eventData - Event data
   */
  async handleTokensTransferred(eventData) {
    try {
      console.log('TokensTransferred event received:', eventData);
      
      // Get blockchain data for source and destination containers
      const [fromContainer, toContainer] = await Promise.all([
        web3Service.getContainer(eventData.fromTagId),
        web3Service.getContainer(eventData.toTagId)
      ]);
      
      // Update or create containers in database
      await Promise.all([
        prismaService.verifyAndSyncContainer(eventData.fromTagId, fromContainer),
        prismaService.verifyAndSyncContainer(eventData.toTagId, toContainer)
      ]);
      
      // Create transaction record
      await prismaService.createTransaction({
        fromTagId: eventData.fromTagId,
        toTagId: eventData.toTagId,
        tokens: eventData.tokens,
        grams: eventData.grams,
        transactionHash: eventData.transactionHash,
        blockNumber: null // Will be updated when transaction is mined
      });
      
      console.log(`Transaction from ${eventData.fromTagId} to ${eventData.toTagId} synced to database`);
    } catch (error) {
      console.error('Error handling TokensTransferred event:', error);
    }
  }

  /**
   * Handle GroupCreated event
   * @param {Object} eventData - Event data
   */
  async handleGroupCreated(eventData) {
    try {
      console.log('GroupCreated event received:', eventData);
      
      // Create group in database
      await prismaService.createGroup({
        groupHash: eventData.groupHash,
        name: eventData.name,
        description: eventData.description
      });
      
      console.log(`Group ${eventData.groupHash} synced to database`);
    } catch (error) {
      console.error('Error handling GroupCreated event:', error);
    }
  }
}

module.exports = new EventListenerService();
