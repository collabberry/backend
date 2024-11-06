import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Relation } from 'typeorm';
import { CompensationPeriod } from './cycle.enum.js';
import { Round } from '../assessment/round.model.js';
import { Agreement } from './agreement.model.js';
import { User } from '../users/user.model.js';

@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    name!: string;

    @Column({ type: 'varchar', nullable: true })
    logo?: string;

    @Column({ type: 'int', default: 20 })
    par!: number;

    @Column('enum', { enum: CompensationPeriod, nullable: true })
    compensationPeriod!: CompensationPeriod | null;

    @Column({ type: 'timestamp', nullable: true })
    compensationStartDay!: Date | null;

    @Column({ type: 'int', nullable: true })
    assessmentDurationInDays!: number | null;

    @Column({ type: 'int', nullable: true })
    assessmentStartDelayInDays!: number | null;

    @OneToMany(() => Round, (round) => round.organization, { cascade: true })
    rounds?: Relation<Round[]>;

    @OneToMany(() => User, (user) => user.organization, { cascade: false })
    contributors?: Relation<User[]>;

}
