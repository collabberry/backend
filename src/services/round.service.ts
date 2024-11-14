import { injectable } from 'inversify';
import { IsNull, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import { EmailService } from './email.service.js';
import { Assessment, Organization, Round, User } from '../entities/index.js';
import { AppDataSource } from '../data-source.js';
import { RoundResponseModel, RoundStatus } from '../models/rounds/roundDetails.model.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import { AssessmentResponseModel } from '../models/rounds/assessmentResponse.model.js';
import { CreateAssessmentModel } from '../models/rounds/createAssessment.model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import {
    beginningOfToday,
    calculateAssessmentRoundEndTime,
    calculateAssessmentRoundStartTime,
    calculateNextCompensationPeriodStartDay,
    endOfToday
} from '../utils/roundTime.util.js';

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
    public async createRounds(): Promise<void> {
        const sevenDaysFromNow = endOfToday();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const orgs = await this.organizationRepository.find({
            relations: ['rounds']
        });

        for (const org of orgs) {

            const startRoundDate = calculateAssessmentRoundStartTime(
                org.compensationPeriod!,
                org.compensationStartDay!,
                org.assessmentStartDelayInDays!
            );

            if (startRoundDate >= beginningOfToday() && startRoundDate <= sevenDaysFromNow) {
                console.log('Start Assessment:', startRoundDate);
                const endRoundDate = calculateAssessmentRoundEndTime(startRoundDate, org.assessmentDurationInDays!);
                console.log('End Asssessment:', endRoundDate);

                const nextCycleStartDate = calculateNextCompensationPeriodStartDay(
                    org.compensationStartDay!,
                    org.compensationPeriod!
                );

                const round = this.roundsRepository.create({
                    organization: org,
                    roundNumber: (org.rounds?.length ?? 0) + 1,
                    startDate: startRoundDate,
                    endDate: endRoundDate,
                    compensationCycleStartDate: org.compensationStartDay!,
                    compensationCycleEndDate: nextCycleStartDate
                });

                await this.roundsRepository.save(round);
                console.log('Round created:', round.id);

                const o = await this.organizationRepository.findOne({
                    where: { id: org.id }
                });

                o!.compensationStartDay = nextCycleStartDate;

                await this.organizationRepository.save(o!);
                console.log('Next Compensation Cycle Start Day: ', o!.compensationStartDay);


                // Notify contributors via email
                if (org.contributors) {
                    org.contributors.forEach((user) =>
                        this.emailService.sendRoundStarted(user.email, user.username, org.name)
                    );
                }
            }
        }
    }

    public async getCurrentRound(organizationId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: organizationId },
                startDate: LessThanOrEqual(beginningOfToday()),
                endDate: MoreThanOrEqual(endOfToday())
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

        console.log('currentRound.startDate', currentRound.startDate);
        console.log('end time check', currentRound.endDate >= endOfToday());
        console.log('begining', beginningOfToday());

        const roundResponse: RoundResponseModel = {
            id: currentRound.id,
            status: currentRound.startDate > beginningOfToday()
                ? RoundStatus.NotStarted
                : currentRound.endDate && currentRound.endDate >= endOfToday()
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: currentRound.startDate,
            endDate: currentRound.endDate!,
            compensationCycleStartDate: currentRound.compensationCycleStartDate,
            compensationCycleEndDate: currentRound.compensationCycleEndDate,
            submittedAssessments
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
            return ResponseModel.createError(new Error('Invalid Round ID'), 400);
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
            status: round.startDate > beginningOfToday()
                ? RoundStatus.NotStarted
                : round.endDate && round.endDate >= endOfToday()
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: round.startDate,
            endDate: round.endDate!,
            compensationCycleStartDate: round.compensationCycleStartDate,
            compensationCycleEndDate: round.compensationCycleEndDate,
            submittedAssessments
        };

        return ResponseModel.createSuccess(roundResponse);
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
            status: round.startDate > beginningOfToday()
                ? RoundStatus.NotStarted
                : round.endDate && round.endDate >= endOfToday()
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: round.startDate,
            compensationCycleStartDate: round.compensationCycleStartDate,
            compensationCycleEndDate: round.compensationCycleEndDate,
            endDate: round.endDate!,
            submittedAssessments: round.assessments.map((assessment) => ({
                id: assessment.id,
                assessorId: assessment.assessor.id,
                assessedId: assessment.assessed.id,
                cultureScore: assessment.cultureScore,
                workScore: assessment.workScore,
                feedbackPositive: assessment.feedbackPositive,
                feedbackNegative: assessment.feedbackNegative
            } as AssessmentResponseModel))
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
                startDate: LessThanOrEqual(beginningOfToday()),
                endDate: MoreThanOrEqual(endOfToday())
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
