import { injectable } from 'inversify';
import { Response } from 'express';
import { CreateOrgModel, organizationScheme } from '../models/org/createOrg.model.js';
import { OrganizationService } from '../services/organization.service.js';
import { handleResponse } from '../models/response_models/request_handler.js';
import { fullOrganizationScheme, OrgModel } from '../models/org/editOrg.model.js';
import { CreateAgreementModel, createAgreementSchema } from '../models/org/createAgreement.model.js';
import { uploadFileToS3 } from '../utils/fileUploader.js';

@injectable()
export class OrganizationController {

    constructor(private organizationService: OrganizationService) { }

    /**
     * Request a nonce for wallet authentication
     */
    public createOrg = async (req: any, res: Response) => {
        try {
            console.log(req.body);
            const model: CreateOrgModel = req.body!;
            const isValid = organizationScheme.validate(model);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }

            // Handle file upload (assuming the file is sent in req.file or req.files)
            const file = (req as any).file;
            let logoUrl: string | undefined;

            if (file) {
                const uploadResult = await uploadFileToS3({
                    Bucket: process.env.S3_BUCKET_NAME!, // Ensure your bucket name is in env variables
                    Key: `organization-logos/${file.originalname}`, // Customize the path and filename as needed
                    Body: file.buffer,
                    ContentType: file.mimetype
                });

                logoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${uploadResult}`;
            }

            // Call the organization service to create the organization
            const createdResponseModel = await this.organizationService.createOrganization(
                (req as any).user.walletAddress,
                { ...model, logo: logoUrl as string } // Pass the logo URL along with the model
            );

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


    public addAgreement = async (req: any, res: Response) => {
        try {
            const agreement: CreateAgreementModel = req.body;
            const isValid = createAgreementSchema.validate(agreement);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }
            const createdResponseModel = await this.organizationService.addAgreement(req.user.walletAddress, agreement);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));

        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public getContribAgreement = async (req: any, res: Response) => {
        try {
            const contributorId = req.params.contributorId;
            const createdResponseModel = await this.organizationService.getUserAgreement(contributorId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));

        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
