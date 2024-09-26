import Joi from 'joi';
export interface WalletModel {
    walletAddress: string;

}

export interface VerifySignatureModel {
    walletAddress: string;
    signature: string;
}

export const verifySignatureSchema = Joi.object({
    // walletAddress: Joi.string()
    //     .pattern(/^0x[a-fA-F0-9]{40}$/)  // Regex for Ethereum address
    //     .required()
    //     .max(255),
    signature: Joi.string()
        .required()
        .max(255),
    message: Joi.object()
    });
