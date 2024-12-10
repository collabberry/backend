import { config as dotenv_config } from 'dotenv';
import cron from 'node-cron';

import { container } from './inversify.config.js';
import { RoundService } from './services/round.service.js';
import { AppDataSource } from './data-source.js';

dotenv_config();

function keepAlive(): void {
    setTimeout(keepAlive, 2000);
}

try {
    AppDataSource.initialize().then(() => { console.log('App Data Source Connected'); });

    // --- Schedule tasks
    const roundStartGenerationSchedule = process.env.ROUNDS_START_GENERATION_SCHEDULE;
    if (!roundStartGenerationSchedule) {
        throw new Error('Start Round Generation schedule not defined.');
    }

    const roundService = container.get(RoundService);

    cron.schedule(roundStartGenerationSchedule, async () => {
        try {
            await roundService.createRounds();
        } catch (error) {
            console.error('Error creating rounds:', error);
        }
    });


       // --- Schedule tasks
       const roundCompleteRounds = process.env.COMPLETE_ROUNDS_SCHEDULE;
       if (!roundCompleteRounds) {
           throw new Error('Complete Round Generation schedule not defined.');
       }

       cron.schedule(roundCompleteRounds, async () => {
           try {
               await roundService.completeRounds();
           } catch (error) {
               console.error('Error creating rounds:', error);
           }
       });


} catch (error) {
    console.log('Error during service initialization!', error);
    process.exit(1);
}

keepAlive();
