import { AssessmentResponseModel } from './assessmentResponse.model.js';

export interface RoundResponseModel {
    id: string;
    roundNumber: number;
    status: RoundStatus;
    startDate: Date;
    endDate: Date;
    contributors: ContributorRoundModel[];
    submittedAssessments: AssessmentResponseModel[];
    compensationCycleStartDate: Date;
    compensationCycleEndDate: Date;
}

export interface ListRoundResponseModel {
    id: string;
    status: RoundStatus;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    compensationCycleStartDate: Date;
    compensationCycleEndDate: Date;
}

// All contributors in the org with their scores
export interface ContributorRoundModel {
    id: string;
    username: string;
    profilePicture: string | undefined;
    cultureScore: number;
    workScore: number;
    totalScore: number;
    teamPoints: number;
    fiat: number;
    hasAssessed: boolean;
}

export enum RoundStatus {
    NotStarted = 1,
    InProgress,
    Completed
}
