import User from '../entities/users/user.model.js';

import { injectable } from 'inversify';
import Organization from '../entities/org/organization.model.js';
import { EmailService } from './email.service.js';
import { ResponseModel } from '../models/response_models/response_model.js';
import Round from '../entities/assessment/round.model.js';
import { Cycle } from '../entities/index.js';
import Assessment from '../entities/assessment/assessment.model.js';
import { CreateAssessmentModel } from '../models/rounds/createAssessment.model.js';
import { RoundResponseModel, RoundStatus } from '../models/rounds/roundDetails.model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { AssessmentResponseModel } from '../models/rounds/assessmentResponse.model.js';


@injectable()
export class RoundService {

    constructor(private emailService: EmailService) { }

    /**
     * Start the rounds for all organizations that have the next round date set to today
     * and have the rounds activated
     */
    public async startRounds(): Promise<void> {
        const orgs = await Organization.find({
            roundsActivated: true,
            roundStarted: false,
            nextRoundDate: { $ete: new Date() }
        });

        for (const org of orgs) {
            const endRoundDate = this.calculateEndTime(org.cycle, org.nextRoundDate);
            const round = new Round({
                organizationId: org._id,
                roundNumber: org.rounds.length + 1,
                startDate: org.nextRoundDate,
                endDate: endRoundDate,
                assessmentDurationInDays: org.assessmentDurationInDays
            });

            await round.save();
            const nextRoundDate = new Date(endRoundDate);
            nextRoundDate.setDate(nextRoundDate.getDate() + 1);
            org.nextRoundDate = nextRoundDate;
            org.rounds.push(round._id);
            await org.save();

            const users = await User.find({ organization: org._id });
            users.forEach(user => {
                this.emailService.sendRoundStarted(user.email, user.username, org.name);
            });
        }
    }

    private calculateEndTime(cycle: Cycle, startTime: Date): Date {
        const endTime = new Date(startTime);  // Create a new date based on startTime

        switch (cycle) {
            case Cycle.Weekly:
                endTime.setDate(endTime.getDate() + 7);  // Add 7 days
                break;
            case Cycle.Biweekly:
                endTime.setDate(endTime.getDate() + 14);  // Add 14 days
                break;
            case Cycle.Monthly:
                endTime.setMonth(endTime.getMonth() + 1);  // Add 1 month
                break;
            case Cycle.Quarterly:
                endTime.setMonth(endTime.getMonth() + 3);  // Add 3 months
                break;
            default:
                throw new Error('Invalid cycle type');
        }

        return endTime;
    }

    public async getCurrentRound(organizationId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const currentRound = await Round.findOne({
            organizationId,
            isActive: true
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        // Fetch the assessments related to the current round
        const assessments = await Assessment.find({ roundId: currentRound._id });

        // Map assessments to AssessmentResponseModel
        const submittedAssessments: AssessmentResponseModel[] = assessments.map(assessment => ({
            contributorId: assessment.contributorId,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }) as AssessmentResponseModel);

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

    public async getRoundById(organizationId: string, roundId: string):
        Promise<ResponseModel<RoundResponseModel | null>> {
        const round = await Round.findById({
            roundId
        });

        if (!round || round?.organizationId !== organizationId) {
            return ResponseModel.createError(new Error('Invalid Round'), 400);
        }

        // Fetch the assessments related to the round
        const assessments = await Assessment.find({ roundId: round._id });

        // Map assessments to AssessmentResponseModel
        const submittedAssessments: AssessmentResponseModel[] = assessments.map(assessment => ({
            contributorId: assessment.contributorId,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }) as AssessmentResponseModel);

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


    public async changeActiveRound(organizationId: string, isActive: boolean): Promise<ResponseModel<null>> {
        const org = await Organization.findById(organizationId);

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found'), 404);
        }

        if (org.roundsActvated) {
            return ResponseModel.createError(new Error('Rounds already activated'), 400);
        }

        org.roundsActvated = isActive;
        await org.save();

        // TODO: + check start date is after Date.now()
        const existingRound = await Round.find({ organizationId });
        if (!existingRound && org.roundsActvated) {

            const newRound = new Round({
                startDate: org.nextRoundDate,
                endDate: this.calculateEndTime(org.cycle, org.nextRoundDate),
                organizationId: org._id,
                roundNumber: org.rounds.length + 1,
                assessmentDurationInDays: org.assessmentDurationInDays
            });
            await newRound.save();
        }

        return ResponseModel.createSuccess(null);

    }

    public async addAssessment(walletAddress: string, assessment: CreateAssessmentModel)
        : Promise<ResponseModel<CreatedResponseModel | null>> {

        const user = await User.findOne({ address: walletAddress.toLowerCase() })
            .populate({
                path: 'contribution.organization',
                model: 'Organization'
            });

        if (!user) {
            return ResponseModel.createError(new Error('User not found'), 404);
        }

        const currentRound = await Round.findOne({
            organizationId: user!.contribution?.organization,
            isActive: true
        });

        if (!currentRound) {
            return ResponseModel.createError(new Error('No active round found for the organization'), 400);
        }

        const existingAssessment = await Assessment.findOne({
            roundId: currentRound._id,
            contributorId: user._id
        });

        if (existingAssessment) {
            return ResponseModel.createError(new Error('Assessment already submitted'), 400);
        }

        const contributor = await User.findById(assessment.contributorId)
            .populate({
                path: 'contribution.organization',
                model: 'Organization'
            });

        if (!contributor || !contributor.contribution) {
            return ResponseModel.createError(new Error('Contributor not found'), 404);
        }

        if ((contributor.contribution!.organization! as any)._id.toString()
            !== (user.contribution!.organization! as any)._id.toString()) {
            return ResponseModel.createError(new Error('Contributor is not part of the same organization'), 400);
        }


        if (!contributor.contribution!.agreement) {
            return ResponseModel.createError(new Error('Contributor does not have an agreement set up'), 400);
        }

        const newAssessment = new Assessment({
            roundId: currentRound._id,
            contributorId: user._id,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        });

        await newAssessment.save();
        return ResponseModel.createSuccess({ id: newAssessment._id });
    }


}
