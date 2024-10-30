import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('WalletNonce')
export class WalletNonce {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    address!: string;

    @Column({ type: 'varchar', length: 255 })
    nonce!: string;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;
}

// Custom repository function to handle nonce expiration logic
export const checkNonceExpiration = async (walletNonce: WalletNonce): Promise<boolean> => {
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (new Date().getTime() - walletNonce.createdAt.getTime()) < FIVE_MINUTES;
};
