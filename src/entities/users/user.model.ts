import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, Relation } from 'typeorm';
import { Agreement } from '../org/agreement.model.js';
import { Organization } from '../org/organization.model.js';

@Entity('Users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    address!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    telegramHandle?: string;

    @Column({ type: 'varchar', length: 255 })
    username!: string;

    @Column({ type: 'varchar', nullable: true })
    profilePicture?: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    registeredOn!: Date;

    @OneToOne(() => Agreement, { nullable: true, cascade: true })
    @JoinColumn({ name: 'agreement_id' })
    agreement?: Relation<Agreement>;

    @Column({ type: 'boolean', default: false })
    isAdmin!: boolean;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<Organization>;
}
