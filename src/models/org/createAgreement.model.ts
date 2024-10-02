import Joi from 'joi';

export interface CreateAgreementModel {
    userId: string;
    roleName: string;
    responsibilities: string;
    marketRate: number;
    fiatRequested: number;
    commitment: number;
}

export interface AgreementModel {
    roleName: string;
    responsibilities: string;
    marketRate: number;
    fiatRequested: number;
    commitment: number;
}

export const createAgreementSchema = Joi.object({
    userId: Joi.string().required(),
    roleName: Joi.string().required(),
    responsibilities: Joi.string().required(),
    marketRate: Joi.number().required(),
    fiatRequested: Joi.number().required(),
    commitment: Joi.number().required().min(1).max(100)
});
