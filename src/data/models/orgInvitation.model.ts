import mongoose, { Document, Schema } from 'mongoose';

interface IInvitation extends Document {
    token: string;
    organization: mongoose.Schema.Types.ObjectId;
    invitedBy: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    isActive: boolean;
    usageCount: number;  // Track the number of times the token has been used
    usageLimit: number;  // Maximum number of users that can register with this token (default: 10)
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const InvitationSchema: Schema = new Schema({
    token: { type: String, required: true, unique: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now, expires: '7d' },  // Automatically expire after 7 days
    isActive: { type: Boolean, default: true },  // Invitation is active by default
    usageCount: { type: Number, default: 0 },  // Initialize the usage count to 0
    usageLimit: { type: Number, default: 10 }  // Default limit of 10 users per link
});

// TTL Index for automatic expiration after 7 days
InvitationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const Invitation = mongoose.model<IInvitation>('Invitation', InvitationSchema);
export default Invitation;
