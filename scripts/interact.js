// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");

async function main() {
  // Replace with your deployed contract address
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("Please set CONTRACT_ADDRESS in your environment variables");
    process.exit(1);
  }

  console.log("Interacting with GoldTokenization at:", contractAddress);

  // Get the contract instance
  const GoldTokenization = await hre.ethers.getContractFactory("GoldTokenization");
  const goldTokenization = await GoldTokenization.attach(contractAddress);

  // Example: Create a new container
  const tagId = "GOLD-" + Date.now();
  const rfid = "RFID-" + Date.now();
  const grams = 100; // 100 grams = 10 tokens
  const groupHash = ethers.utils.formatBytes32String(""); // Empty group hash

  console.log(`Creating container with tagId: ${tagId}, rfid: ${rfid}, grams: ${grams}`);
  
  const tx = await goldTokenization.createContainer(tagId, rfid, grams, groupHash);
  await tx.wait();
  
  console.log("Container created successfully!");
  console.log("Transaction hash:", tx.hash);

  // Get container details
  const container = await goldTokenization.getContainer(tagId);
  console.log("Container details:");
  console.log("- Tag ID:", container[0]);
  console.log("- RFID:", container[1]);
  console.log("- Grams:", container[2].toString());
  console.log("- Tokens:", container[3].toString());
  console.log("- Block Number:", container[4].toString());
  console.log("- Group Hash:", container[5]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
