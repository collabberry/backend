import Joi from 'joi';
import { Cycle } from '../../entities/index.js';
import { id } from 'inversify';

export interface OrgModel {
    id: string;
    name: string;
    logo?: string;
    par: number;
    cycle: Cycle;
    startDate: Date;
}

export const fullOrganizationScheme = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    logo: Joi.string().optional().uri(),
    par: Joi.number().min(0).max(100).required(),
    cycle: Joi.string().valid(...Object.values(Cycle)).required(),
    startDate: Joi.date().required()
});