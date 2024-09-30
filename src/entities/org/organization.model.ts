import mongoose, { Document, Schema } from 'mongoose';
import { Cycle } from './cycle.enum.js';

interface IOrganization extends Document {
    name: string;
    logo?: string;
    par: number;
    cycle: Cycle;
    startDate: Date;
}

const OrganizationSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    logo: { type: String, required: false },
    par: { type: Number, required: true, default: 20, min: 1, max: 100 },
    cycle: { type: Number, required: true, default: 3, enum: Cycle },
    startDate: {
        type: Date, required: true, default: () => {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), 1);
        }
    }
});

const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
export default Organization;
