import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { User } from '../users/user.model.js';
import { Round } from './round.model.js';

@Entity('contributor_round_compensations')
export class ContributorRoundCompensation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'contributor_id' })
    contributor!: Relation<User>;

    @ManyToOne(() => Round, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'round_id' })
    round!: Relation<Round>;

    @Column({ type: 'float' })
    culturalScore!: number;

    @Column({ type: 'float' })
    workScore!: number;

    @Column({ type: 'decimal' })
    fiat!: number;

    @Column({ type: 'int' })
    tp!: number;

    @Column({ type: 'decimal' })
    agreement_fiat!: number;

    @Column({ type: 'decimal' })
    agreement_mr!: number;

    @Column({ type: 'decimal' })
    agreement_commitment!: number;


}
