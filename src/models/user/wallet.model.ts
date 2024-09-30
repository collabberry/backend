import Joi from 'joi';
export interface WalletModel {
    walletAddress: string;
}


export const walletAddressSchema = Joi.object({
    walletAddress: Joi.string()
        .pattern(/^0x[a-fA-F0-9]{40}$/)
        .required()
});

export interface VerifySignatureModel {
    message: any;
    signature: string;
}

export const verifySignatureSchema = Joi.object({
    signature: Joi.string()
        .required()
        .max(255),
    message: Joi.object()
    });
