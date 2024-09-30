import { injectable } from 'inversify';
import { Response } from 'express';
import { CreateOrgModel, organizationScheme } from '../models/org/createOrg.model.js';
import { OrganizationService } from '../services/organization.service.js';
import { handleResponse } from '../models/response_models/request_handler.js';
import { fullOrganizationScheme, OrgModel } from '../models/org/editOrg.model.js';

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

    /**
     * Generate a unique invitation link for the organization
     */
    public getInvitationToken = async (req: any, res: Response) => {
        try {
            const invitationToken = await this.organizationService
                .generateInvitationLink(req.user.walletAddress);
            res.status(invitationToken.statusCode).json(handleResponse(invitationToken));

        } catch (error) {
            console.error('Error creating an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public editOrg = async (req: any, res: Response) => {
        try {
            const model: OrgModel = req.body;
            const isValid = fullOrganizationScheme.validate(model);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }
            const createdResponseModel = await this.organizationService.editOrganization
                (req.user.walletAddress, model);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));

        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }


    public getOrg = async (req: any, res: Response) => {
        try {
            const id = req.params.orgId;

            const createdResponseModel = await this.organizationService.getOrgById(id);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));

        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
