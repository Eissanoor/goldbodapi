// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");

async function main() {
  console.log("Deploying GoldTokenization contract...");

  // Get the ContractFactory and Signer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const GoldTokenization = await hre.ethers.getContractFactory("GoldTokenization");
  const goldTokenization = await GoldTokenization.deploy();

  await goldTokenization.deployed();

  console.log("GoldTokenization deployed to:", goldTokenization.address);
  console.log("Transaction hash:", goldTokenization.deployTransaction.hash);

  // Wait for 5 confirmations for Sepolia testnet
  console.log("Waiting for confirmations...");
  await goldTokenization.deployTransaction.wait(5);
  console.log("Confirmed!");

  // Verify the contract on Etherscan if not on local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
