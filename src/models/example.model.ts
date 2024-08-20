import Joi from 'joi';
export interface ExampleModel {
    name: string;

}

export const exampleModelSchema = Joi.object({

    name: Joi.string()
        .required()
        .max(255)

});

