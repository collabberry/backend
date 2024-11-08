import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { CreateOrgModel } from '../models/org/createOrg.model.js';
import { Agreement, Invitation, Organization, Role, Round, User } from '../entities/index.js';
import { OrgDetailsModel, OrgModel } from '../models/org/editOrg.model.js';
import { CreateAgreementModel } from '../models/org/createAgreement.model.js';
import {
    calculateAssessmentRoundEndTime,
    calculateAssessmentRoundStartTime } from '../utils/roundTime.util.js';
import { RoundService } from './round.service.js';


@injectable()
export class OrganizationService {

    private userRepository;
    private organizationRepository;
    private invitationRepository;
    private agreementRepository;
    private roundsRepository;

    constructor(private roundsService: RoundService) {
        this.userRepository = AppDataSource.getRepository(User);
        this.organizationRepository = AppDataSource.getRepository(Organization);
        this.invitationRepository = AppDataSource.getRepository(Invitation);
        this.agreementRepository = AppDataSource.getRepository(Agreement);
        this.roundsRepository = AppDataSource.getRepository(Round);
    }
    /**
     * Create a new organization and assign the creator as an admin and contributor
     */
    public async createOrganization(
        creatorAddress: string,
        orgModel: CreateOrgModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {

        const creator = await this.userRepository.findOne({
            where: { address: creatorAddress.toLowerCase() },
            relations: ['agreement']
        });

        if (!creator) {
            return ResponseModel.createError(new Error('Creator not registered!'), 401);
        }

        const existingOrg = await this.organizationRepository.findOne({ where: { name: orgModel.name } });
        if (existingOrg) {
            return ResponseModel.createError(new Error('Organization with this name already exists!'), 400);
        }

        const organization = new Organization();
        organization.name = orgModel.name;
        organization.logo = orgModel.logo;
        organization.contributors = [creator];

        await this.organizationRepository.save(organization);

        creator.isAdmin = true;
        await this.userRepository.save(creator);

        return ResponseModel.createSuccess({ id: organization.id });
    }

    /**
     * Generate a unique invitation link for the organization
     */
    public async generateInvitationLink(
        userWalletAddress: string
    ): Promise<ResponseModel<any | null>> {

        const adminUser = await this.userRepository.findOne({
            where: { address: userWalletAddress.toLowerCase(), isAdmin: true },
            relations: ['organization']
        });
        if (!adminUser || !adminUser.isAdmin || !adminUser.organization) {
            return ResponseModel.createError(new Error('Only organization admins can generate invitation links.'), 401);
        }

        const token = uuidv4();
        const invitation = this.invitationRepository.create({
            token,
            organization: adminUser.organization,
            invitedBy: adminUser,
            usageLimit: 10
        });
        await this.invitationRepository.save(invitation);

        return ResponseModel.createSuccess({ invitationToken: token });
    }



    /**
     * Edit organization details
     */
    public async editOrganization(
        walletAddress: string,
        orgModel: OrgModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {
        const admin = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization']
        });
        if (!admin || !admin.isAdmin || !admin.organization) {
            return ResponseModel.createError(
                new Error('Only organization admins can update organization details.'), 401);
        }

        const org = await this.organizationRepository.findOne({ where: { id: admin.organization.id } });
        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }

        org.name = orgModel.name;
        org.logo = orgModel.logo;
        org.par = orgModel.par;
        org.compensationPeriod = orgModel.compensationPeriod;
        org.compensationStartDay = orgModel.compensationStartDay;
        org.assessmentDurationInDays = orgModel.assessmentDurationInDays;
        org.assessmentStartDelayInDays = orgModel.assessmentStartDelayInDays;
        await this.organizationRepository.save(org);

        const now = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
            0, 0, 0, 0
        ));
        const rounds = await this.roundsRepository.find({
            where: {
                organization: { id: org.id }
            }
        });
        const round = rounds.find((r) => r.startDate >= now);
        if (round) {
            console.log('Updating existing round');
            round.startDate = calculateAssessmentRoundStartTime(
                org.compensationPeriod!,
                org.compensationStartDay!,
                org.assessmentStartDelayInDays!);
            round.endDate = calculateAssessmentRoundEndTime(round.startDate, org.assessmentDurationInDays!);
            await this.roundsRepository.save(round);
        } else {
            console.log('Creating new round');
            await this.roundsService.createRounds();
        }

        return ResponseModel.createSuccess({ id: org.id });
    }

    /**
     * Get organization details by ID
     */
    public async getOrgById(orgId: string): Promise<ResponseModel<OrgDetailsModel | null>> {

        const org = await this.organizationRepository.findOne(
            { where: { id: orgId }, relations: ['contributors', 'contributors.agreement'] });
        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }

        const orgModel: OrgDetailsModel = {
            id: org.id,
            name: org.name,
            logo: org.logo,
            par: org.par,
            compensationPeriod: org.compensationPeriod,
            compensationStartDay: org.compensationStartDay,
            assessmentDurationInDays: org.assessmentDurationInDays,
            assessmentStartDelayInDays: org.assessmentStartDelayInDays,
            contributors: org.contributors?.map((u) => ({
                id: u.id,
                walletAddress: u.address,
                username: u.username,
                profilePicture: u.profilePicture,
                agreement: u.agreement && {
                    marketRate: u.agreement.marketRate,
                    roleName: u.agreement.roleName,
                    responsibilities: u.agreement.responsibilities,
                    fiatRequested: u.agreement.fiatRequested,
                    commitment: u.agreement.commitment
                }
            })) || []
        };

        return ResponseModel.createSuccess(orgModel);
    }

    /**
     * Add an agreement for a user in the organization
     */
    public async addAgreement(walletAddress: string, agreementData: CreateAgreementModel)
        : Promise<ResponseModel<CreatedResponseModel | null>> {

        const admin = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization']
        });
        if (!admin || !admin.organization || !admin.isAdmin) {
            return ResponseModel.createError(new Error('Only organization admins can add agreements.'), 401);
        }

        const agreementUser = await this.userRepository.findOne({
            where: { id: agreementData.userId },
            relations: ['organization']
        });
        if (!agreementUser ||
            agreementUser.organization.id !== admin.organization.id) {
            return ResponseModel.createError(new Error('User not found or not part of the organization!'), 404);
        }

        if (agreementUser.agreement) {
            return ResponseModel.createError(new Error('User already has an agreement!'), 400);
        }

        const newAgreement = this.agreementRepository.create({
            user: agreementUser,
            roleName: agreementData.roleName,
            responsibilities: agreementData.responsibilities,
            marketRate: agreementData.marketRate,
            fiatRequested: agreementData.fiatRequested,
            commitment: agreementData.commitment
        });
        await this.agreementRepository.save(newAgreement);

        agreementUser.agreement = newAgreement;
        await this.userRepository.save(agreementUser);

        return ResponseModel.createSuccess({ id: newAgreement.id });
    }

    /**
     * Get a user's agreement
     */
    public async getUserAgreement(userId: string): Promise<ResponseModel<any | null>> {
        const agreement = await this.agreementRepository.findOne({ where: { user: { id: userId } } });

        if (!agreement) {
            return ResponseModel.createError(new Error('Agreement not found'), 404);
        }

        return ResponseModel.createSuccess(agreement);
    }
}
