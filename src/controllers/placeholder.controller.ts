import { injectable } from 'inversify';
import { Response } from 'express';
import { ExampleModel, exampleModelSchema } from '../models/example.model.js';

@injectable()
export class PlaceholderController {

    public test = async (req: any, res: Response) => {
        try {
            const model: ExampleModel = req.body;
            const validation = exampleModelSchema.validate(model);
            if (validation.error) { return res.status(400).send({ message: validation.error.message }); }
            res.status(200).json({});
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Internal Server Error'); // Return 500 for server errors
        }
    }
}
