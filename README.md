# Gold Tokenization Platform

A blockchain-based system to tokenize physical gold holdings. Each physical gold container is represented on the blockchain with a tokenization rule of 10 grams of gold = 1 digital token.

## Tech Stack

- **Backend**: Node.js with Express.js
- **Blockchain**: Solidity Smart Contracts (using Hardhat framework)
- **Database**: SQL Server via Prisma ORM
- **Web3 Library**: Web3.js for blockchain interaction

## Features

- Create and manage gold containers with unique tag IDs
- Transfer tokens between containers with full transaction history
- Group containers for batch management
- Dual-write strategy: blockchain for immutability, SQL database for efficient querying
- Real-time blockchain event listening and database synchronization

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- SQL Server instance
- Ethereum wallet with some test ETH (for Sepolia testnet)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd gold-tokenization
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   - Set your SQL Server connection string
   - Add your Ethereum private key (NEVER commit this to version control)
   - Set your Infura API key and Sepolia URL

5. Set up the database:
   ```
   npm run db:push
   ```

6. Compile the smart contract:
   ```
   npm run compile
   ```

7. Deploy the smart contract:
   - For local development:
     ```
     npm run deploy:local
     ```
   - For Sepolia testnet:
     ```
     npm run deploy:sepolia
     ```

8. Update the `.env` file with the deployed contract address.

### Running the Application

Start the server:
```
npm start
```

For development with auto-reload:
```
npm run dev
```

## API Endpoints

### Containers

- `POST /api/containers` - Create a new container
- `GET /api/containers/:tagId` - Get container details
- `GET /api/containers/:tagId/history` - Get container history

### Transactions

- `POST /api/transactions/transfer` - Transfer tokens between containers
- `GET /api/transactions` - List all transactions with pagination

### Groups

- `POST /api/groups` - Create a container group
- `GET /api/groups/:groupHash` - Get all containers in a specific group

## Smart Contract

The `GoldTokenization.sol` contract implements:

- Container creation and management
- Token transfers with fractional ownership
- Container grouping for batch management
- Role-based access control
- Optimized for gas efficiency

## Security Considerations

- Private keys are managed securely via environment variables
- Role-based access control for contract operations
- Checks-effects-interactions pattern to prevent reentrancy
- NoAction referential integrity for database relations

## License

[MIT](LICENSE)
