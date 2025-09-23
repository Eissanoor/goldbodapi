// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying GoldTokenization contract...");

  try {
    // Get the ContractFactory and Signer
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    
    // Log account balance
    const balanceBigInt = await deployer.provider.getBalance(deployer.address);
    const balanceEth = hre.ethers.utils.formatEther(balanceBigInt);
    console.log(`Account balance: ${balanceEth} ETH`);

    // Get the contract factory
    const GoldTokenization = await hre.ethers.getContractFactory("GoldTokenization");
    console.log("Deploying contract...");
    
    // Deploy the contract
    const goldTokenization = await GoldTokenization.deploy();
    console.log("Contract deployment transaction sent!");
    console.log("Transaction hash:", goldTokenization.deployTransaction.hash);
    
    // Wait for the contract to be mined
    console.log("Waiting for contract to be mined...");
    await goldTokenization.deployed();
    
    console.log("GoldTokenization deployed to:", goldTokenization.address);
    
    // Save the contract address and other info to a file
    const deploymentInfo = {
      contractAddress: goldTokenization.address,
      deploymentNetwork: hre.network.name,
      deploymentTime: new Date().toISOString(),
      transactionHash: goldTokenization.deployTransaction.hash,
      deployer: deployer.address
    };
    
    // Create the deployment info file
    fs.writeFileSync(
      path.join(__dirname, "../deployment-info.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("Deployment info saved to deployment-info.json");
    
    // Set the contract address in .env file if it doesn't exist
    try {
      console.log("Updating .env file with contract address...");
      const envPath = path.join(__dirname, "../.env");
      
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Check if CONTRACT_ADDRESS already exists
        if (envContent.includes("CONTRACT_ADDRESS=")) {
          // Replace the existing CONTRACT_ADDRESS
          envContent = envContent.replace(
            /CONTRACT_ADDRESS=.*/,
            `CONTRACT_ADDRESS=${goldTokenization.address}`
          );
        } else {
          // Add CONTRACT_ADDRESS if it doesn't exist
          envContent += `\nCONTRACT_ADDRESS=${goldTokenization.address}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log("Updated .env file with contract address");
      } else {
        console.log(".env file not found, skipping update");
      }
    } catch (error) {
      console.warn("Could not update .env file:", error.message);
    }

    // Verify the contract on Etherscan if not on local network
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("Verifying contract on Etherscan...");
      try {
        await hre.run("verify:verify", {
          address: goldTokenization.address,
          constructorArguments: [],
        });
        console.log("Contract verified on Etherscan!");
      } catch (error) {
        console.error("Error verifying contract:", error);
      }
    }

    return goldTokenization.address;
  } catch (error) {
    console.error("Deployment failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
