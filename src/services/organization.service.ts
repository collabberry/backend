import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { CreateOrgModel } from '../models/org/createOrg.model.js';
import { Agreement, ContributorRoundCompensation, Invitation, Organization, Round, User } from '../entities/index.js';
import { OrgDetailsModel, OrgModel } from '../models/org/editOrg.model.js';
import { CreateAgreementModel } from '../models/org/createAgreement.model.js';
import {
    calculateAssessmentRoundEndTime,
    calculateAssessmentRoundStartTime
} from '../utils/roundTime.util.js';
import { RoundService } from './round.service.js';
import { TeamPointsService } from './teamPoints.service.js';


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
        organization.teamPointsContractAddress = orgModel.teamPointsContractAddress;
        organization.contributors = [creator];

        await this.organizationRepository.save(organization);

        return ResponseModel.createSuccess({ id: organization.id });
    }

    /**
     * Generate a unique invitation link for the organization
     */
    public async generateInvitationLink(
        userWalletAddress: string
    ): Promise<ResponseModel<any | null>> {

        const adminUser = await this.userRepository.findOne({
            where: { address: userWalletAddress.toLowerCase() },
            relations: ['organization']
        });

        const token = uuidv4();
        const invitation = this.invitationRepository.create({
            token,
            organization: user?.organization!,
            invitedBy: user!,
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
       
        const user = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization']
        });
        const org = user?.organization!;

        org.name = orgModel.name;
        org.logo = orgModel.logo;
        org.par = orgModel.par;
        org.compensationPeriod = orgModel.compensationPeriod;
        org.compensationStartDay = orgModel.compensationStartDay;
        org.assessmentDurationInDays = orgModel.assessmentDurationInDays;
        org.assessmentStartDelayInDays = orgModel.assessmentStartDelayInDays;
        org.totalFunds = orgModel.totalFunds ?? 0;
        await this.organizationRepository.save(org);

        const rounds = await this.roundsRepository.find({
            where: {
                organization: { id: org.id }
            }
        });

        const utcNow = new Date();
        const ongoingRound = rounds.find((r) => r.isCompleted === false && r.startDate <= utcNow);
        if (!ongoingRound) {
            const futureRound = rounds.find((r) => r.startDate >= utcNow);
            if (futureRound) {
                console.log('Updating existing round');
                futureRound.startDate = calculateAssessmentRoundStartTime(
                    +org.compensationPeriod!,
                    org.compensationStartDay!,
                    +org.assessmentStartDelayInDays!);
                futureRound.endDate =
                    calculateAssessmentRoundEndTime(futureRound.startDate, +org.assessmentDurationInDays!);
                await this.roundsRepository.save(futureRound);
            } else {
                console.log('Creating new round');
                await this.roundsService.createRounds(org.id);
            }
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

        const allCompensation = await AppDataSource.manager.find(ContributorRoundCompensation, {
            where: { round: { organization: { id: org.id } } }
        });


        const orgModel: OrgDetailsModel = {
            id: org.id,
            name: org.name,
            logo: org.logo,
            par: org.par,
            compensationPeriod: org.compensationPeriod,
            compensationStartDay: org.compensationStartDay,
            assessmentDurationInDays: org.assessmentDurationInDays,
            assessmentStartDelayInDays: org.assessmentStartDelayInDays,
            teamPointsContractAddress: org.teamPointsContractAddress,
            totalFunds: org.totalFunds,
            totalDistributedFiat: allCompensation.reduce((acc, c) => acc + +c.fiat, 0),
            contributors: org.contributors?.map((u) => ({
                id: u.id,
                walletAddress: u.address,
                username: u.username,
                profilePicture: u.profilePicture,
                agreement: u.agreement && {
                    id: u.agreement.id,
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

        const user = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization']
        });
        const org = user?.organization!;

        const agreementUser = await this.userRepository.findOne({
            where: { id: agreementData.userId },
            relations: ['organization']
        });
        if (!agreementUser ||
            agreementUser.organization.id !== org.id) {
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
     * Edits an agreement for a user in the organization
     */
    public async editAgreement(walletAddress: string, agreeementId: string, agreementData: CreateAgreementModel)
        : Promise<ResponseModel<CreatedResponseModel | null>> {

        const agreement = await this.agreementRepository.findOne({
            where: { id: agreeementId }
        });
        if (!agreement) {
            return ResponseModel.createError(new Error('Agreement not found!'), 404);
        }

        agreement.roleName = agreementData.roleName;
        agreement.responsibilities = agreementData.responsibilities;
        agreement.marketRate = agreementData.marketRate;
        agreement.fiatRequested = agreementData.fiatRequested;
        agreement.commitment = agreementData.commitment;

        await this.agreementRepository.save(agreement);

        return ResponseModel.createSuccess({ id: agreement.id });
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
    public async getScoresByWalletAddress(walletAddress: string): Promise<ResponseModel<any | null>> {
        const user = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization']
        });

        if (!user || !user.organization) {
            return ResponseModel.createError(new Error('User not found or not part of an organization'), 404);
        }

        const rounds = await this.roundsRepository.find({
            where: { organization: { id: user.organization.id } },
            relations: ['assessments', 'assessments.assessed', 'assessments.assessor']
        });

        const scores = rounds.map((r) => {
            const userAssessments = r.assessments.filter(a => a.assessed.id === user.id);

            const calculateAverage = (assessments: any[], key: string) => {
                const validScores = assessments
                    .map((a: any) => a[key] ?? 0)
                    .filter((score: number) => score !== 0);
                return validScores.length > 0
                    ? validScores.reduce((acc: number, score: number) => acc + score, 0) / validScores.length
                    : 0;
            };

            return {
                roundId: r.id,
                roundName: r.roundNumber,
                assessments: userAssessments,
                totalCultureScore: calculateAverage(userAssessments, 'cultureScore'),
                totalWorkScore: calculateAverage(userAssessments, 'workScore')
            };
        });

        return ResponseModel.createSuccess(scores);
    }

}
