import { injectable } from 'inversify';
import { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { dirname } from 'desm';
import * as dotenv from 'dotenv';

// Initialize configuration
dotenv.config();
const __dirname = dirname(import.meta.url); // tslint:disable-line

@injectable()
export class EmailService {
    private transporter: Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail', // You can use other services like 'SendGrid', 'Mailgun', etc.
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    public async sendRoundStarted(email: string, username: string, orgName: string): Promise<void> {
        await this.sendEmail(
            email,
            '🌟 New Round Started! Time to Assess Your Peers 🌟',
            path.join(__dirname, '..', 'emailTemplates', 'roundStartedEmail.html'),
            {
                contributor_name: `${username}`,
                organization_name: `${orgName}`
            }
        );
    }


    public async sendCongratsOnRegistration(email: string, username: string): Promise<void> {
        await this.sendEmail(
            email,
            `🎉 Welcome to Collabberry! 🎉`,
            path.join(__dirname, '..', 'emailTemplates', 'registrationEmail.html'),
            {
                contributor_name: `${username}`,
                account_link: 'https://beta.collabberry.xyz'
            }
        );
    }

    public async sendAssessmentReminder(email: string, username: string, orgName: string): Promise<void> {
        await this.sendEmail(
            email,
            '🔔 Reminder: Complete Your Assessments 🔔',
            path.join(__dirname, '..', 'emailTemplates', 'assessmentReminderEmail.html'),
            {
                contributor_name: `${username}`,
                organization_name: `${orgName}`
            }
        );
    }

    private async sendEmail(to: string, subject: string, templatePath: string, templateVariables: any): Promise<void> {
        // Read the HTML template
        let data: string = await new Promise((resolve, reject) => {
            fs.readFile(templatePath, 'utf8', (err: NodeJS.ErrnoException | null, data: string) => {
                if (err) {
                    console.error('Error reading HTML template:', err);
                    reject(err);
                    return;
                }

                resolve(data);
            });
        });

        // Replace placeholders with actual values
        for (const key in templateVariables) {
            if (templateVariables.hasOwnProperty(key)) {
                const placeholder = `{{${key}}}`;
                data = data.replace(new RegExp(placeholder, 'g'), templateVariables[key]);
            }
        }

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html: data
        };

        // Send the email
        this.transporter.sendMail(mailOptions, (error: any, info: any) => {
            if (error) {
                console.error('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });
    }

}
