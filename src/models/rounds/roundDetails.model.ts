import { AssessmentResponseModel } from './assessmentResponse.model.js';

export interface RoundResponseModel {
    id: string;
    status: RoundStatus;
    startDate: Date;
    assessmentDeadline: Date;
    endDate: Date;
    submittedAssessments: AssessmentResponseModel[];
}

export enum RoundStatus {
    NotStarted = 1,
    InProgress,
    Completed
}
