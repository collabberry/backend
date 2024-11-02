import { Cycle } from '../entities/index.js';

export function calculateEndTime(cycle: Cycle, startTime: Date): Date {
    const endTime = new Date(startTime);

    switch (cycle) {
        case Cycle.Weekly:
            endTime.setDate(endTime.getDate() + 7);
            break;
        case Cycle.Biweekly:
            endTime.setDate(endTime.getDate() + 14);
            break;
        case Cycle.Monthly:
            endTime.setMonth(endTime.getMonth() + 1);
            break;
        case Cycle.Quarterly:
            endTime.setMonth(endTime.getMonth() + 3);
            break;
        default:
            throw new Error('Invalid cycle type');
    }

    return endTime;
}
