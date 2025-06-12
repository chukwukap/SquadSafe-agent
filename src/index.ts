/**
 * SquadSafe Agent Entry Point
 *
 * Bootstraps the SquadSafe programmable group vault agent.
 * Security-first, protocol-driven, and ready for integration with XMTP and Base L2.
 *
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { main as startSquadSafeAgent } from "./agents/squadSafeAgent";

// Start the SquadSafe agent
startSquadSafeAgent().catch((err) => {
  // SECURITY: Never log sensitive data
  console.error(
    "Fatal error starting SquadSafe Agent:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
