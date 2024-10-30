import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Organization } from './organization.model.js';
import { User } from '../users/user.model.js';

@Entity('invitations')
export class Invitation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    token!: string;

    @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Organization;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'invited_by' })
    invitedBy!: User;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'int', default: 0 })
    usageCount!: number;

    @Column({ type: 'int', default: 10 })
    usageLimit!: number;
}
