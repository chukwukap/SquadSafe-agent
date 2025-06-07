/**
 * Secure Key Generator for SquadSafe Agent
 * Generates random WALLET_KEY and ENCRYPTION_KEY for XMTP and wallet use.
 * (c) SquadSafe, 2025. All rights reserved.
 */

import * as crypto from "crypto";

function generateRandomKeys() {
  const walletKey = `0x${crypto.randomBytes(32).toString("hex")}`;
  const encryptionKey = `0x${crypto.randomBytes(32).toString("hex")}`;
  return { walletKey, encryptionKey };
}

const { walletKey, encryptionKey } = generateRandomKeys();
console.log(`WALLET_KEY=${walletKey}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
