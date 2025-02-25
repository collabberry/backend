import { injectable } from 'inversify';
import { ethers } from 'ethers';
import { AppDataSource } from '../data-source.js';
import { User, Organization } from '../entities/index.js';

// ABI interface for just the isAdmin function
const ADMIN_ROLE_ABI = [
  {
    inputs: [{internalType: 'address', name: 'account', type: 'address'}],
    name: 'isAdmin',
    outputs: [{internalType: 'bool', name: '', type: 'bool'}],
    stateMutability: 'view',
    type: 'function'
  }
];

@injectable()
export class TeamPointsService {
  private provider: ethers.JsonRpcProvider;
  private userRepository;
  private organizationRepository;

  constructor() {
    // Initialize provider from environment variable
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.userRepository = AppDataSource.getRepository(User);
    this.organizationRepository = AppDataSource.getRepository(Organization);
  }

  /**
   * Check if a wallet address is an admin of the organization's team points contract
   */
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

      // Create a contract instance
      const contract = new ethers.Contract(
        organization.teamPointsContractAddress,
        ADMIN_ROLE_ABI,
        this.provider
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
