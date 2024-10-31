import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { CreateUserModel } from '../models/user/userRegistration.model.js';
import { injectable } from 'inversify';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { SiweMessage } from 'siwe';
import { UserResponseModel } from '../models/user/userDetails.model.js';
import { EmailService } from './email.service.js';
import { AppDataSource } from '../data-source.js';
import { Invitation, Organization, User, WalletNonce } from '../entities/index.js';

dotenv.config();  // Load the environment variables from .env


@injectable()
export class UserService {

    private userRepository;
    private invitationRepository;
    private walletNonceRepository;

    constructor(private emailService: EmailService) {
        this.userRepository = AppDataSource.getRepository(User);
        this.invitationRepository = AppDataSource.getRepository(Invitation);
        this.walletNonceRepository = AppDataSource.getRepository(WalletNonce);
    }
    /**
     * Register a new user using the invitation token
     * @param token - Invitation token
     * @param userData - User's registration data
     * @returns the registered user
     */
    public async registerUser(
        userData: CreateUserModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {

        let organization: Organization | null = null;

        const existingUser = await this.userRepository
            .findOne({ where: { address: userData.walletAddress?.toLowerCase() } });
        if (existingUser) {
            return ResponseModel.createError(new Error('User already registered'), 400);
        }

        if (userData.invitationToken) {
            // Find the invitation using the token
            const invitation = await this.invitationRepository.findOne({
                where: { token: userData.invitationToken, isActive: true },
                relations: ['organization']
            });

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

            // Mark the invitation as inactive if the usage limit is reached
            if (invitation.usageCount >= invitation.usageLimit) {
                invitation.isActive = false;
            }

            await this.invitationRepository.save(invitation);

            organization = invitation.organization;
        }

        const userByEmail = await this.userRepository.findOne({ where: { email: userData.email } });
        if (userByEmail) {
            return ResponseModel.createError(new Error('Email already registered'), 400);
        }

        const user = new User();
        user.address = userData.walletAddress!.toLowerCase();
        user.username = userData.username;
        user.email = userData.email;
        user.profilePicture = userData.profilePicture;
        user.isAdmin = false;

        if (organization) {
            user.organization = organization;
        }

        await this.userRepository.save(user);

        this.emailService.sendCongratsOnRegistration(user.email, user.username);

        return ResponseModel.createSuccess({ id: user.id });
    }

    public async getByWalletAddress(walletAddress: string): Promise<ResponseModel<UserResponseModel | null>> {

        const user = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['agreement', 'organization']
        });

        if (!user) {
            return ResponseModel.createError(new Error('User not found'), 404);
        }

        const responseModel: UserResponseModel = {
            id: user.id,
            walletAddress: user.address,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            isAdmin: user.isAdmin,
            organization: user.organization && {
                id: user.organization!.id,
                logo: user.organization!.logo,
                name: user.organization!.name
            },
            agreement: user.agreement && {
                marketRate: user.agreement.marketRate,
                roleName: user.agreement.roleName,
                responsibilities: user.agreement.responsibilities,
                fiatRequested: user.agreement.fiatRequested,
                commitment: user.agreement.commitment
            }
        };

        return ResponseModel.createSuccess(responseModel);
    }
    public async requestNonce(walletAddress: string): Promise<ResponseModel<{ nonce: string } | null>> {
        const nonce = uuidv4();

        // Find the existing WalletNonce record by address
        let walletNonce = await this.walletNonceRepository.findOne({ where: { address: walletAddress } });

        if (walletNonce) {
            walletNonce.nonce = nonce;
            walletNonce.createdAt = new Date(); // Reset creation time
        } else {
            // Create a new WalletNonce entity if it doesn't exist
            walletNonce = this.walletNonceRepository.create({
                address: walletAddress,
                nonce
            });
        }

        await this.walletNonceRepository.save(walletNonce);

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
