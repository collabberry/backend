import mongoose, { Document, Schema } from 'mongoose';

interface IRound extends Document {
    organizationId: string;
    roundNumber: number;
    startDate: Date;
    endDate?: Date;
    assessments: mongoose.Types.ObjectId[];
    isActive: boolean;
    assessmentDurationInDays: number;
}

const RoundSchema: Schema = new Schema({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    roundNumber: { type: Number, required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    assessments: [{ type: Schema.Types.ObjectId, ref: 'Assessment' }],
    isActive: { type: Boolean, required: true, default: true },
    assessmentDurationInDays: { type: Number, required: true, default: 7 }
});

const Round = mongoose.model<IRound>('Round', RoundSchema);
export default Round;
