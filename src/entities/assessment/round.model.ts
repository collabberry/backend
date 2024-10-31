import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Relation } from 'typeorm';
import { Organization } from '../org/organization.model.js';
import { Assessment } from './assessment.model.js';

@Entity('rounds')
export class Round {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Organization, (organization) => organization.rounds, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<Organization>;

    @Column({ type: 'int' })
    roundNumber!: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    startDate!: Date;

    @Column({ type: 'timestamp', nullable: true })
    endDate?: Date;

    @OneToMany(() => Assessment, (assessment) => assessment.round, { cascade: true })
    assessments!: Relation<Assessment[]>;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'int', default: 7 })
    assessmentDurationInDays!: number;
}
