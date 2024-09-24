import { injectable } from 'inversify';
import { Response } from 'express';
import { CreateOrgModel, organizationScheme } from '../models/createOrg.model.js';
import { OrganizationService } from '../services/organization.service.js';
import { handleResponse } from '../response_models/request_handler.js';

@injectable()
export class OrganizationController {

    constructor(private organizationService: OrganizationService) { }

    /**
     * Request a nonce for wallet authentication
     */
    public createOrg = async (req: any, res: Response) => {
        try {
            const model: CreateOrgModel = req.body;
            const isValid = organizationScheme.validate(model);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }
            const createdResponseModel = await this.organizationService.createOrganization
                (req.user.walletAddress, model);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));

        } catch (error) {
            console.error('Error creating an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
