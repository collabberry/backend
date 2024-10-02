import mongoose, { Document, Schema } from 'mongoose';

interface IAgreement extends Document {
    user: mongoose.Schema.Types.ObjectId;  // Reference to the User
    organization: mongoose.Schema.Types.ObjectId;  // Reference to the Organization
    roleName: string;
    responsibilities: string;
    marketRate: number;
    fiatRequested: number;
    commitment: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const AgreementSchema: Schema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    roleName: { type: String, required: true },
    responsibilities: { type: String, required: true },
    marketRate: { type: Number, required: true },
    fiatRequested: { type: Number, required: true },
    commitment: { type: Number, required: true, min: 1, max: 100 }
});

// eslint-disable-next-line @typescript-eslint/naming-convention
const Agreement = mongoose.model<IAgreement>('Agreement', AgreementSchema);
export default Agreement;
