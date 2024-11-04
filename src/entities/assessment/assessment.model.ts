import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { User } from '../users/user.model.js';
import { Round } from './round.model.js';

@Entity('assessments')
export class Assessment {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'assessor_id' })
    assessor!: Relation<User>;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'assessed_id' })
    assessed!: Relation<User>;

    @ManyToOne(() => Round, (round) => round.assessments, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'round_id' })
    round!: Relation<Round>;

    @Column({ type: 'int', width: 2, nullable: true })
    cultureScore?: number | null;

    @Column({ type: 'int', width: 2, nullable: true })
    workScore?: number | null;

    @Column({ type: 'text' })
    feedbackPositive?: string | null;

    @Column({ type: 'text' })
    feedbackNegative?: string | null;
}
