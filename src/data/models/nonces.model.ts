import mongoose, { Document, Schema } from 'mongoose';

interface IWalletNonce extends Document {
    address: string;
    nonce: string;
    createdAt: Date;
}

const WalletNonceSchema: Schema = new Schema({
    address: { type: String, required: true },
    nonce: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 }  // Nonce expires in 5 minutes
});

const WalletNonce = mongoose.model<IWalletNonce>('WalletNonce', WalletNonceSchema);
export default WalletNonce;
