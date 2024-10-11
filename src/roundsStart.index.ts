import { config as dotenv_config } from 'dotenv';
import cron from 'node-cron';

import { container } from './inversify.config.js';
import { RoundService } from './services/round.service.js';

dotenv_config();

function keepAlive(): void {
    setTimeout(keepAlive, 2000);
}

try {
    // --- Schedule tasks
    const schedule = process.env.ROUNDS_START_GENERATION_SCHEDULE;
    if (!schedule) {
        throw new Error('Start Round Generation schedule not defined.');
    }

    const roundService = container.get(RoundService);

    cron.schedule(schedule, async () => {
        try {
            await roundService.startRounds();
        } catch (error) {
            console.error('Error starting rounds:', error);
        }
    });
} catch (error) {
    console.log('Error during service initialization!', error);
    process.exit(1);
}

keepAlive();
