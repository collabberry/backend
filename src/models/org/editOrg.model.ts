import Joi from 'joi';
import { Cycle } from '../../entities/index.js';
import { UserListModel } from '../user/userList.model.js';

export interface OrgDetailsModel extends OrgModel {
    contributors: UserListModel[];
}

export interface OrgModel {
    id: string;
    name: string;
    logo?: string;
    par: number;
    cycle: Cycle;
    startDate: Date;
    roundsActivated: boolean;
    nextRoundDate: Date;
}

export const fullOrganizationScheme = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    logo: Joi.string().optional(),
    par: Joi.number().min(0).max(100).required(),
    cycle: Joi.number().valid(...Object.values(Cycle)).required(),
    startDate: Joi.date().optional(),
    nextRoundDate: Joi.date().optional()
});
