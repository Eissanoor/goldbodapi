// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title GoldTokenization
 * @dev Contract for tokenizing physical gold holdings
 * Each physical gold container is represented on the blockchain
 * 10 grams of gold = 1 digital token
 */
contract GoldTokenization is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GROUP_MANAGER_ROLE = keccak256("GROUP_MANAGER_ROLE");
    
    // Counter for tracking block numbers
    Counters.Counter private _blockNumberCounter;

    // Conversion rate: 10 grams = 1 token
    uint256 public constant GRAMS_PER_TOKEN = 10;

    // Container struct
    struct Container {
        string tagId;
        string rfid;
        uint256 grams;
        uint256 tokens;
        uint256 blockNumber;
        bytes32 groupHash;
        bool exists;
    }

    // Group struct
    struct Group {
        bytes32 groupHash;
        string name;
        string description;
        uint256 createdAt;
        bool exists;
    }

    // Mappings
    mapping(string => Container) private containers;
    mapping(bytes32 => Group) private groups;
    mapping(string => string[]) private containerHistory;
    
    // Events with indexed parameters for efficient filtering
    event ContainerCreated(
        string indexed tagId,
        string rfid,
        uint256 grams,
        uint256 tokens,
        uint256 blockNumber,
        bytes32 indexed groupHash,
        uint256 timestamp
    );

    event TokensTransferred(
        string indexed fromTagId,
        string indexed toTagId,
        uint256 tokens,
        uint256 grams,
        uint256 timestamp
    );

    event GroupCreated(
        bytes32 indexed groupHash,
        string name,
        string description,
        uint256 timestamp
    );

    // Custom errors for gas optimization
    error ContainerAlreadyExists();
    error ContainerDoesNotExist();
    error InsufficientTokens();
    error InvalidAmount();
    error GroupAlreadyExists();
    error GroupDoesNotExist();
    error Unauthorized();
    error InvalidOperation();

    /**
     * @dev Constructor sets up admin role
     */
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(GROUP_MANAGER_ROLE, msg.sender);
        
        // Start block number counter at 1
        _blockNumberCounter.increment();
    }

    /**
     * @dev Create a new container
     * @param tagId Unique identifier for the container
     * @param rfid RFID tag of the container
     * @param grams Amount of gold in grams
     * @param groupHash Optional group hash for batch management
     */
    function createContainer(
        string calldata tagId,
        string calldata rfid,
        uint256 grams,
        bytes32 groupHash
    ) external onlyRole(MINTER_ROLE) {
        // Check if container already exists
        if (containers[tagId].exists) {
            revert ContainerAlreadyExists();
        }

        // Check if grams is valid
        if (grams == 0) {
            revert InvalidAmount();
        }

        // Check if group exists if groupHash is provided
        if (groupHash != bytes32(0) && !groups[groupHash].exists) {
            revert GroupDoesNotExist();
        }

        // Calculate tokens (10 grams = 1 token)
        uint256 tokens = grams / GRAMS_PER_TOKEN;

        // Get current block number and increment counter
        uint256 blockNumber = _blockNumberCounter.current();
        _blockNumberCounter.increment();

        // Create container
        containers[tagId] = Container({
            tagId: tagId,
            rfid: rfid,
            grams: grams,
            tokens: tokens,
            blockNumber: blockNumber,
            groupHash: groupHash,
            exists: true
        });

        // Add to container history
        containerHistory[tagId].push(tagId);

        // Emit event
        emit ContainerCreated(
            tagId,
            rfid,
            grams,
            tokens,
            blockNumber,
            groupHash,
            block.timestamp
        );
    }

    /**
     * @dev Transfer tokens from one container to another
     * If toTagId doesn't exist, a new container is created
     * @param fromTagId Source container tag ID
     * @param toTagId Destination container tag ID
     * @param tokenAmount Amount of tokens to transfer
     */
    function transferTokens(
        string calldata fromTagId,
        string calldata toTagId,
        uint256 tokenAmount
    ) external nonReentrant onlyRole(MINTER_ROLE) {
        // Check if source container exists
        if (!containers[fromTagId].exists) {
            revert ContainerDoesNotExist();
        }

        // Check if token amount is valid
        if (tokenAmount == 0) {
            revert InvalidAmount();
        }

        // Check if source container has enough tokens
        if (containers[fromTagId].tokens < tokenAmount) {
            revert InsufficientTokens();
        }

        // Calculate grams to transfer
        uint256 gramsToTransfer = tokenAmount * GRAMS_PER_TOKEN;

        // Update source container
        containers[fromTagId].tokens -= tokenAmount;
        containers[fromTagId].grams -= gramsToTransfer;

        // If destination container exists, update it
        if (containers[toTagId].exists) {
            containers[toTagId].tokens += tokenAmount;
            containers[toTagId].grams += gramsToTransfer;
            
            // Update container history
            containerHistory[toTagId].push(fromTagId);
        } else {
            // Create new container
            uint256 blockNumber = _blockNumberCounter.current();
            _blockNumberCounter.increment();

            containers[toTagId] = Container({
                tagId: toTagId,
                rfid: "",  // New container has no RFID yet
                grams: gramsToTransfer,
                tokens: tokenAmount,
                blockNumber: blockNumber,
                groupHash: bytes32(0),  // No group assigned initially
                exists: true
            });

            // Initialize container history
            containerHistory[toTagId] = [fromTagId];
        }

        // Emit event
        emit TokensTransferred(
            fromTagId,
            toTagId,
            tokenAmount,
            gramsToTransfer,
            block.timestamp
        );
    }

    /**
     * @dev Create a new group for batch management
     * @param groupHash Unique hash for the group
     * @param name Name of the group
     * @param description Description of the group
     */
    function createGroup(
        bytes32 groupHash,
        string calldata name,
        string calldata description
    ) external onlyRole(GROUP_MANAGER_ROLE) {
        // Check if group already exists
        if (groups[groupHash].exists) {
            revert GroupAlreadyExists();
        }

        // Create group
        groups[groupHash] = Group({
            groupHash: groupHash,
            name: name,
            description: description,
            createdAt: block.timestamp,
            exists: true
        });

        // Emit event
        emit GroupCreated(
            groupHash,
            name,
            description,
            block.timestamp
        );
    }

    /**
     * @dev Assign container to a group
     * @param tagId Container tag ID
     * @param groupHash Group hash
     */
    function assignContainerToGroup(
        string calldata tagId,
        bytes32 groupHash
    ) external onlyRole(GROUP_MANAGER_ROLE) {
        // Check if container exists
        if (!containers[tagId].exists) {
            revert ContainerDoesNotExist();
        }

        // Check if group exists
        if (!groups[groupHash].exists) {
            revert GroupDoesNotExist();
        }

        // Update container's group hash
        containers[tagId].groupHash = groupHash;
    }

    /**
     * @dev Get container details
     * @param tagId Container tag ID
     * @return Container details
     */
    function getContainer(string calldata tagId) external view returns (
        string memory,
        string memory,
        uint256,
        uint256,
        uint256,
        bytes32
    ) {
        // Check if container exists
        if (!containers[tagId].exists) {
            revert ContainerDoesNotExist();
        }

        Container memory container = containers[tagId];
        return (
            container.tagId,
            container.rfid,
            container.grams,
            container.tokens,
            container.blockNumber,
            container.groupHash
        );
    }

    /**
     * @dev Get group details
     * @param groupHash Group hash
     * @return Group details
     */
    function getGroup(bytes32 groupHash) external view returns (
        bytes32,
        string memory,
        string memory,
        uint256
    ) {
        // Check if group exists
        if (!groups[groupHash].exists) {
            revert GroupDoesNotExist();
        }

        Group memory group = groups[groupHash];
        return (
            group.groupHash,
            group.name,
            group.description,
            group.createdAt
        );
    }

    /**
     * @dev Get container history
     * @param tagId Container tag ID
     * @return Array of tag IDs representing the container's history
     */
    function getContainerHistory(string calldata tagId) external view returns (string[] memory) {
        // Check if container exists
        if (!containers[tagId].exists) {
            revert ContainerDoesNotExist();
        }

        return containerHistory[tagId];
    }
}
