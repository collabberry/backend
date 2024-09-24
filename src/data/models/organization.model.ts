import mongoose, { Document, Schema } from 'mongoose';

interface IOrganization extends Document {
    name: string;
    logo?: string;
    par: number;
}

const OrganizationSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    logo: { type: String, required: false },
    par: { type: Number, required: true, default: 20, min: 1, max: 100 }
});

const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
export default Organization;
