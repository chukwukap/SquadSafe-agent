/**
 * SquadSafeAgent
 *
 * Main programmable group vault agent for SquadSafe.
 * Handles XMTP messaging, contract interactions, and secure group finance flows.
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { Client as XmtpClient, type ClientOptions } from "@xmtp/node-sdk";
import { AgentKit } from "@coinbase/agentkit";
import { ethers } from "ethers";
import { squadSafeVaultAbi } from "../utils/squadSafeVaultAbi";
import * as dotenv from "dotenv";

dotenv.config();

export class SquadSafeAgent {
  private xmtpClient?: XmtpClient;
  private agentKit?: AgentKit;
  private wallet?: any; // AgentKit wallet (ethers-compatible)
  private vaultContract?: ethers.Contract;

  constructor() {
    // Securely load keys from environment
    const cdpApiKey = process.env.CDP_API_KEY_NAME;
    const cdpApiSecret = process.env.CDP_API_KEY_PRIVATE_KEY;
    const network = process.env.NETWORK_ID || "base-sepolia";
    const xmtpEnv = process.env.XMTP_ENV || "dev";
    const vaultAddress = process.env.SQUADSAFE_VAULT_ADDRESS;
    if (!cdpApiKey || !cdpApiSecret) {
      throw new Error(
        "CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY must be set in environment"
      );
    }
    if (!vaultAddress) {
      throw new Error("SQUADSAFE_VAULT_ADDRESS must be set in environment");
    }
    // Initialize AgentKit
    this.agentKit = new AgentKit({
      cdpApiKey,
      cdpApiSecret,
      network,
    });
    this.wallet = this.agentKit.getWallet();
    this.vaultContract = this.getVaultContract(vaultAddress);
    this.initXmtp(xmtpEnv).catch((err) => {
      console.error("Failed to initialize XMTP:", err);
      process.exit(1);
    });
  }

  /**
   * Connect to the SquadSafeVault contract using the AgentKit wallet
   */
  private getVaultContract(address: string): ethers.Contract {
    if (!this.wallet) throw new Error("AgentKit wallet not initialized");
    return new ethers.Contract(address, squadSafeVaultAbi, this.wallet);
  }

  private async initXmtp(env: string) {
    if (!this.wallet) throw new Error("AgentKit wallet not initialized");
    // Initialize XMTP client with AgentKit wallet
    this.xmtpClient = await XmtpClient.create(this.wallet, {
      env,
    } as ClientOptions);
    console.log(
      "[SquadSafeAgent] XMTP client initialized for address:",
      await this.wallet.getAddress()
    );
  }

  async start() {
    // TODO: Main event loop: listen for messages, handle proposals, votes, and contract calls
    console.log(
      "[SquadSafeAgent] Agent started. Ready to process group vault actions."
    );
    // Example: Log contract owner
    if (this.vaultContract) {
      const owner = await this.vaultContract.owner();
      console.log(
        "[SquadSafeAgent] Connected to SquadSafeVault. Owner:",
        owner
      );
    }
  }
}

// For CLI/demo usage, you might instantiate and start the agent here
// (Uncomment and implement as needed)
// const agent = new SquadSafeAgent();
// agent.start();
