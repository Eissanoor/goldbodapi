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
    // Prefer explicit WEB3_PROVIDER_URL, fallback to localhost
    const providerUrl = process.env.WEB3_PROVIDER_URL || 'http://127.0.0.1:8545';
    this.web3 = new Web3(providerUrl);
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

  // Normalize input to a valid bytes32 hex string
  toBytes32(input) {
    const zeroBytes32 = '0x' + '0'.repeat(64);
    if (!input || (typeof input === 'string' && input.trim() === '')) return zeroBytes32;
    if (typeof input === 'string' && /^0x[0-9a-fA-F]{64}$/.test(input)) return input;
    // Hash arbitrary input to bytes32
    return this.web3.utils.keccak256(String(input));
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

    const formattedGroupHash = this.toBytes32(groupHash);
    
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
    
    const formattedGroupHash = this.toBytes32(groupHash);
    
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
    
    console.log('Setting up event polling...');
    
    // Instead of using subscriptions which aren't supported by all providers,
    // we'll set up a polling mechanism to check for events periodically
    
    // Store the last processed block number (Number)
    let lastProcessedBlock = 0;
    
    // Function to get the current block number as Number
    const getCurrentBlock = async () => {
      try {
        const bn = await this.web3.eth.getBlockNumber(); // may be BigInt
        return typeof bn === 'bigint' ? Number(bn) : Number(bn);
      } catch (error) {
        console.error('Error getting current block number:', error);
        return lastProcessedBlock;
      }
    };
    
    // Function to process events in a block range (Numbers)
    const processEvents = async (fromBlock, toBlock) => {
      try {
        console.log(`Checking for events from block ${fromBlock} to ${toBlock}`);
        
        // Get past ContainerCreated events
        try {
          const containerCreatedEvents = await this.web3.eth.getPastLogs({
            address: this.contractAddress,
            fromBlock: Number(fromBlock),
            toBlock: Number(toBlock),
            topics: [this.web3.utils.keccak256('ContainerCreated(string,string,uint256,uint256,uint256,bytes32,uint256)')]
          });
          
          for (const event of containerCreatedEvents) {
            console.log('ContainerCreated event found:', event);
            try {
              // Process the event
              const decodedLog = this.web3.eth.abi.decodeLog(
                [
                  { type: 'string', name: 'tagId', indexed: true },
                  { type: 'string', name: 'rfid' },
                  { type: 'uint256', name: 'grams' },
                  { type: 'uint256', name: 'tokens' },
                  { type: 'uint256', name: 'blockNumber' },
                  { type: 'bytes32', name: 'groupHash', indexed: true },
                  { type: 'uint256', name: 'timestamp' }
                ],
                event.data,
                event.topics.slice(1)
              );
              
              containerCreatedCallback({
                tagId: decodedLog.tagId,
                rfid: decodedLog.rfid,
                grams: parseInt(decodedLog.grams),
                tokens: parseInt(decodedLog.tokens),
                blockNumber: parseInt(decodedLog.blockNumber),
                groupHash: this.web3.utils.hexToString(decodedLog.groupHash).replace(/\0/g, ''),
                timestamp: parseInt(decodedLog.timestamp),
                transactionHash: event.transactionHash
              });
            } catch (error) {
              console.error('Error processing ContainerCreated event:', error);
            }
          }
        } catch (error) {
          console.error('Error getting ContainerCreated events:', error);
        }
        
        // Get past TokensTransferred events
        try {
          const tokensTransferredEvents = await this.web3.eth.getPastLogs({
            address: this.contractAddress,
            fromBlock: Number(fromBlock),
            toBlock: Number(toBlock),
            topics: [this.web3.utils.keccak256('TokensTransferred(string,string,uint256,uint256,uint256)')]
          });
          
          for (const event of tokensTransferredEvents) {
            console.log('TokensTransferred event found:', event);
            try {
              // Process the event
              const decodedLog = this.web3.eth.abi.decodeLog(
                [
                  { type: 'string', name: 'fromTagId', indexed: true },
                  { type: 'string', name: 'toTagId', indexed: true },
                  { type: 'uint256', name: 'tokens' },
                  { type: 'uint256', name: 'grams' },
                  { type: 'uint256', name: 'timestamp' }
                ],
                event.data,
                event.topics.slice(1)
              );
              
              tokensTransferredCallback({
                fromTagId: decodedLog.fromTagId,
                toTagId: decodedLog.toTagId,
                tokens: parseInt(decodedLog.tokens),
                grams: parseInt(decodedLog.grams),
                timestamp: parseInt(decodedLog.timestamp),
                transactionHash: event.transactionHash
              });
            } catch (error) {
              console.error('Error processing TokensTransferred event:', error);
            }
          }
        } catch (error) {
          console.error('Error getting TokensTransferred events:', error);
        }
        
        // Get past GroupCreated events
        try {
          const groupCreatedEvents = await this.web3.eth.getPastLogs({
            address: this.contractAddress,
            fromBlock: Number(fromBlock),
            toBlock: Number(toBlock),
            topics: [this.web3.utils.keccak256('GroupCreated(bytes32,string,string,uint256)')]
          });
          
          for (const event of groupCreatedEvents) {
            console.log('GroupCreated event found:', event);
            try {
              // Process the event
              const decodedLog = this.web3.eth.abi.decodeLog(
                [
                  { type: 'bytes32', name: 'groupHash', indexed: true },
                  { type: 'string', name: 'name' },
                  { type: 'string', name: 'description' },
                  { type: 'uint256', name: 'timestamp' }
                ],
                event.data,
                event.topics.slice(1)
              );
              
              groupCreatedCallback({
                groupHash: this.web3.utils.hexToString(decodedLog.groupHash).replace(/\0/g, ''),
                name: decodedLog.name,
                description: decodedLog.description,
                timestamp: parseInt(decodedLog.timestamp),
                transactionHash: event.transactionHash
              });
            } catch (error) {
              console.error('Error processing GroupCreated event:', error);
            }
          }
        } catch (error) {
          console.error('Error getting GroupCreated events:', error);
        }
      } catch (error) {
        console.error('Error processing events:', error);
      }
    };
    
    // Start polling for events
    const pollEvents = async () => {
      try {
        // Get the current block number
        const currentBlock = await getCurrentBlock();
        
        // If this is the first time, just set the last processed block and return
        if (lastProcessedBlock === 0) {
          lastProcessedBlock = currentBlock;
          console.log(`Starting event polling from block ${lastProcessedBlock}`);
          return;
        }
        
        // If there are new blocks, process them
        if (currentBlock > lastProcessedBlock) {
          await processEvents(lastProcessedBlock + 1, currentBlock);
          lastProcessedBlock = currentBlock;
        }
      } catch (error) {
        console.error('Error polling events:', error);
      }
    };
    
    // Initial poll
    pollEvents();
    
    // Set up interval to poll for events every 10 seconds
    const pollInterval = setInterval(pollEvents, 10000);
    
    // Store the interval ID so it can be cleared later if needed
    this.pollInterval = pollInterval;
    
    console.log('Event polling set up successfully');
  }
}

module.exports = new Web3Service();
