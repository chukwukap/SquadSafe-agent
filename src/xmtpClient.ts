import { Wallet, HDNodeWallet } from "ethers";
import {
  Client as XmtpClient,
  Conversation,
  DecodedMessage,
} from "@xmtp/xmtp-js";

/**
 * Starts the XMTP client and listens for incoming messages.
 * @param wallet - An ethers.js Wallet or HDNodeWallet instance
 *
 * SECURITY: Never log private keys or sensitive data. Only log non-sensitive info.
 */
export async function startXMTPClient(
  wallet: Wallet | HDNodeWallet
): Promise<void> {
  // Initialize XMTP client
  const xmtp = await XmtpClient.create(wallet);
  console.log("🔗 Connected to XMTP as:", await wallet.getAddress());

  // Listen for new messages in all conversations
  for await (const convo of await xmtp.conversations.list()) {
    void handleConversation(convo);
  }

  // Optionally, listen for new conversations (future enhancement)
}

/**
 * Handles incoming messages for a given conversation.
 * @param convo - XMTP Conversation
 */
async function handleConversation(convo: Conversation) {
  for await (const msg of await convo.streamMessages()) {
    await handleMessage(msg, convo);
  }
}

/**
 * Handles a single incoming XMTP message.
 * @param msg - DecodedMessage
 * @param convo - Conversation
 */
async function handleMessage(msg: DecodedMessage, convo: Conversation) {
  // TODO: Parse and handle commands securely
  console.log(`📩 New message from ${msg.senderAddress}:`, msg.content);
  // SECURITY: Validate and sanitize all inputs before processing
}
