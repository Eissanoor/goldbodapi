const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

// Load contract ABI
const contractABIPath = path.join(__dirname, '../../artifacts/contracts/GoldTokenization.sol/GoldTokenization.json');
let contractABI;

try {
  const contractArtifact = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));
  contractABI = contractArtifact.abi;
} catch (error) {
  console.error('Error loading contract ABI:', error);
  contractABI = [];
}

class Web3Service {
  constructor() {
    this.web3 = new Web3(process.env.SEPOLIA_URL || 'http://localhost:8545');
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.privateKey = process.env.PRIVATE_KEY;
    
    if (!this.contractAddress) {
      console.warn('CONTRACT_ADDRESS not set in environment variables');
    }
    
    if (!this.privateKey) {
      console.warn('PRIVATE_KEY not set in environment variables');
    } else {
      // Add account to wallet
      const account = this.web3.eth.accounts.privateKeyToAccount(`0x${this.privateKey.replace(/^0x/, '')}`);
      this.web3.eth.accounts.wallet.add(account);
      this.senderAddress = account.address;
      console.log(`Web3 service initialized with account: ${this.senderAddress}`);
    }
    
    // Initialize contract instance
    if (this.contractAddress && contractABI) {
      this.contract = new this.web3.eth.Contract(contractABI, this.contractAddress);
    } else {
      console.warn('Contract not initialized due to missing address or ABI');
    }
  }

  /**
   * Create a new container on the blockchain
   * @param {string} tagId - Unique identifier for the container
   * @param {string} rfid - RFID tag of the container
   * @param {number} grams - Amount of gold in grams
   * @param {string} groupHash - Optional group hash for batch management
   * @returns {Promise<Object>} - Transaction receipt
   */
  async createContainer(tagId, rfid, grams, groupHash = '') {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const formattedGroupHash = this.web3.utils.stringToHex(groupHash);
    
    const tx = this.contract.methods.createContainer(tagId, rfid, grams, formattedGroupHash);
    
    const gas = await tx.estimateGas({ from: this.senderAddress });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const receipt = await tx.send({
      from: this.senderAddress,
      gas,
      gasPrice
    });
    
    return receipt;
  }

  /**
   * Transfer tokens between containers
   * @param {string} fromTagId - Source container tag ID
   * @param {string} toTagId - Destination container tag ID
   * @param {number} tokenAmount - Amount of tokens to transfer
   * @returns {Promise<Object>} - Transaction receipt
   */
  async transferTokens(fromTagId, toTagId, tokenAmount) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    const tx = this.contract.methods.transferTokens(fromTagId, toTagId, tokenAmount);
    
    const gas = await tx.estimateGas({ from: this.senderAddress });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const receipt = await tx.send({
      from: this.senderAddress,
      gas,
      gasPrice
    });
    
    return receipt;
  }

  /**
   * Create a new group for batch management
   * @param {string} groupHash - Unique hash for the group
   * @param {string} name - Name of the group
   * @param {string} description - Description of the group
   * @returns {Promise<Object>} - Transaction receipt
   */
  async createGroup(groupHash, name, description) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    const formattedGroupHash = this.web3.utils.stringToHex(groupHash);
    
    const tx = this.contract.methods.createGroup(formattedGroupHash, name, description);
    
    const gas = await tx.estimateGas({ from: this.senderAddress });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const receipt = await tx.send({
      from: this.senderAddress,
      gas,
      gasPrice
    });
    
    return receipt;
  }

  /**
   * Get container details from the blockchain
   * @param {string} tagId - Container tag ID
   * @returns {Promise<Object>} - Container details
   */
  async getContainer(tagId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    const container = await this.contract.methods.getContainer(tagId).call();
    
    return {
      tagId: container[0],
      rfid: container[1],
      grams: parseInt(container[2]),
      tokens: parseInt(container[3]),
      blockNumber: parseInt(container[4]),
      groupHash: this.web3.utils.hexToString(container[5]).replace(/\0/g, '')
    };
  }

  /**
   * Get container history from the blockchain
   * @param {string} tagId - Container tag ID
   * @returns {Promise<Array<string>>} - Array of tag IDs representing the container's history
   */
  async getContainerHistory(tagId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    const history = await this.contract.methods.getContainerHistory(tagId).call();
    return history;
  }

  /**
   * Set up event listeners for contract events
   * @param {Function} containerCreatedCallback - Callback for ContainerCreated event
   * @param {Function} tokensTransferredCallback - Callback for TokensTransferred event
   * @param {Function} groupCreatedCallback - Callback for GroupCreated event
   */
  setupEventListeners(containerCreatedCallback, tokensTransferredCallback, groupCreatedCallback) {
    if (!this.contract) {
      console.warn('Contract not initialized. Event listeners not set up.');
      return;
    }
    
    // Listen for ContainerCreated events
    try {
      this.contract.events.ContainerCreated({})
        .on('data', (event) => {
          const { tagId, rfid, grams, tokens, blockNumber, groupHash, timestamp } = event.returnValues;
          containerCreatedCallback({
            tagId,
            rfid,
            grams: parseInt(grams),
            tokens: parseInt(tokens),
            blockNumber: parseInt(blockNumber),
            groupHash: this.web3.utils.hexToString(groupHash).replace(/\0/g, ''),
            timestamp: parseInt(timestamp),
            transactionHash: event.transactionHash
          });
        })
        .on('error', (error) => {
          console.error('Error in ContainerCreated event:', error);
        });
    } catch (error) {
      console.error('Failed to set up ContainerCreated event listener:', error);
    }
    
    // Listen for TokensTransferred events
    try {
      this.contract.events.TokensTransferred({})
        .on('data', (event) => {
          const { fromTagId, toTagId, tokens, grams, timestamp } = event.returnValues;
          tokensTransferredCallback({
            fromTagId,
            toTagId,
            tokens: parseInt(tokens),
            grams: parseInt(grams),
            timestamp: parseInt(timestamp),
            transactionHash: event.transactionHash
          });
        })
        .on('error', (error) => {
          console.error('Error in TokensTransferred event:', error);
        });
    } catch (error) {
      console.error('Failed to set up TokensTransferred event listener:', error);
    }
    
    // Listen for GroupCreated events
    try {
      this.contract.events.GroupCreated({})
        .on('data', (event) => {
          const { groupHash, name, description, timestamp } = event.returnValues;
          groupCreatedCallback({
            groupHash: this.web3.utils.hexToString(groupHash).replace(/\0/g, ''),
            name,
            description,
            timestamp: parseInt(timestamp),
            transactionHash: event.transactionHash
          });
        })
        .on('error', (error) => {
          console.error('Error in GroupCreated event:', error);
        });
    } catch (error) {
      console.error('Failed to set up GroupCreated event listener:', error);
    }
  }
}

module.exports = new Web3Service();
