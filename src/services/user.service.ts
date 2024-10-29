import { v4 as uuidv4 } from 'uuid';
import WalletNonce from '../entities/users/nonce.model.js';
import User from '../entities/users/user.model.js';
import jwt from 'jsonwebtoken';
import Invitation from '../entities/org/orgInvitation.model.js';
import dotenv from 'dotenv';
import { CreateUserModel } from '../models/user/userRegistration.model.js';
import { injectable } from 'inversify';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { SiweMessage } from 'siwe';
import { UserResponseModel } from '../models/user/userDetails.model.js';
import { EmailService } from './email.service.js';
import { Role } from '../entities/index.js';

dotenv.config();  // Load the environment variables from .env


@injectable()
export class UserService {

    constructor(private emailServce: EmailService) { }
    /**
     * Register a new user using the invitation token
     * @param token - Invitation token
     * @param userData - User's registration data
     * @returns the registered user
     */
    public async registerUser(
        userData: CreateUserModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {

        let org = null;

        const existingUser = await User.findOne({ address: userData.walletAddress?.toLowerCase() });
        if (existingUser) {
            return ResponseModel.createError(new Error('User already registered'), 400);
        }

        if (userData.invitationToken) {
            // Find the invitation using the token
            const invitation = await Invitation.findOne({ token: userData.invitationToken, isActive: true });
            if (!invitation) {
                return ResponseModel.createError(new Error('Invalid or expired invitation token.'), 400);
            }

            // Check if the usage count has reached the usage limit
            if (invitation.usageCount >= invitation.usageLimit) {
                return ResponseModel.createError(
                    new Error('This invitation link has already been used by the maximum number of users.'),
                    400
                );
            }

            // Increment the usage count
            invitation.usageCount += 1;

            // Mark the invitation as accepted if the usage limit is reached
            if (invitation.usageCount >= invitation.usageLimit) {
                invitation.isActive = false;
            }

            await invitation.save();

            org = invitation.organization;
        }

        // Check if the user already exists (username uniqueness)
        const existingUserName = await User.findOne({ username: userData.username });
        if (existingUserName) {
            return ResponseModel.createError(new Error('Username already exists'), 400);
        }

        const userByEmail = await User.findOne({ email: userData.email });
        if (userByEmail) {
            return ResponseModel.createError(new Error('Email already registered'), 400);
        }

        // Create a new user linked to the organization from the invitation
        const user = new User({
            ...userData,
            address: userData.walletAddress?.toLowerCase()
        });

        if (org) {
            user.contribution = {
                organization: org!,
                roles: [Role.Contributor],
                agreement: undefined
            };
        }
        await user.save();

        this.emailServce.sendCongratsOnRegistration(user.email, user.username);

        return ResponseModel.createSuccess({ id: user._id });
    }

    public async getByWalletAddress(walletAddress: string): Promise<ResponseModel<UserResponseModel | null>> {
        const user = await
            User.findOne({ address: walletAddress.toLowerCase() })
                .populate({
                    path: 'contribution.organization',
                    model: 'Organization'
                })
                .populate({
                    path: 'contribution.agreement',
                    model: 'Agreement'
                });
        if (!user) {
            return ResponseModel.createError(new Error('User not found'), 404);
        }

        const responseModel = {
            id: user._id,
            walletAddress: user.address,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            organization: user.contribution?.organization && {
                name: (user.contribution?.organization as any).name,
                id: (user.contribution?.organization as any)._id,
                roles: user.contribution?.roles,
                agreement: {
                    marketRate: (user.contribution?.agreement as any)?.marketRate,
                    roleName: (user.contribution?.agreement as any)?.roleName,
                    responsibilities: (user.contribution?.agreement as any)?.responsibilities,
                    fiatRequested: (user.contribution?.agreement as any)?.fiatRequested,
                    commitment: (user.contribution?.agreement as any)?.commitment
                }
            }
        };
        return ResponseModel.createSuccess(responseModel);
    }

    /**
     * Generates a nonce for wallet authentication and saves it linked to the user
     * @param walletAddress string - Wallet address provided by the client
     * @returns the generated nonce
     */
    public async requestNonce(walletAddress: string): Promise<ResponseModel<any | null>> {

        // Generate a unique nonce
        const nonce = uuidv4();

        // Update or create the nonce associated with the wallet address
        let walletNonce = await WalletNonce.findOne({ address: walletAddress });

        if (walletNonce) {
            walletNonce.nonce = nonce;
            walletNonce.createdAt = new Date(); // Reset the creation time
            await walletNonce.save();
        } else {
            walletNonce = new WalletNonce({
                address: walletAddress,
                nonce
            });
            await walletNonce.save();
        }

        // Return the generated nonce
        return ResponseModel.createSuccess({ nonce });
    }

    public async verifySignature(message: any, signature: string): Promise<ResponseModel<any | null>> {

        const siweMessage = new SiweMessage(message);
        try {
            const res = await siweMessage.verify({ signature });
            if (!res) {
                return ResponseModel.createError(new Error('Invalid signature'), 401);
            }

            const userToEncode = { walletAddress: message.address } as any;
            const token = jwt.sign(userToEncode, process.env.JWT_SECRET!, { expiresIn: '168h' });
            return ResponseModel.createSuccess({ token }, 200);
        } catch (error: any) {
            return ResponseModel.createError(error, 401);
        }
    }
}
