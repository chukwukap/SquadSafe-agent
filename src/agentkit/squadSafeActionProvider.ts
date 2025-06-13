import { getSquadSafeVaultContract } from "../utils/contract";
import { ethers } from "ethers";

/**
 * SquadSafeActionProvider
 *
 * Custom AgentKit action provider for SquadSafeVault group contract.
 * Exposes programmable group vault actions: createProposal, vote, execute.
 *
 * SECURITY: All inputs must be validated. Never expose sensitive data.
 * (c) SquadSafe, 2025. All rights reserved.
 */

export function squadSafeActionProvider({
  contractAddress,
  signer,
}: {
  contractAddress: string;
  signer: ethers.Signer;
}) {
  return {
    name: "squadSafe",
    /**
     * Returns the set of actions exposed by this provider.
     */
    getActions: () => ({
      /**
       * Create a new proposal in the group vault.
       * @param description - Proposal description
       * @param amount - Amount in USDC (as string or number)
       * @param recipient - Recipient address
       */
      async createProposal({
        description,
        amount,
        recipient,
      }: {
        description: string;
        amount: string | number;
        recipient: string;
      }) {
        const contract = getSquadSafeVaultContract(contractAddress, signer);
        // SECURITY: Validate recipient address and amount
        if (!ethers.isAddress(recipient))
          throw new Error("Invalid recipient address");
        if (Number(amount) <= 0) throw new Error("Amount must be positive");
        const tx = await contract.createProposal(
          description,
          amount,
          recipient
        );
        await tx.wait();
        return { success: true, txHash: tx.hash };
      },

      /**
       * Vote on an existing proposal.
       * @param proposalId - Proposal ID
       * @param support - true for yes, false for no
       */
      async voteOnProposal({
        proposalId,
        support,
      }: {
        proposalId: string | number;
        support: boolean;
      }) {
        const contract = getSquadSafeVaultContract(contractAddress, signer);
        const tx = await contract.vote(proposalId, support);
        await tx.wait();
        return { success: true, txHash: tx.hash };
      },

      /**
       * Execute an approved proposal.
       * @param proposalId - Proposal ID
       */
      async executeProposal({ proposalId }: { proposalId: string | number }) {
        const contract = getSquadSafeVaultContract(contractAddress, signer);
        const tx = await contract.execute(proposalId);
        await tx.wait();
        return { success: true, txHash: tx.hash };
      },
    }),
    /**
     * Accept all networks for now. Update as needed for network restrictions.
     */
    supportsNetwork: (_network: string) => true,
    /**
     * No nested providers for this custom provider.
     */
    actionProviders: [],
  };
}

export default squadSafeActionProvider;
