import mongoose, { Document, Schema } from 'mongoose';
import { Role } from './role.enum.js';

interface IOrganizationDetails {
    orgId: mongoose.Schema.Types.ObjectId;  // Reference to the organization
    roles: Role[];  // Roles within that organization
    agreement?: mongoose.Schema.Types.ObjectId;  // Agreement specific to this organization
}

export interface IUser extends Document {
    address: string;
    email: string;
    username: string;
    profilePicture?: string;
    organization?: IOrganizationDetails;
}

const UserSchema: Schema = new Schema({
    address: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    profilePicture: { type: String },
    organization: {
        type: Object, required: false, default: undefined, properties: {
            orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
            roles: {
                type: [Number],
                enum: [1, 2],
                default: [Role.Contributor]
            },
            agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'Agreement', required: false }
        }
    }
});

const User = mongoose.model<IUser>('User', UserSchema);
export default User;
