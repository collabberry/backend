import { injectable } from 'inversify';
import { Response } from 'express';
import { CreateOrgModel, organizationScheme } from '../models/org/createOrg.model.js';
import { OrganizationService } from '../services/organization.service.js';
import { handleResponse } from '../models/response_models/request_handler.js';
import { fullOrganizationScheme, OrgModel } from '../models/org/editOrg.model.js';
import { CreateAgreementModel, createAgreementSchema } from '../models/org/createAgreement.model.js';
import { uploadFileToS3 } from '../utils/fileUploader.js';
import { RoundService } from '../services/round.service.js';
import { CreateAssessmentModel, createAssessmentSchema } from '../models/rounds/createAssessment.model.js';
import { UserService } from '../services/user.service.js';

@injectable()
export class RoundsController {

    constructor(
        private organizationService: OrganizationService,
        private roundService: RoundService,
        private userService: UserService
    ) { }


    public getCurrentRound = async (req: any, res: Response) => {
        try {
            const orgId = req.params.orgId;
            const createdResponseModel = await this.roundService.getCurrentRound(orgId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public getRounds = async (req: any, res: Response) => {
        try {
            const walletAddress = req.user.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            if (!responseModel.data?.organization?.id) {
                return res.status(401).json({ message: 'User does not have an org' });
            }
            const createdResponseModel = await this.roundService.getRounds(responseModel.data?.organization?.id);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public getRoundById = async (req: any, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const createdResponseModel = await this.roundService.getRoundById(roundId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public editRound = async (req: any, res: Response) => {
        try {
            const model = req.body;
            const walletAddress = req.user.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            if (!responseModel.data?.isAdmin) {
                return res.status(401).json({ message: 'User is not an admin' });
            }
            if (!responseModel.data?.organization?.id) {
                return res.status(401).json({ message: 'User does not have an org' });
            }

            const createdResponseModel = await this.roundService
                .editRound(req.params.roundId, model);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public addAssessment = async (req: any, res: Response) => {
        try {
            const model: CreateAssessmentModel = req.body!;
            const isValid = createAssessmentSchema.validate(model);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }

            const createdResponseModel = await this.roundService.addAssessment(
                (req as any).user.walletAddress,
                model);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public getAssessments = async (req: any, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const assessorId = req.query.assessorId;
            const assessedId = req.query.assessedId;
            const createdResponseModel = await this.roundService.getAssessments(roundId, assessorId, assessedId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    public remind = async (req: any, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const remindAll: boolean = req.query.all;
            const users: string[] = req.query.users;
            const createdResponseModel = await this.roundService.remindToAssess(roundId, remindAll, users);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
