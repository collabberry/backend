import Joi from 'joi';


export interface CreateUserModel {
    walletAddress?: string;
    username: string;
    email: string;
    profilePicture?: string;
    invitationToken?: string;
}

// Schema for registering a user
export const createUserScheme = Joi.object({
    walletAddress: Joi.string().optional(),
    username: Joi.string().required(),
    email: Joi.string().required().email(),
    profilePicture: Joi.string().uri().optional(),
    invitationToken: Joi.string().optional()
});
