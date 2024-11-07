import { CompensationPeriod } from '../entities/index.js';


// Assessment Rounds
export function calculateAssessmentRoundEndTime(startTime: Date, assessmentDurationInDays: number): Date {
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + assessmentDurationInDays);
    return endTime;
}

export function calculateAssessmentRoundStartTime(
    compensationCyclePeriod: CompensationPeriod,
    compensationCycleStartDate: Date,
    assessmentStartDelayInDays: number
): Date {
    const startTime = new Date(compensationCycleStartDate); // 6th of the month

    switch ((+compensationCyclePeriod) as CompensationPeriod) {
        case CompensationPeriod.Weekly:
            // Move startTime one week forward
            startTime.setDate(startTime.getDate() + 7 + assessmentStartDelayInDays); // 14th
            break;
        case CompensationPeriod.Biweekly:
            // Move startTime two weeks forward
            startTime.setDate(startTime.getDate() + 14 + assessmentStartDelayInDays);
            break;
        case CompensationPeriod.Monthly:
            // Move startTime one month forward
            startTime.setMonth(startTime.getMonth() + 1);
            startTime.setDate(startTime.getDate() + assessmentStartDelayInDays);
            break;
        case CompensationPeriod.Quarterly:
            // Move startTime three months forward
            startTime.setMonth(startTime.getMonth() + 3);
            startTime.setDate(startTime.getDate() + assessmentStartDelayInDays);
            break;
        default:
            throw new Error('Invalid cycle type');
    }

    return startTime;
}


// Compensation Periods
export function calculateNextCompensationPeriodStartDay(compensationStartDay: Date, cycle: CompensationPeriod): Date {
    const nextStartDay = new Date(compensationStartDay);

    switch (cycle) {
        case CompensationPeriod.Weekly:
            nextStartDay.setDate(nextStartDay.getDate() + 7);
            break;
        case CompensationPeriod.Biweekly:
            nextStartDay.setDate(nextStartDay.getDate() + 14);
            break;
        case CompensationPeriod.Monthly:
            nextStartDay.setMonth(nextStartDay.getMonth() + 1);
            break;
        case CompensationPeriod.Quarterly:
            nextStartDay.setMonth(nextStartDay.getMonth() + 3);
            break;
        default:
            throw new Error('Invalid compensation cycle');
    }

    return nextStartDay;
}
