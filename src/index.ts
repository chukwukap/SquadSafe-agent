/**
 * SquadSafe Agent - Main Entrypoint
 *
 * Main programmable group vault agent for SquadSafe.
 * Handles XMTP messaging, contract interactions, and secure group finance flows.
 * (c) SquadSafe, 2025. All rights reserved.
 *
 * SECURITY: All sensitive data is handled securely. Never log private keys or secrets.
 */

import * as fs from "fs";
import {
  AgentKit,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  CdpWalletProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";

import { getLangChainTools } from "@coinbase/agentkit-langchain";

import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./utils/client";

import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";

import { SquadSafeMessage, MessageType } from "./types/message";
import { squadSafeActionProvider } from "./agentkit/squadSafeActionProvider";

// =========================
// Environment & Constants
// =========================
const {
  WALLET_PRIVATE_KEY,
  ENCRYPTION_KEY,
  XMTP_ENV,
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
  NETWORK_ID,
  SQUADSAFE_VAULT_ADDRESS, // Add this to your .env for contract address
} = validateEnvironment([
  "WALLET_PRIVATE_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "NETWORK_ID",
  "SQUADSAFE_VAULT_ADDRESS",
]);

// Storage constants for secure local storage
const XMTP_STORAGE_DIR = ".data/xmtp";
const WALLET_STORAGE_DIR = ".data/wallet";
const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

type Agent = ReturnType<typeof createReactAgent>;

// =========================
// Local Storage Utilities
// =========================
function ensureLocalStorage() {
  if (!fs.existsSync(XMTP_STORAGE_DIR)) {
    fs.mkdirSync(XMTP_STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(WALLET_STORAGE_DIR)) {
    fs.mkdirSync(WALLET_STORAGE_DIR, { recursive: true });
  }
}
function saveWalletData(userId: string, walletData: string) {
  const localFilePath = `${WALLET_STORAGE_DIR}/${userId}.json`;
  try {
    if (!fs.existsSync(localFilePath)) {
      fs.writeFileSync(localFilePath, walletData);
    }
  } catch (error) {
    console.error(`Failed to save wallet data to file: ${error as string}`);
  }
}
function getWalletData(userId: string): string | null {
  const localFilePath = `${WALLET_STORAGE_DIR}/${userId}.json`;
  try {
    if (fs.existsSync(localFilePath)) {
      return fs.readFileSync(localFilePath, "utf8");
    }
  } catch (error) {
    console.warn(`Could not read wallet data from file: ${error as string}`);
  }
  return null;
}

// =========================
// XMTP & Agent Initialization
// =========================
async function initializeXmtpClient() {
  const signer = createSigner(WALLET_PRIVATE_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: XMTP_STORAGE_DIR + `/${XMTP_ENV}-${address}`,
  });
  void logAgentDetails(client);

  // Sync conversations to update local database
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();
  return client;
}

/**
 * Initialize the agent with Coinbase Developer Platform AgentKit.
 * @param userId - Unique user identifier
 * @returns The initialized agent and its configuration
 */
async function initializeAgent(
  userId: string
): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    const llm = new ChatOpenAI({
      model: "gpt-4.1-mini",
    });

    const storedWalletData = getWalletData(userId);
    console.log(
      `Wallet data for ${userId}: ${storedWalletData ? "Found" : "Not found"}`
    );

    const config = {
      apiKeyId: CDP_API_KEY_ID,
      apiKeyPrivateKey: CDP_API_KEY_SECRET.replace(/\\n/g, "\n"),
      cdpWalletData: storedWalletData || undefined,
      networkId: NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        squadSafeActionProvider({
          contractAddress: SQUADSAFE_VAULT_ADDRESS,
          signer,
        }),
        cdpApiActionProvider({
          apiKeyId: CDP_API_KEY_ID,
          apiKeySecret: CDP_API_KEY_SECRET.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyId: CDP_API_KEY_ID,
          apiKeySecret: CDP_API_KEY_SECRET.replace(/\\n/g, "\n"),
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    memoryStore[userId] = new MemorySaver();

    const agentConfig: AgentConfig = {
      configurable: { thread_id: userId },
    };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[userId],
      messageModifier: `
        You are SquadSafe, an onchain group vault and programmable social finance agent for squads, DAOs, and communities.
        Your mission is to help groups securely manage shared funds, coordinate proposals, and execute collective decisions onchain.

        Core Capabilities:
        1. Create and manage group vaults for secure, multi-signature fund storage on Base L2.
        2. Facilitate proposals (e.g., payments, investments, withdrawals) and coordinate group voting.
        3. Execute approved actions onchain, ensuring transparency and security for all members.
        4. Provide real-time updates, analytics, and AI-powered suggestions to help groups operate efficiently.
        5. All interactions are conducted via secure, private XMTP messaging.

        How to interact:
        - Users can ask you to create a new vault, propose a transaction, vote on proposals, check vault balances, or execute approved actions.
        - Always verify the user's group membership and permissions before taking any action.
        - For sensitive actions (e.g., fund transfers), require group consensus according to the vault's rules.
        - If a user requests something outside your scope (e.g., non-financial tasks), politely explain your specialization.

        Security & Best Practices:
        - Never share private keys or sensitive data.
        - Always confirm actions with users and log all onchain transactions for transparency.
        - Default network is Base L2. All vault operations use USDC (token address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e).

        Be concise, helpful, and security-focused in all your interactions. You are the trusted group finance agent for the onchain era.
      `,
    });

    agentStore[userId] = agent;

    // Export and persist wallet data securely
    const exportedWallet = await walletProvider.exportWallet();
    const walletDataJson = JSON.stringify(exportedWallet);
    saveWalletData(userId, walletDataJson);

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

// =========================
// Message Handling Logic
// =========================
async function handleSquadSafeMessage(
  msg: SquadSafeMessage,
  convo: Conversation,
  client: Client
) {
  switch (msg.type) {
    case "proposal":
      await handleProposal(msg, convo, client);
      break;
    case "vote":
      await handleVote(msg, convo, client);
      break;
    case "execution":
      await handleExecution(msg, convo, client);
      break;
    case "info":
    default:
      await convo.send(
        "Unrecognized or info message. Please use a valid SquadSafe command."
      );
  }
}

async function handleProposal(
  msg: SquadSafeMessage,
  convo: Conversation,
  client: Client
) {
  // TODO: Implement proposal creation logic, validate sender, store proposal, notify group
  await convo.send(`Proposal received: ${msg.content}`);
}
async function handleVote(
  msg: SquadSafeMessage,
  convo: Conversation,
  client: Client
) {
  // TODO: Implement voting logic, validate sender, update proposal state, notify group
  await convo.send(
    `Vote received: ${msg.vote ? "Yes" : "No"} for proposal ${msg.proposalId}`
  );
}
async function handleExecution(
  msg: SquadSafeMessage,
  convo: Conversation,
  client: Client
) {
  // TODO: Implement execution logic, interact with contract, confirm onchain action
  await convo.send(`Execution request received for proposal ${msg.proposalId}`);
}

// =========================
// XMTP Message Listener
// =========================
async function handleMessage(message: DecodedMessage, client: Client) {
  let conversation: Conversation | null = null;
  try {
    const senderInboxId = message.senderInboxId;
    const botInboxId = client.inboxId.toLowerCase();
    if (senderInboxId.toLowerCase() === botInboxId) return; // Ignore self
    conversation = (await client.conversations.getConversationById(
      message.conversationId
    )) as Conversation | null;
    if (!conversation)
      throw new Error(
        `Could not find conversation for ID: ${message.conversationId}`
      );
    // Parse and validate SquadSafeMessage
    let squadMsg: SquadSafeMessage;
    try {
      squadMsg = JSON.parse(String(message.content));
    } catch {
      await conversation.send(
        "Invalid message format. Please send a valid SquadSafe command."
      );
      return;
    }
    await handleSquadSafeMessage(squadMsg, conversation, client);
  } catch (error) {
    console.error("Error handling message:", error);
    if (conversation) {
      await conversation.send(
        "I encountered an error while processing your request. Please try again later."
      );
    }
  }
}

async function startMessageListener(client: Client) {
  console.log("Starting message listener...");
  const stream = await client.conversations.streamAllMessages();
  for await (const message of stream) {
    if (message) {
      await handleMessage(message, client);
    }
  }
}

// =========================
// Main Entrypoint
// =========================
export async function main(): Promise<void> {
  console.log("Initializing SquadSafe Agent on XMTP...");
  ensureLocalStorage();
  const xmtpClient = await initializeXmtpClient();
  await startMessageListener(xmtpClient);
}

// If run directly, start the agent
if (require.main === module) {
  main().catch((err) => {
    console.error(
      "Fatal error starting SquadSafe Agent:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  });
}
