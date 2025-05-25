import { injectable } from 'inversify';
import { ethers } from 'ethers';
import { AppDataSource } from '../data-source.js';
import { User, Organization } from '../entities/index.js';

// ABI interface for just the isAdmin function
const ADMIN_ROLE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isAdmin',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
];
// Mapping of chain IDs to RPC URLs
const chainIDToRPCUrl: Record<string, string> = {
  42161: process.env.ARBITRUM_RPC_URL || '',
  421614: process.env.ARBITRUM_SEPOLIA_RPC_URL || '',
  42220: process.env.CELO_RPC_URL || ''
};

@injectable()
export class TeamPointsService {
  private userRepository;
  private organizationRepository;

  constructor() {
    // Initialize provider from environment variable
    this.userRepository = AppDataSource.getRepository(User);
    this.organizationRepository = AppDataSource.getRepository(Organization);
  }

  /**
   * Check if a wallet address is an admin of the organization's team points contract
   */
  // TODO: edit to use the chainID to set correctly provider
  public async isAdmin(walletAddress: string): Promise<boolean> {
    try {
      // Get the user from the wallet address
      const user = await this.userRepository.findOne({
        where: { address: walletAddress.toLowerCase() },
        relations: ['organization']
      });

      if (!user || !user.organization) {
        return false;
      }

      // Get the organization's team points contract address
      const organization = await this.organizationRepository.findOne({
        where: { id: user.organization.id }
      });

      if (!organization || !organization.teamPointsContractAddress) {
        return false;
      }

      const provider = new ethers.JsonRpcProvider(
        chainIDToRPCUrl[organization.chainId] || process.env.ARBITRUM_RPC_URL);


      // Create a contract instance
      const contract = new ethers.Contract(
        organization.teamPointsContractAddress,
        ADMIN_ROLE_ABI,
        provider
      );

      // Call the isAdmin function on the contract
      const isAdmin = await contract.isAdmin(walletAddress);
      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
}
