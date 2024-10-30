import { injectable } from 'inversify';
import { getRepository } from 'typeorm';
import { EmailService } from './email.service.js';
import { Assessment, Cycle, Organization, Round, User } from '../entities/index.js';
import { AppDataSource } from '../data-source.js';
import { RoundResponseModel, RoundStatus } from '../models/rounds/roundDetails.model.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { AssessmentResponseModel } from '../models/rounds/assessmentResponse.model.js';
import { CreateAssessmentModel } from '../models/rounds/createAssessment.model.js';
import { App } from '../app.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';

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
            const endRoundDate = this.calculateEndTime(org.cycle, org.nextRoundDate);
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

    private calculateEndTime(cycle: Cycle, startTime: Date): Date {
        const endTime = new Date(startTime);

        switch (cycle) {
            case Cycle.Weekly:
                endTime.setDate(endTime.getDate() + 7);
                break;
            case Cycle.Biweekly:
                endTime.setDate(endTime.getDate() + 14);
                break;
            case Cycle.Monthly:
                endTime.setMonth(endTime.getMonth() + 1);
                break;
            case Cycle.Quarterly:
                endTime.setMonth(endTime.getMonth() + 3);
                break;
            default:
                throw new Error('Invalid cycle type');
        }

        return endTime;
    }

    public async getCurrentRound(organizationId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: organizationId },
                isActive: true
            },
            relations: ['assessments', 'assessments.contributor']
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const submittedAssessments: AssessmentResponseModel[] = currentRound.assessments.map((assessment) => ({
            id: assessment.id,
            contributorId: assessment.contributor.id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }));

        const roundResponse: RoundResponseModel = {
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
            relations: ['assessments', 'assessments.contributor']
        });

        if (!round) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const submittedAssessments: AssessmentResponseModel[] = round.assessments.map((assessment) => ({
            id: assessment.id,
            contributorId: assessment.contributor.id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }));

        const roundResponse: RoundResponseModel = {
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
                endDate: this.calculateEndTime(org.cycle, org.nextRoundDate),
                organization: org,
                roundNumber: (org.rounds?.length ?? 0) + 1,
                assessmentDurationInDays: org.assessmentDurationInDays
            });

            await this.roundsRepository.save(newRound);
        }

        return ResponseModel.createSuccess(null);
    }

    public async addAssessment(walletAddress: string, assessmentData: CreateAssessmentModel):
        Promise<ResponseModel<CreatedResponseModel | null>> {

        const user = await this.userRepository.findOne({
            where: { address: walletAddress.toLowerCase() },
            relations: ['organization', 'agreement']
        });

        if (!user) {
            return ResponseModel.createError(new Error('User not found'), 404);
        }

        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: user.organization.id },
                isActive: true
            }
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const existingAssessment = await this.assessmentRepository.findOne({
            where: {
                round: { id: currentRound.id },
                contributor: { id: user.id }
            }
        });

        if (existingAssessment) {
            return ResponseModel.createError(new Error('Assessment already submitted'), 400);
        }

        const contributor = await this.userRepository.findOne({
            where: { id: assessmentData.contributorId },
            relations: ['agreement', 'organization']
        });

        if (!contributor ||
            !contributor.organization ||
            contributor.organization.id !== user.organization.id) {
            return ResponseModel.createError(new Error('Contributor is not part of the same organization'), 400);
        }

        const newAssessment = this.assessmentRepository.create({
            round: currentRound,
            contributor,
            cultureScore: assessmentData.cultureScore,
            workScore: assessmentData.workScore,
            feedbackPositive: assessmentData.feedbackPositive,
            feedbackNegative: assessmentData.feedbackNegative
        });

        await this.assessmentRepository.save(newAssessment);
        return ResponseModel.createSuccess({ id: newAssessment.id });
    }
}
