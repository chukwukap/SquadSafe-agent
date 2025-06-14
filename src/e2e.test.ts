import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { squadSafeVaultAbi } from "./utils/squadSafeVaultAbi";
import { getEventSelector } from "viem/utils";
import dotenv from "dotenv";
dotenv.config();

// --- CONFIG ---
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const VAULT_ADDRESS = (
  process.env.SQUADSAFE_VAULT_ADDRESS || ""
).toLowerCase() as `0x${string}`;

const OWNER_KEY = (process.env.PRIVATE_KEY ||
  "0x59c6995e998f97a5a004497e5daefef1744b7fa5e5c54f89b6b7c3c0cfb1b5c9") as `0x${string}`; // Anvil default
console.log("OWNER_KEY:", OWNER_KEY);
const MEMBER1_KEY = (process.env.MEMBER1_KEY ||
  "0x8b3a350cf5c34c9194ca3a545d8c2a0a6a548820") as `0x${string}`; // Anvil default 2nd
console.log("MEMBER1_KEY:", MEMBER1_KEY);
if (!VAULT_ADDRESS)
  throw new Error("SQUADSAFE_VAULT_ADDRESS must be set in .env");

// --- SETUP ---
const publicClient = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
});
const owner = privateKeyToAccount(OWNER_KEY);
const member1 = privateKeyToAccount(MEMBER1_KEY);
const ownerClient = createWalletClient({
  account: owner,
  chain: foundry,
  transport: http(RPC_URL),
});
const member1Client = createWalletClient({
  account: member1,
  chain: foundry,
  transport: http(RPC_URL),
});

async function main() {
  console.log("\n--- SquadSafe E2E Test (viem) ---\n");
  console.log("Vault address:", VAULT_ADDRESS);
  console.log("Owner:", owner.address);
  console.log("Member1:", member1.address);

  // 1. Add a member
  console.log("Adding member:", member1.address);
  let hash = (await ownerClient.writeContract({
    address: VAULT_ADDRESS,
    abi: squadSafeVaultAbi,
    functionName: "addMember",
    args: [member1.address as `0x${string}`],
  })) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Member added.");

  // 2. Propose a payment (ETH)
  console.log("Proposing payment of 0.1 ETH to member1:", member1.address);
  hash = (await ownerClient.writeContract({
    address: VAULT_ADDRESS,
    abi: squadSafeVaultAbi,
    functionName: "propose",
    args: [
      zeroAddress,
      parseEther("0.1"),
      member1.address as `0x${string}`,
      "Test E2E payment",
    ],
  })) as `0x${string}`;
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // Find ProposalCreated event log
  const proposalCreatedTopic = getEventSelector(
    "ProposalCreated(uint256,address,address,uint256,address,string)"
  );
  const proposalCreatedLog = receipt.logs.find(
    (log) => log.topics[0] === proposalCreatedTopic
  );
  // Ensure proposalId is always a BigInt
  const proposalId =
    proposalCreatedLog && proposalCreatedLog.topics[1]
      ? BigInt(proposalCreatedLog.topics[1] as string)
      : 1n;
  console.log("Proposal created. ID:", proposalId.toString());

  // 3. Vote for the proposal as member1
  console.log("Voting for proposal as member1...");
  hash = (await member1Client.writeContract({
    address: VAULT_ADDRESS,
    abi: squadSafeVaultAbi,
    functionName: "vote",
    args: [proposalId, true],
  })) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Voted.");

  // 4. Fast-forward time and execute proposal
  console.log("Advancing time and executing proposal...");
  await publicClient.transport.request({
    method: "evm_increaseTime",
    params: [2 * 24 * 60 * 60],
  });
  await publicClient.transport.request({ method: "evm_mine", params: [] });
  hash = (await ownerClient.writeContract({
    address: VAULT_ADDRESS,
    abi: squadSafeVaultAbi,
    functionName: "execute",
    args: [proposalId],
  })) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Proposal executed.");

  // 5. Remove member
  console.log("Removing member:", member1.address);
  hash = (await ownerClient.writeContract({
    address: VAULT_ADDRESS,
    abi: squadSafeVaultAbi,
    functionName: "removeMember",
    args: [member1.address as `0x${string}`],
  })) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Member removed.");

  console.log("\n--- E2E Test Complete ---\n");
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
