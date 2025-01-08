import Joi from 'joi';

export interface CreateOrgModel {
    name: string;
    logo: string;
    teamPointsContractAddress: string;
}

export const organizationScheme = Joi.object({
    name: Joi.string().required(),
    logo: Joi.string().optional().uri(),
    teamPointsContractAddress: Joi.string().required()
});
