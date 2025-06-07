/**
 * SquadSafe Proposal Type
 * Defines the structure of a proposal for the group vault.
 * (c) SquadSafe, 2025. All rights reserved.
 */

export type ProposalStatus = "pending" | "approved" | "rejected" | "executed";

export interface ProposalAction {
  target: string; // Contract address or recipient
  value: string; // Amount in wei or token units
  data: string; // Encoded function call or message
}

export interface SquadSafeProposal {
  id: string;
  proposer: string;
  description: string;
  actions: ProposalAction[];
  status: ProposalStatus;
  createdAt: number;
  votes: Record<string, boolean>; // voter address => support
}
