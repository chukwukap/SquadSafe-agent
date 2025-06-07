/**
 * SquadSafe Agent Message Type
 * Defines the structure of messages handled by the agent (proposals, votes, execution, etc.).
 * (c) SquadSafe, 2025. All rights reserved.
 */

export type MessageType = "proposal" | "vote" | "execution" | "info";

export interface SquadSafeMessage {
  type: MessageType;
  sender: string;
  content: string;
  proposalId?: string;
  vote?: boolean;
  timestamp: number;
}
