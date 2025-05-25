import Joi from 'joi';

export interface CreateOrgModel {
    name: string;
    logo: string;
    teamPointsContractAddress: string;
    chainId: number;
}

export const organizationScheme = Joi.object({
    name: Joi.string().required(),
    logo: Joi.string().optional().uri(),
    teamPointsContractAddress: Joi.string().required(),
    chainId: Joi.number().valid(42161, 421614, 42220).optional()
});
