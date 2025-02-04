import { injectable } from 'inversify';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { EmailService } from './email.service.js';
import { Assessment, ContributorRoundCompensation, Organization, Round, User } from '../entities/index.js';
import { AppDataSource } from '../data-source.js';
import { ContributorRoundModel, ListRoundResponseModel, RoundResponseModel, RoundStatus } from '../models/rounds/roundDetails.model.js';
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
    public async createRounds(orgId?: string): Promise<void> {

        console.log('[startRounds] Starting round creation...');
        console.log(`[startRounds] orgId: ${orgId}...`);
        const sevenDaysFromNow = endOfToday();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        let orgs = [];
        if (orgId !== undefined) {
            const org = await this.organizationRepository.findOne({
                where: { id: orgId },
                relations: ['rounds']
            });
            if (!org) {
                return;
            }
            orgs.push(org);
        } else {
            orgs = await this.organizationRepository
                .createQueryBuilder('organization')
                .leftJoin('organization.rounds', 'round')
                .where(qb => {
                    const subQuery = qb.subQuery()
                        .select('1')
                        .from('rounds', 'r')
                        .where('r.organization_id = organization.id')
                        .andWhere('r.isCompleted = false')
                        .getQuery();
                    return `NOT EXISTS (${subQuery})`;
                })
                .getMany();
        }
        for (const org of orgs) {

            if (!org.compensationPeriod) {
                continue;
            }

            const startRoundDate = calculateAssessmentRoundStartTime(
                +org.compensationPeriod!,
                org.compensationStartDay!,
                +org.assessmentStartDelayInDays!
            );

            if (startRoundDate >= beginningOfToday() && startRoundDate <= sevenDaysFromNow) {
                const endRoundDate = calculateAssessmentRoundEndTime(startRoundDate, org.assessmentDurationInDays!);

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
                console.log('[startRounds] Round created:', round.id);

                const o = await this.organizationRepository.findOne({
                    where: { id: org.id }
                });

                o!.compensationStartDay = nextCycleStartDate;

                await this.organizationRepository.save(o!);


                // Notify contributors via email
                if (org.contributors) {
                    org.contributors.forEach((user) =>
                        this.emailService.sendRoundStarted(user.email, user.username, org.name)
                    );
                }
            }
        }

        console.log('[startRounds] Round creation completed.');
    }

    public async completeRounds(): Promise<void> {

        console.log('[completeRounds] Starting round completion...');
        const nowUTC = new Date();

        // Fetch rounds ending today, including required relations
        const rounds = await this.roundsRepository.find({
            where: {
                isCompleted: false,
                endDate: LessThanOrEqual(nowUTC)
            },
            relations: ['assessments', 'assessments.assessed.agreement', 'organization']
        });


        for (const round of rounds) {
            console.log('[completeRounds] Completing round:', round.id);

            const par = round.organization.par;
            // Initialize a map to group scores by contributors (assessed)
            const scoresByContributor = new Map<string, {
                cultureTotal: number,
                workTotal: number,
                count: number,
                commitment: number,
                marketRate: number,
                fiat: number
            }>();

            // Group assessments by the contributor being assessed
            for (const assessment of round.assessments) {
                const assessedId = assessment.assessed.id;

                if (!scoresByContributor.has(assessedId)) {
                    scoresByContributor.set(assessedId, {
                        cultureTotal: 0,
                        workTotal: 0,
                        count: 0,
                        marketRate: assessment.assessed.agreement!.marketRate,
                        commitment: assessment.assessed.agreement!.commitment,
                        fiat: assessment.assessed.agreement!.fiatRequested
                    });
                }

                const contributorScores = scoresByContributor.get(assessedId)!;

                // Add valid scores and increment count if any score is valid
                contributorScores.cultureTotal += assessment.cultureScore ? assessment.cultureScore : 0;
                contributorScores.workTotal += assessment.workScore ? assessment.workScore : 0;
                contributorScores.count += (assessment.cultureScore || assessment.workScore) ? 1 : 0;
            }
            let totalFiatSpent = 0;

            // Calculate average scores for each contributor
            for (const [contributorId, scores] of scoresByContributor) {
                const comp = new ContributorRoundCompensation();
                comp.round = round;
                comp.contributor = { id: contributorId } as User;
                comp.culturalScore = scores.cultureTotal / scores.count;
                comp.workScore = scores.workTotal / scores.count;
                comp.agreement_commitment = scores.commitment;
                comp.agreement_mr = scores.marketRate;
                comp.agreement_fiat = scores.fiat;
                const finalScore = (comp.culturalScore + comp.workScore) / 2;
                const baseSalary = (scores.commitment / 100) * scores.marketRate;

                const sam = (finalScore - 3) * ((par / 100) / 2);
                const totalComp = baseSalary * (1 + sam);
                const fiatRequested = scores.fiat;

                const validTotalComp = isNaN(totalComp) || totalComp === null ? 0 : Number(totalComp);
                const validFiatRequested = isNaN(fiatRequested) || fiatRequested === null ? 0 : Number(fiatRequested);

                const tpValue = validTotalComp - validFiatRequested < 0 ? 0 : validTotalComp - validFiatRequested;
                const fiatValue = validFiatRequested > validTotalComp ? validTotalComp : validFiatRequested;

                comp.tp = Number(tpValue.toFixed(2));
                comp.fiat = Number(fiatValue.toFixed(2));
                totalFiatSpent += comp.fiat;

                await AppDataSource.manager.save(comp);

            }

            const org = await this.organizationRepository.findOne({
                where: { id: round.organization.id }
            });
            round.isCompleted = true;
            if (org!.totalFunds > 0) {
                org!.totalFunds -= totalFiatSpent;
            }
            await AppDataSource.manager.save(round);
            await AppDataSource.manager.save(org);
        }

        console.log('[completeRounds] Round completion completed.');
    }

    public async getCurrentRound(organizationId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const utcNow = new Date();
        const currentRound = await this.roundsRepository.findOne({
            where: {
                organization: { id: organizationId },
                startDate: LessThanOrEqual(utcNow),
                endDate: MoreThanOrEqual(utcNow)
            },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        if (!currentRound) {
            return ResponseModel.createSuccess(null);
        }

        return this.getRoundById(currentRound.id);
    }
    public async getRoundById(roundId: string): Promise<ResponseModel<RoundResponseModel | null>> {
        const round = await this.roundsRepository.findOne({
            where: {
                id: roundId
            },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed', 'organization.contributors']
        });

        if (!round) {
            return ResponseModel.createError(new Error('Invalid Round ID'), 400);
        }

        // Initialize contributors map
        const contributorsMap = new Map<string, ContributorRoundModel>();

        // Add all contributors to the map with default values
        await Promise.all(
            round.organization.contributors!.map(async (contributor) => {

                // Fetch the compensation data for the current contributor
                const compensation = await AppDataSource.manager.findOne(ContributorRoundCompensation, {
                    where: {
                        round: { id: round.id },
                        contributor: { id: contributor.id }
                    }
                });
                if (!compensation && round.isCompleted) {
                    return;
                }

                const assessments = await AppDataSource.manager.find(Assessment, {
                    where: {
                        round: { id: round.id }
                    },
                    relations: ['assessor']
                });

                // Populate the map with fetched or default values
                contributorsMap.set(contributor.id, {
                    id: contributor.id,
                    username: contributor.username,
                    profilePicture: contributor.profilePicture,
                    cultureScore: compensation?.culturalScore ?? 0,
                    workScore: compensation?.workScore ?? 0,
                    totalScore: ((compensation?.culturalScore ?? 0) + (compensation?.workScore ?? 0)) / 2,
                    teamPoints: compensation?.tp ?? 0,
                    fiat: compensation?.fiat ?? 0,
                    hasAssessed: assessments.some(x => x.assessor.id === contributor.id)
                });

            })
        );

        // Map submitted assessments
        const submittedAssessments: AssessmentResponseModel[] = round.assessments.map((assessment) => ({
            id: assessment.id,
            assessedId: assessment.assessed.id,
            assessedName: assessment.assessed.username,
            assessorId: assessment.assessor.id,
            assessorName: assessment.assessor.username,
            cultureScore: assessment.cultureScore,
            workScore: assessment.workScore,
            feedbackPositive: assessment.feedbackPositive,
            feedbackNegative: assessment.feedbackNegative
        }));

        // Create the round response
        const roundResponse: RoundResponseModel = {
            id: round.id,
            roundNumber: round.roundNumber,
            status: round.startDate > beginningOfToday()
                ? RoundStatus.NotStarted
                : round.endDate && round.endDate >= endOfToday()
                    ? RoundStatus.InProgress
                    : RoundStatus.Completed,
            startDate: round.startDate,
            endDate: round.endDate!,
            txHash: round.txHash,
            compensationCycleStartDate: round.compensationCycleStartDate,
            compensationCycleEndDate: round.compensationCycleEndDate,
            contributors: Array.from(contributorsMap.values()),
            submittedAssessments
        };

        return ResponseModel.createSuccess(roundResponse);
    }

    public async editRound(roundId: string, roundModel: RoundResponseModel): Promise<ResponseModel<null>> {
        const round = await this.roundsRepository.findOne({ where: { id: roundId } });

        if (!round) {
            return ResponseModel.createError(new Error('Round not found'), 404);
        }

        if (round.isCompleted) {
            return ResponseModel.createError(new Error('Round already completed'), 400);
        }

        round.startDate = roundModel.startDate;
        round.endDate = roundModel.endDate;
        await this.roundsRepository.save(round);

        return ResponseModel.createSuccess(null);
    }

    public async getRounds(organizationId: string): Promise<ResponseModel<ListRoundResponseModel[] | null>> {
        const rounds = await this.roundsRepository.find({
            where: { organization: { id: organizationId } },
            relations: ['assessments', 'assessments.assessor', 'assessments.assessed']
        });

        return ResponseModel.createSuccess(rounds.map((round) => {
            return {
                id: round.id,
                roundNumber: round.roundNumber,
                status: round.startDate > beginningOfToday()
                    ? RoundStatus.NotStarted
                    : round.endDate && round.endDate >= endOfToday()
                        ? RoundStatus.InProgress
                        : RoundStatus.Completed,
                startDate: round.startDate,
                compensationCycleStartDate: round.compensationCycleStartDate,
                compensationCycleEndDate: round.compensationCycleEndDate,
                endDate: round.endDate!
            };
        }));
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
            assessedName: assessment.assessed.username,
            assessorName: assessment.assessor.username,
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

        try {

            if (remindAll) {
                for (const contributor of teamMembers) {
                    await this.emailService.sendAssessmentReminder
                        (contributor.email, contributor.username, round.organization.name);
                    return ResponseModel.createSuccess(null);
                }
            } else if (contributors) {
                for (const contributor of contributors) {
                    const user = teamMembers.find(user => user.id === contributor);
                    if (user) {
                        await this.emailService.sendAssessmentReminder
                            (user.email, user.username, round.organization.name);
                    }
                }
            }
            return ResponseModel.createSuccess(null);
        } catch (error) {
            return ResponseModel.createError(new Error('Could not send an email'), 400);
        }
    }

    public async addTokenMintTx(roundId: string, txHash: string): Promise<ResponseModel<null>> {
        const round = await this.roundsRepository.findOne({
            where: { id: roundId }
        });

        if (!round) {
            return ResponseModel.createError(new Error('Round not found'), 404);
        }

        round.txHash = txHash;
        await this.roundsRepository.save(round);

        return ResponseModel.createSuccess(null);
    }
}
