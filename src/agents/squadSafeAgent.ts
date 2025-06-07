/**
 * SquadSafeAgent
 *
 * Main programmable group vault agent for SquadSafe.
 * Handles XMTP messaging, contract interactions, and secure group finance flows.
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { Client as XmtpClient, type ClientOptions } from "@xmtp/xmtp-js";
import { Wallet } from "ethers";
// import { AgentKit } from 'agentkit'; // To be integrated
// import { getSquadSafeVaultContract } from '../utils/contract';
import * as dotenv from "dotenv";

dotenv.config();

export class SquadSafeAgent {
  private xmtpClient?: XmtpClient;
  private wallet?: Wallet;

  constructor() {
    // Securely load keys from environment
    const walletKey = process.env.WALLET_KEY;
    const xmtpEnv = process.env.XMTP_ENV || "dev";
    if (!walletKey) {
      throw new Error("WALLET_KEY is not set in environment");
    }
    this.wallet = new Wallet(walletKey);
    this.initXmtp(xmtpEnv).catch((err) => {
      console.error("Failed to initialize XMTP:", err);
      process.exit(1);
    });
  }

  private async initXmtp(env: string) {
    if (!this.wallet) throw new Error("Wallet not initialized");
    // Initialize XMTP client
    this.xmtpClient = await XmtpClient.create(this.wallet, {
      env,
    } as ClientOptions);
    console.log(
      "[SquadSafeAgent] XMTP client initialized for address:",
      this.wallet.address
    );
  }

  async start() {
    // TODO: Main event loop: listen for messages, handle proposals, votes, and contract calls
    console.log(
      "[SquadSafeAgent] Agent started. Ready to process group vault actions."
    );
  }
}

// For CLI/demo usage, you might instantiate and start the agent here
// (Uncomment and implement as needed)
// const agent = new SquadSafeAgent();
// agent.start();
