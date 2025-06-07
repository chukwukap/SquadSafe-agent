/**
 * Contract Utility for SquadSafeVault
 * Provides a helper to connect to the SquadSafeVault contract securely.
 * (c) SquadSafe, 2025. All rights reserved.
 */

import { ethers } from "ethers";
import { squadSafeVaultAbi } from "./squadSafeVaultAbi";

/**
 * Connect to the SquadSafeVault contract
 * @param address - Deployed contract address
 * @param provider - ethers.js provider or signer
 */
export function getSquadSafeVaultContract(
  address: string,
  provider: ethers.Signer | ethers.Provider
) {
  return new ethers.Contract(address, squadSafeVaultAbi, provider);
}
