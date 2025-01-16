import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Relation } from 'typeorm';
import { Organization } from '../org/organization.model.js';
import { Assessment } from './assessment.model.js';

@Entity('rounds')
export class Round {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    roundNumber!: number;

    @Column({ type: 'boolean', default: false})
    isCompleted!: boolean;

    @Column({ type: 'timestamp' })
    startDate!: Date;

    @Column({ type: 'timestamp' })
    endDate!: Date;

    @Column({ type: 'varchar', nullable: true })
    txHash!: string | null;

    @Column({ type: 'timestamp', nullable: false })
    compensationCycleStartDate!: Date;

    @Column({ type: 'timestamp', nullable: false })
    compensationCycleEndDate!: Date;

    @OneToMany(() => Assessment, (assessment) => assessment.round, { cascade: true })
    assessments!: Relation<Assessment[]>;

    @ManyToOne(() => Organization, (organization) => organization.rounds, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<Organization>;

}
