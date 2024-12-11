import { CompensationPeriod } from '../entities/index.js';


// Assessment Rounds
export function calculateAssessmentRoundEndTime(
    compensationCycleStartDate: Date,
    assessmentDurationInDays: number): Date {
    const startTime = new Date(compensationCycleStartDate);
    const endTime = new Date(Date.UTC(
        startTime.getUTCFullYear(),
        startTime.getUTCMonth(),
        startTime.getUTCDate() + +assessmentDurationInDays,
        23, 59, 0, 0
    ));

    return endTime;
}

export function calculateAssessmentRoundStartTime(
    compensationCyclePeriod: CompensationPeriod,
    compensationCycleStartDate: Date,
    assessmentStartDelayInDays: number
): Date {
    const compCycleStartDate = new Date(compensationCycleStartDate);
    const startTime = new Date(Date.UTC(
        compCycleStartDate.getUTCFullYear(),
        compCycleStartDate.getUTCMonth(),
        compCycleStartDate.getUTCDate(),
        0, 0, 0, 0
    ));
    console.log('compensationCyclePeriod:', compensationCyclePeriod);
    console.log('+compensationCyclePeriod:', +compensationCyclePeriod);
    switch ((+compensationCyclePeriod) as CompensationPeriod) {
        case CompensationPeriod.Weekly:
            // Move startTime one week forward
            startTime.setDate(startTime.getDate() + 7 + +assessmentStartDelayInDays);
            break;
        case CompensationPeriod.Biweekly:
            // Move startTime two weeks forward
            startTime.setDate(startTime.getDate() + 14 + +assessmentStartDelayInDays);
            break;
        case CompensationPeriod.Monthly:
            // Move startTime one month forward
            startTime.setMonth(startTime.getMonth() + 1);
            startTime.setDate(startTime.getDate() + +assessmentStartDelayInDays);
            break;
        case CompensationPeriod.Quarterly:
            // Move startTime three months forward
            startTime.setMonth(startTime.getMonth() + 3);
            startTime.setDate(startTime.getDate() + +assessmentStartDelayInDays);
            break;
        default:
            throw new Error('Invalid cycle type');
    }

    if (startTime < beginningOfToday()) {
        console.log('startTime < now');
        return beginningOfToday();
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

export function beginningOfToday(): Date {
    return new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
        0, 0, 0, 0
    ));
}

export function endOfToday(): Date {
    return new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
        23, 59, 59, 999
    ));
}
