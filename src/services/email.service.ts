import { injectable } from 'inversify';
import { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { dirname } from 'desm';
import * as dotenv from 'dotenv';
import postmark from 'postmark';

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

    private async sendEmail(
        to: string,
        subject: string,
        templatePath: string,
        templateVariables: Record<string, string>
    ): Promise<void> {
        try {
            if (process.env.EMAILS_ENABLED !== 'true') {
                return;
            }

            // Read the HTML template
            const data: string = await new Promise((resolve, reject) => {
                fs.readFile(templatePath, 'utf8', (err, fileData) => {
                    if (err) {
                        console.error('Error reading HTML template:', err);
                        reject(err);
                        return;
                    }

                    resolve(fileData);
                });
            });

            // Replace placeholders with actual values
            let htmlContent = data;
            for (const key in templateVariables) {
                if (Object.prototype.hasOwnProperty.call(templateVariables, key)) {
                    const placeholder = `{{${key}}}`;
                    htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), templateVariables[key]);
                }
            }

            // Initialize Postmark client
            const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY as string);

            // Send the email via Postmark
            await client.sendEmail({
                From: 'hi@collabberry.xyz',
                To: to,
                Subject: subject,
                HtmlBody: htmlContent
            });

            console.log(`Email sent successfully to ${to}`);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }


}
