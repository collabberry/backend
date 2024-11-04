

export interface AssessmentResponseModel {
    id: string;
    assessorId: string;
    assessedId: string;
    cultureScore?: number | null;
    workScore?: number | null;
    feedbackPositive?: string | null;
    feedbackNegative?: string | null;
  }
