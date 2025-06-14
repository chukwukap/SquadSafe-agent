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
import { squadSafeActionProvider } from "./squadSafeActionProvider";

import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";

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
        squadSafeActionProvider(),
        erc20ActionProvider(),
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

/**
 * Process a message with the agent and return the response.
 * @param agent - The agent instance
 * @param config - The agent configuration
 * @param message - The message to process
 * @returns The processed response as a string
 */
async function processMessage(
  agent: Agent,
  config: AgentConfig,
  message: string
): Promise<string> {
  let response = "";

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config
    );

    for await (const chunk of stream) {
      if (chunk && typeof chunk === "object" && "agent" in chunk) {
        const agentChunk = chunk as {
          agent: { messages: Array<{ content: unknown }> };
        };
        response += String(agentChunk.agent.messages[0].content) + "\n";
      }
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
}

/**
 * Handle incoming XMTP messages and respond using the agent.
 * @param message - The decoded XMTP message
 * @param client - The XMTP client instance
 */
async function handleMessage(message: DecodedMessage, client: Client) {
  let conversation: Conversation | null = null;
  try {
    const senderAddress = message.senderInboxId;
    const botAddress = client.inboxId.toLowerCase();

    // Ignore messages from the bot itself
    if (senderAddress.toLowerCase() === botAddress) {
      return;
    }

    console.log(
      `Received message from ${senderAddress}: ${message.content as string}`
    );

    const { agent, config } = await initializeAgent(senderAddress);
    const response = await processMessage(
      agent,
      config,
      String(message.content)
    );

    // Get the conversation and send response
    conversation = (await client.conversations.getConversationById(
      message.conversationId
    )) as Conversation | null;
    if (!conversation) {
      throw new Error(
        `Could not find conversation for ID: ${message.conversationId}`
      );
    }
    await conversation.send(response);
    console.debug(`Sent response to ${senderAddress}: ${response}`);
  } catch (error) {
    console.error("Error handling message:", error);
    if (conversation) {
      await conversation.send(
        "I encountered an error while processing your request. Please try again later."
      );
    }
  }
}

/**
 * Start listening for XMTP messages and handle them as they arrive.
 * @param client - The XMTP client instance
 */
async function startMessageListener(client: Client) {
  console.log("Starting message listener...");
  const stream = await client.conversations.streamAllMessages();
  for await (const message of stream) {
    if (message) {
      await handleMessage(message, client);
    }
  }
}

/**
 * Main function to start the SquadSafe agent chatbot.
 */
async function main(): Promise<void> {
  console.log("Initializing SquadSafe Agent on XMTP...");

  ensureLocalStorage();

  const xmtpClient = await initializeXmtpClient();
  await startMessageListener(xmtpClient);
}
// Start the SquadSafe agent chatbot
main().catch(console.error);
