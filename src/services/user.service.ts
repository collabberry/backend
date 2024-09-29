import { v4 as uuidv4 } from 'uuid';
import WalletNonce from '../data/models/nonces.model.js';
import User from '../data/models/user.model.js';
import jwt from 'jsonwebtoken';

import Joi from 'joi';
import Invitation from '../data/models/orgInvitation.model.js';
import Organization from '../data/models/organization.model.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { CreateUserModel } from '../models/userRegistration.model.js';
import { injectable } from 'inversify';
import { CreatedResponseModel } from '../response_models/created_response_model.js';
import { ResponseModel } from '../response_models/response_model.js';
import { IUser } from '../data/models/user.model.js';
import { SiweMessage } from 'siwe';
dotenv.config();  // Load the environment variables from .env

const walletAddressSchema = Joi.object({
    walletAddress: Joi.string()
        .pattern(/^0x[a-fA-F0-9]{40}$/)
        .required()
});

@injectable()
export class UserService {
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
        console.log(userData.invitationToken);

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
        const existingUser = await User.findOne({ username: userData.username });
        if (existingUser) {
            return ResponseModel.createError(new Error('Username already exists'), 400);
        }

        // Create a new user linked to the organization from the invitation
        const user = new User({
            ...userData,
            address: userData.walletAddress?.toLowerCase(),
            organization: org
        });

        await user.save();

        return ResponseModel.createSuccess({ id: user._id });
    }

    public async getByWalletAddress(walletAddress: string): Promise<ResponseModel<IUser | null>> {
        const user = await
            User.findOne({ address: walletAddress.toLowerCase() });
        if (!user) {
            return ResponseModel.createError(new Error('User not found'), 404);
        }
        return ResponseModel.createSuccess(user);
    }

    /**
     * Generate a unique invitation link for the organization
     * @param adminId - ID of the admin inviting the user
     * @param organizationId - ID of the organization
     * @returns a unique invitation link
     */
    public async generateInvitationLink(
        adminId: string,
        organizationId: string
    ): Promise<string> {
        // Ensure the organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            throw new Error('Organization not found.');
        }

        // Ensure the admin belongs to the organization
        const adminUser = await User.findById(adminId);
        if (!adminUser || !adminUser.organizationDetails?.find(x => x.organization === organization._id)) {
            throw new Error(
                'Only organization admins can generate invitation links.'
            );
        }

        // Generate a unique token for the invitation
        const token = uuidv4();

        // Store the invitation with a default usage limit of 10
        const invitation = new Invitation({
            token,
            organization: organization._id,
            invitedBy: adminUser._id,
            usageLimit: 10 // Set a default usage limit (can be configurable)
        });
        await invitation.save();

        // Return the invitation link (frontend URL structure can be customized)
        const invitationLink = `${process.env.APP_URL}/register?token=${token}`;
        return invitationLink;
    }

    /**
     * Generates a nonce for wallet authentication and saves it linked to the user
     * @param walletAddress string - Wallet address provided by the client
     * @returns the generated nonce
     */
    public async requestNonce(walletAddress: string): Promise<ResponseModel<any | null>> {
        // Validate the wallet address
        const { error } = walletAddressSchema.validate({ walletAddress });
        if (error) {
            return ResponseModel.createError(new Error('Invalid wallet address'), 400);
        }

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
            console.log(res);
            const token = jwt.sign({ walletAddress: message.address }, process.env.JWT_SECRET!, { expiresIn: '1h' });
            return ResponseModel.createSuccess({ token }, 200);
        } catch {
            return ResponseModel.createError(new Error('Invalid signature'), 401);
        }
    }
}
