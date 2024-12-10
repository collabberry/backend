import Joi from 'joi';


export interface CreateAssessmentModel {
  contributorId: string;
  cultureScore: number;
  workScore: number;
  feedbackPositive: string;
  feedbackNegative: string;
}

export const createAssessmentSchema = Joi.object({
  contributorId: Joi.string().required(),
  cultureScore: Joi.number().required(),
  workScore: Joi.number().required(),
  feedbackPositive: Joi.string().allow('').optional(),
  feedbackNegative: Joi.string().allow('').optional()
});
