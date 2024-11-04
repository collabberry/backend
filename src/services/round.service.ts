import { injectable } from 'inversify';
import { getRepository, IsNull, Not } from 'typeorm';
import { EmailService } from './email.service.js';
import { Assessment, Cycle, Organization, Round, User } from '../entities/index.js';
import { AppDataSource } from '../data-source.js';
import { RoundResponseModel, RoundStatus } from '../models/rounds/roundDetails.model.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { AssessmentResponseModel } from '../models/rounds/assessmentResponse.model.js';
import { CreateAssessmentModel } from '../models/rounds/createAssessment.model.js';
import { App } from '../app.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { calculateEndTime } from '../utils/endTime.util.js';

@injectable()
export class RoundService {

    private userRepository;
    private organizationRepository;
    private roundsRepository;
    private assessmentRepository;

    constructor(private emailService: EmailService) {
        this.userRepository = AppDataSource.getRepository(User);
        this.organizationRepository = AppDataSource.getRepository(Organization);
        this.roundsRepository = AppDataSource.getRepository(Round);
        this.assessmentRepository = AppDataSource.getRepository(Assessment);
    }
    /**
     * Start rounds for all organizations that have the next round date set to today and have rounds activated
     */
    public async startRounds(): Promise<void> {
        const orgs = await this.organizationRepository.find({
            where: {
                roundsActivated: true,
                nextRoundDate: new Date()
            },
            relations: ['rounds', 'users']
        });

        for (const org of orgs) {
            const endRoundDate = calculateEndTime(org.cycle, org.nextRoundDate);
            const round = this.roundsRepository.create({
                organization: org,
                roundNumber: (org.rounds?.length ?? 0) + 1,
                startDate: org.nextRoundDate,
                endDate: endRoundDate,
                assessmentDurationInDays: org.assessmentDurationInDays
            });

            await this.roundsRepository.save(round);

            org.nextRoundDate = new Date(endRoundDate);
            org.nextRoundDate.setDate(org.nextRoundDate.getDate() + 1);
            await this.organizationRepository.save(org);

            org.contributors?.forEach((user) =>
                this.emailService.sendRoundStarted(user.email, user.username, org.name)
            );
        }
    }

    public async getCurrentRound(organizationId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: organizationId },
                isActive: true
            },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const submittedAssessments: AssessmentResponseModel[] = currentRound.assessments.map((assessment) => ({
            id: assessment.id,
            assessedId: assessment.assessed.id,
            assessorId: assessment.assessor.id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }));

        const roundResponse: RoundResponseModel = {
            id: currentRound.id,
            status: currentRound.startDate > new Date()
                ? RoundStatus.NotStarted
                : currentRound.isActive
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: currentRound.startDate,
            endDate: currentRound.endDate!,
            submittedAssessments,
            assessmentDeadline: new Date(
                new Date(currentRound.startDate).setDate(
                    currentRound.startDate.getDate() + currentRound.assessmentDurationInDays
                )
            )
        };

        return ResponseModel.createSuccess(roundResponse);
    }



    public async getRoundById(roundId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const round = await this.roundsRepository.findOne({
            where: {
                id: roundId
            },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        if (!round) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const submittedAssessments: AssessmentResponseModel[] = round.assessments.map((assessment) => ({
            id: assessment.id,
            assessedId: assessment.assessed.id,
            assessorId: assessment.assessor.id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }));

        const roundResponse: RoundResponseModel = {
            id: round.id,
            status: round.startDate > new Date()
                ? RoundStatus.NotStarted
                : round.isActive
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: round.startDate,
            endDate: round.endDate!,
            submittedAssessments,
            assessmentDeadline: new Date(
                new Date(round.startDate).setDate(
                    round.startDate.getDate() + round.assessmentDurationInDays
                )
            )
        };

        return ResponseModel.createSuccess(roundResponse);
    }

    public async setIsActiveToRounds(organizationId: string, isActive: boolean): Promise<ResponseModel<null>> {
        const org = await this.organizationRepository.findOne({ where: { id: organizationId }, relations: ['rounds'] });

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found'), 404);
        }

        org.roundsActivated = isActive;
        await this.organizationRepository.save(org);

        if (isActive && org.rounds?.findIndex((round) => round.startDate > new Date()) === -1) {
            const newRound = this.roundsRepository.create({
                startDate: org.nextRoundDate,
                endDate: calculateEndTime(org.cycle, org.nextRoundDate),
                organization: org,
                roundNumber: (org.rounds?.length ?? 0) + 1,
                assessmentDurationInDays: org.assessmentDurationInDays
            });

            await this.roundsRepository.save(newRound);
        }

        return ResponseModel.createSuccess(null);
    }

    public async editRound(roundId: string, roundModel: RoundResponseModel): Promise<ResponseModel<null>> {
        const round = await this.roundsRepository.findOne({ where: { id: roundId } });

        if (!round) {
            return ResponseModel.createError(new Error('Round not found'), 404);
        }

        round.startDate = roundModel.startDate;
        round.endDate = roundModel.endDate;
        await this.roundsRepository.save(round);


        return ResponseModel.createSuccess(null);
    }

    public async getRounds(organizationId: string): Promise<ResponseModel<RoundResponseModel[] | null>> {
        const rounds = await this.roundsRepository.find({
            where: { organization: { id: organizationId } },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        return ResponseModel.createSuccess(rounds.map((round) => ({
            id: round.id,
            status: round.startDate > new Date()
                ? RoundStatus.NotStarted
                : round.isActive
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: round.startDate,
            endDate: round.endDate!,
            submittedAssessments: round.assessments.map((assessment) => ({
                id: assessment.id,
                assessorId: assessment.assessor.id,
                assessedId: assessment.assessed.id,
                cultureScore: assessment.cultureScore,
                workScore: assessment.workScore,
                feedbackPositive: assessment.feedbackPositive,
                feedbackNegative: assessment.feedbackNegative
            } as AssessmentResponseModel)),
            assessmentDeadline: new Date(
                new Date(round.startDate).setDate(
                    round.startDate.getDate() + round.assessmentDurationInDays
                )
            )
        })));
    }

    public async addAssessment(walletAddress: string, assessmentData: CreateAssessmentModel):
        Promise<ResponseModel<CreatedResponseModel | null>> {

        const assessor = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization', 'agreement']
        });

        if (!assessor) {
            return ResponseModel.createError(new Error('Assessor not found'), 404);
        }

        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: assessor.organization.id },
                isActive: true
            }
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const existingAssessment = await this.assessmentRepository.findOne({
            where: {
                round: { id: currentRound.id },
                assessor: { id: assessor.id },
                assessed: { id: assessmentData.contributorId }
            }
        });

        if (existingAssessment) {
            return ResponseModel.createError(new Error('Assessment already submitted'), 400);
        }

        const assessed = await this.userRepository.findOne({
            where: { id: assessmentData.contributorId },
            relations: ['agreement', 'organization']
        });

        if (!assessed ||
            !assessed.organization ||
            assessed.organization.id !== assessor.organization.id) {
            return ResponseModel.createError(new Error('Assessed and assessor not in the same org'), 400);
        }

        const newAssessment = this.assessmentRepository.create({
            round: currentRound,
            assessed,
            assessor,
            cultureScore: assessmentData.cultureScore,
            workScore: assessmentData.workScore,
            feedbackPositive: assessmentData.feedbackPositive,
            feedbackNegative: assessmentData.feedbackNegative
        });

        await this.assessmentRepository.save(newAssessment);
        return ResponseModel.createSuccess({ id: newAssessment.id });
    }


    public async getAssessments(roundId: string, assessorId: string | null = null, assessedId: string | null = null)
        : Promise<ResponseModel<AssessmentResponseModel[] | null>> {

        const round = await this.roundsRepository.findOne({
            where: { id: roundId },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        if (!round) {
            return ResponseModel.createError(new Error('Round not found'), 404);
        }

        let assessments = round.assessments;
        if (assessorId) {
            assessments = round.assessments.filter(assessment => assessment.assessor.id === assessorId);
        } else if (assessedId) {
            assessments = round.assessments.filter(assessment => assessment.assessed.id === assessedId);
        }

        return ResponseModel.createSuccess(assessments.map((assessment) => ({
            id: assessment.id,
            assessedId: assessment.assessed.id,
            assessorId: assessment.assessor.id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        })));
    }

    public async remindToAssess(roundId: string, remindAll: boolean, contributors: string[])
        : Promise<ResponseModel<null>> {
        const round = await this.roundsRepository.findOne({
            where: { id: roundId },
            relations: ['organization']
        });

        if (!round) {
            return ResponseModel.createError(new Error('Round not found'), 404);
        }
        const teamMembers = await this.userRepository.find({
            where: {
                organization: { id: round.organization.id },
                agreement: Not(IsNull())
            }
        });

        if (remindAll) {
            for (const contributor of teamMembers) {
                this.emailService.sendAssessmentReminder
                    (contributor.email, contributor.username, round.organization.name);
                return ResponseModel.createSuccess(null);
            }
        } else if (contributors) {
            for (const contributor of contributors) {
                const user = teamMembers.find(user => user.id === contributor);
                if (user) {
                    this.emailService.sendAssessmentReminder(user.email, user.username, round.organization.name);
                }
            }
        }
        return ResponseModel.createSuccess(null);
    }
}
