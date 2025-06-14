import { z } from "zod";
import {
  ActionProvider,
  CdpWalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { isAddress, parseEther, encodeFunctionData } from "viem";
import { squadSafeVaultAbi } from "./utils/squadSafeVaultAbi"; // Ensure this path is correct and the ABI is exported

/**
 * Zod schemas for SquadSafe actions
 */
const ProposeSchema = z.object({
  token: z.string(),
  amount: z.union([z.string(), z.number()]),
  to: z.string(),
  reason: z.string(),
});

const VoteOnProposalSchema = z.object({
  proposalId: z.union([z.string(), z.number()]),
  support: z.boolean(),
});

const ExecuteProposalSchema = z.object({
  proposalId: z.union([z.string(), z.number()]),
});

const AddMemberSchema = z.object({
  newMember: z.string(),
});

const RemoveMemberSchema = z.object({
  member: z.string(),
});

const SetMinVotesSchema = z.object({
  minVotes: z.union([z.string(), z.number()]),
});

const SetVotingPeriodSchema = z.object({
  period: z.union([z.string(), z.number()]),
});

/**
 * SquadSafeActionProvider
 *
 * Custom AgentKit action provider for SquadSafeVault group contract.
 * Exposes programmable group vault actions: createProposal, vote, execute.
 *
 * SECURITY: All inputs must be validated. Never expose sensitive data.
 * (c) SquadSafe, 2025. All rights reserved.
 */
class SquadSafeActionProvider extends ActionProvider<CdpWalletProvider> {
  // The contract address should be provided via environment variable or config
  private readonly contractAddress: `0x${string}`;

  constructor() {
    super("squadSafe", []);
    // SECURITY: Always get contract address from a secure source
    if (!process.env.SQUADSAFE_VAULT_ADDRESS) {
      throw new Error("SQUADSAFE_VAULT_ADDRESS environment variable not set");
    }
    this.contractAddress = process.env.SQUADSAFE_VAULT_ADDRESS as `0x${string}`;
  }

  /**
   * Create a new proposal in the group vault.
   * SECURITY: Validates all inputs.
   */
  @CreateAction({
    name: "propose",
    description:
      "Create a new group proposal (e.g., payment, investment, withdrawal). Only group members can propose. Specify token, amount, recipient, and reason. Proposal will require group voting before execution.",
    schema: ProposeSchema,
  })
  async propose(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof ProposeSchema>
  ): Promise<{ success: boolean; txHash: string }> {
    const { token, amount, to, reason } = args;

    // SECURITY: Validate token and recipient address
    if (!isAddress(token)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(to)) {
      throw new Error("Invalid recipient address");
    }

    // SECURITY: Validate amount
    if (Number(amount) <= 0) {
      throw new Error("Amount must be positive");
    }

    // SECURITY: Use BigInt for amount, parse if string
    const parsedAmount =
      typeof amount === "string" ? parseEther(amount) : BigInt(amount);

    // Encode the function call data for the propose function
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "propose",
      args: [token, parsedAmount, to, reason],
    });

    // Use BigInt(0) for value to match TransactionRequest type and avoid BigInt literal for ES2019 compatibility
    const zeroValue = BigInt(0);

    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: zeroValue,
      data,
    });

    return { success: true, txHash };
  }

  /**
   * Vote on an existing proposal.
   * SECURITY: Validates all inputs.
   */
  @CreateAction({
    name: "voteOnProposal",
    description:
      "Vote for or against an active proposal. Only group members can vote. Each member can vote once per proposal. Majority or configured threshold required for execution.",
    schema: VoteOnProposalSchema,
  })
  async voteOnProposal(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof VoteOnProposalSchema>
  ): Promise<{ success: boolean; txHash: string }> {
    const { proposalId, support } = args;

    // SECURITY: Validate proposalId
    if (!proposalId || Number(proposalId) < 0) {
      throw new Error("Invalid proposalId");
    }

    // Encode the function call data for the vote function
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "vote",
      args: [proposalId, support],
    });

    // Use BigInt(0) for value to match TransactionRequest type and avoid BigInt literal for ES2019 compatibility
    const zeroValue = BigInt(0);

    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: zeroValue,
      data,
    });

    return { success: true, txHash };
  }

  /**
   * Execute an approved proposal.
   * SECURITY: Validates all inputs.
   */
  @CreateAction({
    name: "executeProposal",
    description:
      "Execute a proposal that has met the required votes and passed its voting period. Only group members can execute. This will transfer funds or perform the proposed action onchain.",
    schema: ExecuteProposalSchema,
  })
  async executeProposal(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof ExecuteProposalSchema>
  ): Promise<{ success: boolean; txHash: string }> {
    const { proposalId } = args;

    // SECURITY: Validate proposalId
    if (!proposalId || Number(proposalId) < 0) {
      throw new Error("Invalid proposalId");
    }

    // Encode the function call data for the execute function
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "execute",
      args: [proposalId],
    });

    // Use BigInt(0) for value to match TransactionRequest type and avoid BigInt literal for ES2019 compatibility
    const zeroValue = BigInt(0);

    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: zeroValue,
      data,
    });

    return { success: true, txHash };
  }

  @CreateAction({
    name: "addMember",
    description:
      "Add a new member to the group vault. Only the contract owner (admin) can add members. New members can participate in proposals and voting.",
    schema: AddMemberSchema,
  })
  async addMember(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof AddMemberSchema>
  ) {
    const { newMember } = args;
    if (!isAddress(newMember)) throw new Error("Invalid member address");
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "addMember",
      args: [newMember],
    });
    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: BigInt(0),
      data,
    });
    return { success: true, txHash };
  }

  @CreateAction({
    name: "removeMember",
    description:
      "Remove an existing member from the group vault. Only the contract owner (admin) can remove members. Cannot remove the last member.",
    schema: RemoveMemberSchema,
  })
  async removeMember(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof RemoveMemberSchema>
  ) {
    const { member } = args;
    if (!isAddress(member)) throw new Error("Invalid member address");
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "removeMember",
      args: [member],
    });
    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: BigInt(0),
      data,
    });
    return { success: true, txHash };
  }

  @CreateAction({
    name: "setMinVotes",
    description:
      "Set the minimum number of votes required for a proposal to pass. Only the contract owner (admin) can change this. Used for group governance and security.",
    schema: SetMinVotesSchema,
  })
  async setMinVotes(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof SetMinVotesSchema>
  ) {
    const { minVotes } = args;
    if (Number(minVotes) <= 0) throw new Error("minVotes must be positive");
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "setMinVotes",
      args: [minVotes],
    });
    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: BigInt(0),
      data,
    });
    return { success: true, txHash };
  }

  @CreateAction({
    name: "setVotingPeriod",
    description:
      "Set the voting period (in seconds) for proposals. Only the contract owner (admin) can change this. Controls how long members have to vote on proposals.",
    schema: SetVotingPeriodSchema,
  })
  async setVotingPeriod(
    walletProvider: CdpWalletProvider,
    args: z.infer<typeof SetVotingPeriodSchema>
  ) {
    const { period } = args;
    if (Number(period) <= 0) throw new Error("period must be positive");
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "setVotingPeriod",
      args: [period],
    });
    const txHash = await walletProvider.sendTransaction({
      to: this.contractAddress,
      value: BigInt(0),
      data,
    });
    return { success: true, txHash };
  }

  /**
   * Accept all networks for now. Update as needed for network restrictions.
   */
  supportsNetwork = (_network: Network) => true;
}

/**
 * Factory function to instantiate the SquadSafeActionProvider.
 */
export const squadSafeActionProvider = () => new SquadSafeActionProvider();

export default squadSafeActionProvider;
