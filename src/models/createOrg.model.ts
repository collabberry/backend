import Joi from 'joi';
import { CreateUserModel, createUserScheme } from './userRegistration.model.js';


export interface CreateOrgModel {
    name: string;
    logo: string;
    par?: number;
}

export const organizationScheme = Joi.object({
    name: Joi.string().required(),
    logo: Joi.string().optional().uri(),
    par: Joi.number().min(0).max(100).optional()
});
