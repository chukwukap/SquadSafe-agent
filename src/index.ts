/**
 * SquadSafe Agent Entry Point
 *
 * This file bootstraps the SquadSafe programmable group vault agent.
 * Security-first, protocol-driven, and ready for integration with XMTP and Base L2.
 *
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { SquadSafeAgent } from "./agents/squadSafeAgent";

(async () => {
  try {
    const agent = new SquadSafeAgent();
    await agent.start();
  } catch (error) {
    console.error("Fatal error starting SquadSafeAgent:", error);
    process.exit(1);
  }
})();
