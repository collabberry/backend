import Joi from 'joi';
import { CompensationPeriod } from '../../entities/index.js';
import { UserListModel } from '../user/userList.model.js';

export interface OrgDetailsModel extends OrgModel {
    contributors: UserListModel[];
}

export interface OrgModel {
    id: string;
    name: string;
    logo?: string;
    par: number;
    totalFunds: number | null;
    teamPointsContractAddress: string;
    compensationPeriod: CompensationPeriod | null;
    compensationStartDay: Date | null;
    assessmentDurationInDays: number | null;
    assessmentStartDelayInDays: number | null;
    totalDistributedFiat: number;
}

export const fullOrganizationScheme = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    logo: Joi.string().optional(),
    par: Joi.number().min(0).max(100).required(),
    compensationPeriod: Joi.number().valid(...Object.values(CompensationPeriod)).required(),
    compensationStartDay: Joi.date().optional(),
    assessmentDurationInDays: Joi.number().optional(),
    assessmentStartDelayInDays: Joi.number().optional(),
    totalFunds: Joi.number().optional()
});
