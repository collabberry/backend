import mongoose, { Document, Schema } from 'mongoose';

interface IAssessment extends Document {
    contributorId: string;
    roundId: string;
    cultureScore: number;
    workScore: number;
    feedbackPositive: string;
    feedbackNegative: string;
}

const AssessmentSchema: Schema = new Schema({
    contributorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },  // User who is being assessed
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },  // Reference to the round
    cultureScore: { type: Number, required: true, min: 0, max: 10 },  // Example score range (customize)
    workScore: { type: Number, required: true, min: 0, max: 10 },
    feedbackPositive: { type: String, required: true },
    feedbackNegative: { type: String, required: true }
});

const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
export default Assessment;
