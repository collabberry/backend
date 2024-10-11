import User from '../entities/users/user.model.js';

import { injectable } from 'inversify';
import Organization from '../entities/org/organization.model.js';
import { EmailService } from './email.service.js';


@injectable()
export class RoundService {

    constructor(private emailService: EmailService) {}

    /**
     * Start the rounds for all organizations that have the next round date set to today
     * and have the rounds activated
     */
    public async startRounds(): Promise<void> {
        const orgs = await Organization.find({
                roundsActivated: true,
                roundStarted: false,
                nextRoundDate: { $ete: new Date() }
            });

        for (const org of orgs) {
            org.roundStarted = true;
            org.save();

            const users = await User.find({ organization: org._id });
            users.forEach(user => {
                this.emailService.sendRoundStarted(user.email, user.username, org.name);
            });
        }
    }



}
