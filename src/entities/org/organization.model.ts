import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Relation } from 'typeorm';
import { Cycle } from './cycle.enum.js';
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

    @Column('enum', { enum: Cycle, default: Cycle.Monthly })
    cycle!: Cycle;

    @Column({ type: 'boolean', default: false })
    roundsActivated!: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    nextRoundDate!: Date;

    @OneToMany(() => Round, (round) => round.organization, { cascade: true })
    rounds?: Relation<Round[]>;

    @Column({ type: 'int', default: 7 })
    assessmentDurationInDays!: number;

    @OneToMany(() => User, (user) => user.organization, { cascade: false })
    contributors?: Relation<User[]>;

}
