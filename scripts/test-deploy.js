// Simple script to test contract deployment
const hre = require("hardhat");

async function main() {
  try {
    console.log("Starting test deployment...");
    
    // Get the signer
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Deploy the contract
    const GoldTokenization = await hre.ethers.getContractFactory("GoldTokenization");
    console.log("Contract factory created, deploying...");
    
    const contract = await GoldTokenization.deploy();
    console.log("Deployment transaction sent!");
    
    console.log("Waiting for deployment...");
    await contract.deployed();
    
    console.log("Contract deployed successfully to:", contract.address);
    console.log("Transaction hash:", contract.deployTransaction.hash);
    
  } catch (error) {
    console.error("Deployment failed with error:");
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
