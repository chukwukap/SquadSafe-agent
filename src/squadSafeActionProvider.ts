import { z } from "zod";
import {
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { isAddress, parseEther, encodeFunctionData } from "viem";
import { squadSafeVaultAbi } from "./utils/squadSafeVaultAbi"; // Ensure this path is correct and the ABI is exported

/**
 * Zod schemas for SquadSafe actions
 *
 * NOTE: To satisfy the type requirements of AgentKit's CreateAction decorator,
 * we use ZodType<any, any, any> as a cast. However, this can cause
 * "Type instantiation is excessively deep and possibly infinite" errors
 * in some TypeScript versions. To avoid this, we use plain z.object schemas
 * and cast only at the decorator site, not at the schema declaration.
 */
const CreateProposalSchema = z.object({
  description: z.string(),
  amount: z.union([z.string(), z.number()]),
  recipient: z.string(),
});

const VoteOnProposalSchema = z.object({
  proposalId: z.union([z.string(), z.number()]),
  support: z.boolean(),
});

const ExecuteProposalSchema = z.object({
  proposalId: z.union([z.string(), z.number()]),
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
class SquadSafeActionProvider extends ActionProvider<WalletProvider> {
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
    name: "createProposal",
    description: "Create a new proposal in the group vault.",
    // Cast here to avoid deep type instantiation at schema declaration
    schema: CreateProposalSchema as any,
  })
  async createProposal(
    walletProvider: WalletProvider,
    args: z.infer<typeof CreateProposalSchema>
  ): Promise<{ success: boolean; txHash: string }> {
    const { description, amount, recipient } = args;

    // SECURITY: Validate recipient address and amount
    if (!isAddress(recipient)) {
      throw new Error("Invalid recipient address");
    }
    if (Number(amount) <= 0) {
      throw new Error("Amount must be positive");
    }

    // SECURITY: Use BigInt for amount, parse if string
    const parsedAmount =
      typeof amount === "string" ? parseEther(amount) : BigInt(amount);

    // Encode the function call data for the createProposal function
    const data = encodeFunctionData({
      abi: squadSafeVaultAbi,
      functionName: "createProposal",
      args: [description, parsedAmount, recipient],
    });

    // SECURITY: Always check that the WalletProvider supports sendTransaction
    if (typeof (walletProvider as any).sendTransaction !== "function") {
      throw new Error("WalletProvider does not support sendTransaction");
    }

    // Use 0 as value for contract call (no ETH sent)
    // Use Number(0) instead of 0n for compatibility with ES2019 and below
    const txHash = await (walletProvider as any).sendTransaction({
      to: this.contractAddress,
      value: 0,
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
    description: "Vote on an existing proposal.",
    schema: VoteOnProposalSchema as any,
  })
  async voteOnProposal(
    walletProvider: WalletProvider,
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

    if (typeof (walletProvider as any).sendTransaction !== "function") {
      throw new Error("WalletProvider does not support sendTransaction");
    }

    const txHash = await (walletProvider as any).sendTransaction({
      to: this.contractAddress,
      value: 0,
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
    description: "Execute an approved proposal.",
    schema: ExecuteProposalSchema as any,
  })
  async executeProposal(
    walletProvider: WalletProvider,
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

    if (typeof (walletProvider as any).sendTransaction !== "function") {
      throw new Error("WalletProvider does not support sendTransaction");
    }

    const txHash = await (walletProvider as any).sendTransaction({
      to: this.contractAddress,
      value: 0,
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
