

export interface AssessmentResponseModel {
    id: string;
    contributorId: string;
    cultureScore?: number | null;
    workScore?: number | null;
    feedbackPositive?: string | null;
    feedbackNegative?: string | null;
  }
