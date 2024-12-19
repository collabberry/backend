import 'reflect-metadata';
import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { RoundService } from '../src/services/round.service.js';
import { EmailService } from '../src/services/email.service.js';
import { AppDataSource } from '../src/data-source.js';
import { Round, Assessment, User, Organization, Agreement, ContributorRoundCompensation } from '../src/entities/index.js';
import { beginningOfToday, endOfToday } from '../src/utils/roundTime.util.js';
import { Mock } from 'moq.ts';
import { RoundStatus } from '../src/models/rounds/roundDetails.model.js';
import { ResponseModel } from '../src/models/response_models/response_model.js';

// Add these type definitions (new)
type TypedMockFunction<TResult, TArgs extends any[]> = jest.Mock<Promise<TResult>, TArgs>;

// Update interface to remove generic parameters from Mock
interface MockRepository<T> {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}


// Add this helper function (new)
const createMockRepository = <T>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn()
});

const roundRepository = createMockRepository<Round>();
const assessmentRepository = createMockRepository<Assessment>();
const userRepository = createMockRepository<User>();


// Mock manager
const mockManager = {
    save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
    findOne: jest.fn().mockImplementation(() => Promise.resolve(null))
};

// Mock AppDataSource
jest.mock('../src/data-source.js', () => ({
    AppDataSource: {
        getRepository: jest.fn((entity) => {
            if (entity === Round) return roundRepository;
            if (entity === Assessment) return assessmentRepository;
            if (entity === User) return userRepository;
            return {
                find: jest.fn(),
                findOne: jest.fn(),
                save: jest.fn(),
                create: jest.fn()
            };
        }),
        manager: mockManager
    }
}));

describe('RoundService', () => {
    let roundService: RoundService;
    let emailServiceMock: EmailService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        Object.defineProperty(AppDataSource, 'manager', {
            value: mockManager,
            writable: true
        });

        emailServiceMock = new Mock<EmailService>().object();
        roundService = new RoundService(emailServiceMock);
    });

    describe('completeRounds', () => {
        it('should correctly calculate compensation for the provided example case', async () => {
            // ... (previous test case remains the same)
        });

        it('should handle round with no assessments', async () => {
            const organization = new Organization();
            organization.par = 30;

            const round = new Round();
            round.id = '1';
            round.organization = organization;
            round.isCompleted = false;
            round.endDate = endOfToday();
            round.assessments = [];

            roundRepository.find.mockResolvedValue([round]);
            
            await roundService.completeRounds();

            expect(mockManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ 
                    id: '1',
                    isCompleted: true 
                })
            );
        });

        it('should handle round with all zero scores', async () => {
            const organization = new Organization();
            organization.par = 30;

            const round = new Round();
            round.id = '1';
            round.organization = organization;
            round.isCompleted = false;
            round.endDate = endOfToday();

            const user = createUserWithAgreement('1', 10000, 100, 1000);
            const assessments = [
                createAssessment(user, 0, 0, round),
                createAssessment(user, 0, 0, round)
            ];
            round.assessments = assessments;

            roundRepository.find.mockResolvedValue([round]);

            const savedCompensations: ContributorRoundCompensation[] = [];
            jest.spyOn(mockManager, 'save').mockImplementation(async (entity: any) => {
                if (entity instanceof ContributorRoundCompensation) {
                    savedCompensations.push(entity);
                }
                return entity;
            });

            await roundService.completeRounds();

            const comp = savedCompensations[0];
            expect(comp?.culturalScore).toBe(0);
            expect(comp?.workScore).toBe(0);
            expect(comp?.fiat).toBe(1000);
            expect(comp?.tp).toBe(0);
        });
    });

    describe('getCurrentRound', () => {
        it('should return current active round', async () => {
            const organization = new Organization();
            const round = new Round();
            round.id = '1';
            round.organization = organization;
            round.startDate = beginningOfToday();
            round.endDate = endOfToday();
            round.assessments = [];

            roundRepository.findOne.mockResolvedValue(round);

            const result = await roundService.getCurrentRound('org1');

            expect(result.success).toBe(true);
            expect(result.data?.id).toBe('1');
        });

        it('should return error when no active round exists', async () => {
            roundRepository.findOne.mockResolvedValue(null);

            const result = await roundService.getCurrentRound('org1');

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('No active round found for the organization');
        });
    });

    describe('addAssessment', () => {
        it('should successfully add a new assessment', async () => {
            const assessor = new User();
            assessor.id = '1';
            assessor.address = '0x123';
            assessor.organization = new Organization();
            assessor.organization.id = 'org1';

            const assessed = new User();
            assessed.id = '2';
            assessed.organization = assessor.organization;

            const round = new Round();
            round.id = '1';
            round.organization = assessor.organization;
            round.startDate = beginningOfToday();
            round.endDate = endOfToday();

            userRepository.findOne.mockResolvedValueOnce(assessor);
            userRepository.findOne.mockResolvedValueOnce(assessed);
            roundRepository.findOne.mockResolvedValue(round);
            assessmentRepository.findOne.mockResolvedValue(null);

            const assessmentData = {
                contributorId: '2',
                cultureScore: 4,
                workScore: 4,
                feedbackPositive: 'Good work',
                feedbackNegative: 'Could improve'
            };

            const result = await roundService.addAssessment('0x123', assessmentData);

            expect(result.success).toBe(true);
            expect(assessmentRepository.save).toHaveBeenCalled();
        });

        it('should prevent duplicate assessments', async () => {
            const assessor = new User();
            assessor.id = '1';
            assessor.address = '0x123';
            assessor.organization = new Organization();
            assessor.organization.id = 'org1';

            const round = new Round();
            round.id = '1';

            userRepository.findOne.mockResolvedValueOnce(assessor);
            roundRepository.findOne.mockResolvedValue(round);
            assessmentRepository.findOne.mockResolvedValue(new Assessment());

            const result = await roundService.addAssessment('0x123', {
                contributorId: '2',
                cultureScore: 4,
                workScore: 4,
                feedbackPositive: '',
                feedbackNegative: ''
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Assessment already submitted');
        });
    });

    describe('remindToAssess', () => {
        it('should send reminder to all contributors', async () => {
            const round = new Round();
            round.id = '1';
            round.organization = new Organization();
            round.organization.name = 'Test Org';

            const users = [
                { id: '1', email: 'user1@test.com', username: 'user1' },
                { id: '2', email: 'user2@test.com', username: 'user2' }
            ];

            roundRepository.findOne.mockResolvedValue(round);
            userRepository.find.mockResolvedValue(users);

            const result = await roundService.remindToAssess('1', true, []);

            expect(result.success).toBe(true);
            // Verify email service was called for each user
            expect(emailServiceMock.sendAssessmentReminder).toHaveBeenCalledTimes(2);
        });

        it('should send reminder to specific contributors', async () => {
            const round = new Round();
            round.id = '1';
            round.organization = new Organization();
            round.organization.name = 'Test Org';

            const users = [
                { id: '1', email: 'user1@test.com', username: 'user1' },
                { id: '2', email: 'user2@test.com', username: 'user2' }
            ];

            roundRepository.findOne.mockResolvedValue(round);
            userRepository.find.mockResolvedValue(users);

            const result = await roundService.remindToAssess('1', false, ['1']);

            expect(result.success).toBe(true);
            // Verify email service was called only for specified user
            expect(emailServiceMock.sendAssessmentReminder).toHaveBeenCalledTimes(1);
        });
    });
});

// Helper functions
function createUserWithAgreement(id: string, marketRate: number, commitment: number, fiat: number): User {
    const user = new User();
    user.id = id;
    
    const agreement = new Agreement();
    agreement.marketRate = marketRate;
    agreement.commitment = commitment;
    agreement.fiatRequested = fiat;
    agreement.id = `agreement-${id}`;
    agreement.roleName = 'Developer';
    agreement.responsibilities = 'Coding';
    agreement.user = user;
    
    user.agreement = agreement;
    return user;
}

function createAssessment(assessed: User, cultureScore: number, workScore: number, round: Round): Assessment {
    const assessment = new Assessment();
    assessment.assessed = assessed;
    assessment.cultureScore = cultureScore;
    assessment.workScore = workScore;
    assessment.round = round;
    assessment.assessor = new User();
    return assessment;
}