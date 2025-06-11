import { Wallet, HDNodeWallet } from "ethers";
import * as fs from "fs";
import * as path from "path";

const KEY_FILE = path.resolve(__dirname, "../.agent_key");

/**
 * Loads an existing private key from environment or disk, or generates a new one securely.
 * Never logs sensitive data. Always returns an ethers.js Wallet-compatible instance.
 *
 * SECURITY: Private keys are never exposed or logged. File permissions are set strictly.
 */
export async function loadOrCreateKeys(): Promise<Wallet | HDNodeWallet> {
  // 1. Try environment variable first
  const envKey = process.env.AGENT_PRIVATE_KEY;
  if (envKey) {
    return new Wallet(envKey);
  }

  // 2. Try loading from disk
  if (fs.existsSync(KEY_FILE)) {
    const fileKey = fs.readFileSync(KEY_FILE, "utf8").trim();
    return new Wallet(fileKey);
  }

  // 3. Generate a new key securely
  const wallet = HDNodeWallet.createRandom();
  // Save to disk with strict permissions
  fs.writeFileSync(KEY_FILE, wallet.privateKey, { mode: 0o600 });
  return wallet;
}
