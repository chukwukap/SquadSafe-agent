/**
 * SquadSafe Agent Entry Point
 *
 * This file bootstraps the SquadSafe programmable group vault agent.
 * Security-first, protocol-driven, and ready for integration with XMTP and Base L2.
 *
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { loadOrCreateKeys } from "./keyManager";
import { startXMTPClient } from "./xmtpClient";

/**
 * Main entrypoint for the SquadSafe agent.
 * - Loads/generates secure keys
 * - Connects to XMTP
 * - Starts the agent event loop
 *
 * SECURITY: Never log private keys or sensitive data. All errors are logged securely.
 */
(async () => {
  try {
    // Load or create agent keys securely
    const wallet = await loadOrCreateKeys();

    // Start the XMTP client and agent loop
    await startXMTPClient(wallet);

    // Agent is now running
    console.log("✅ SquadSafe agent is running and listening for messages.");
  } catch (error) {
    // Log errors securely, never expose sensitive info
    console.error(
      "❌ Agent failed to start:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
})();
