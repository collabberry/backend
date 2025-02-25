import { AppDataSource } from './data-source.js';
import { Organization, User } from './entities/index.js'; // Adjust your import paths as needed
import { createObjectCsvWriter } from 'csv-writer';

// ================================================
// Organization Export with Admin Info
// ================================================

// Define CSV file structure for organizations, including admin info
const orgCsvWriter = createObjectCsvWriter({
    path: 'org-export-report.csv',
    header: [
        { id: 'orgName', title: 'Organization Name' },
        { id: 'createdOn', title: 'Date Created' },
        { id: 'contributorCount', title: 'Contributors' },
        { id: 'roundsRun', title: 'Rounds Run' },
        { id: 'completedRoundsWithTx', title: 'Completed Rounds with TX Hash' },
        { id: 'agreementCount', title: 'Agreements' },
        { id: 'adminEmail', title: 'Admin Email' },
        { id: 'adminName', title: 'Admin Name' },
        { id: 'adminTelegram', title: 'Admin Telegram Handle' },
        { id: 'par', title: 'PAR' },
        { id: 'compensationPeriod', title: 'Compensation Period' },
        { id: 'compensationStartDay', title: 'Compensation Start Day' },
        { id: 'assessmentDurationInDays', title: 'Assessment Duration (Days)' },
        { id: 'assessmentStartDelayInDays', title: 'Assessment Start Delay (Days)' }

    ]
});

// Fetch and process organization data
async function fetchOrgReportData(): Promise<any[]> {
    // Query organizations along with their related data
    const organizations = await AppDataSource
        .getRepository(Organization)
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.contributors', 'contributor')
        .leftJoinAndSelect('org.rounds', 'round')
        .leftJoinAndSelect('round.assessments', 'assessment')
        .leftJoinAndSelect('contributor.agreement', 'agreement')
        .getMany();


    const data = organizations.map(org => {
        const contributorCount = org.contributors ? org.contributors.length : 0;
        const roundsRun = org.rounds ? org.rounds.length : 0;
        const completedRoundsWithTx = org.rounds ?
            org.rounds.filter(round => round.isCompleted && round.txHash).length : 0;
        // Aggregate agreements from contributors (if any)
        const agreements = org.contributors ? org.contributors.filter(u => u.agreement).map(u => u.agreement) : [];

        // Get admin information (assuming at least one contributor has isAdmin === true)
        const adminUsers = org.contributors ? org.contributors.filter(u => u.isAdmin) : [];
        const admin = adminUsers[0] || {};

        return {
            orgName: org.name,
            contributorCount,
            createdOn: org.createdOn,
            roundsRun,
            completedRoundsWithTx,
            agreementCount: agreements.length,
            adminEmail: admin.email || '',
            adminName: admin.username || '',
            adminTelegram: admin.telegramHandle || '',
            compensationPeriod: org.compensationPeriod,
            compensationStartDay: org.compensationStartDay,
            assessmentDurationInDays: org.assessmentDurationInDays,
            assessmentStartDelayInDays: org.assessmentStartDelayInDays,
            par: org.par
        };
    });

    return data;
}

// Generate the organization CSV export
async function exportOrgCSVReport(): Promise<void> {
    const data = await fetchOrgReportData();
    orgCsvWriter.writeRecords(data)
        .then(() => console.log('Organization CSV export complete.'));
}

// ================================================
// User Export Sorted by Organization with Agreements
// ================================================

// Define CSV file structure for users with agreement details
const userCsvWriter = createObjectCsvWriter({
    path: 'user-export-report.csv',
    header: [
        { id: 'organizationName', title: 'Organization' },
        { id: 'email', title: 'Email' },
        { id: 'username', title: 'Name' },
        { id: 'registeredOn', title: 'Registered On' },
        { id: 'telegramHandle', title: 'Telegram Handle' },
        { id: 'roleName', title: 'Role Name' },
        { id: 'responsibilities', title: 'Responsibilities' },
        { id: 'marketRate', title: 'Market Rate' },
        { id: 'fiatRequested', title: 'Fiat Requested' },
        { id: 'commitment', title: 'Commitment' }
    ]
});

// Fetch and process user data
async function fetchUserReportData(): Promise<any[]> {
    // Retrieve all users along with their organization and agreement
    const users = await AppDataSource.manager.find(User, {
        relations: ['organization', 'agreement']
    });

    // Sort users by their organization's name (if available)
    users.sort((a, b) => {
        const orgA = a.organization ? a.organization.name.toLowerCase() : '';
        const orgB = b.organization ? b.organization.name.toLowerCase() : '';
        return orgA.localeCompare(orgB);
    });

    const data = users.map(user => ({
        organizationName: user.organization ? user.organization.name : 'No Organization',
        email: user.email,
        username: user.username,
        telegramHandle: user.telegramHandle || '',
        roleName: user.agreement ? user.agreement.roleName : '',
        responsibilities: user.agreement ? user.agreement.responsibilities : '',
        marketRate: user.agreement ? user.agreement.marketRate : '',
        fiatRequested: user.agreement ? user.agreement.fiatRequested : '',
        commitment: user.agreement ? user.agreement.commitment : ''
    }));

    return data;
}

// Generate the user CSV export
async function exportUserCSVReport(): Promise<void> {
    const data = await fetchUserReportData();
    userCsvWriter.writeRecords(data)
        .then(() => console.log('User CSV export complete.'));
}

// Run both exports (you can run them independently if desired)
AppDataSource.initialize().then(() => {
    exportOrgCSVReport();
    exportUserCSVReport();
}
);
// ================================================
// End of Export Script
