

export interface AssessmentResponseModel {
    id: string;
    assessorId: string;
    assessorName: string;
    assessedId: string;
    assessedName: string;
    cultureScore?: number | null;
    workScore?: number | null;
    feedbackPositive?: string | null;
    feedbackNegative?: string | null;
  }
