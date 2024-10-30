import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, Relation } from 'typeorm';
import { User } from '../users/user.model.js';
import { Organization } from './organization.model.js';

@Entity('agreements')
export class Agreement {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<User>;

    @Column({ type: 'varchar', length: 255 })
    roleName!: string;

    @Column({ type: 'text' })
    responsibilities!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    marketRate!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    fiatRequested!: number;

    @Column({ type: 'int', width: 3 })
    commitment!: number;
}
