import mongoose, { Schema, Document } from 'mongoose';

export interface ISegment extends Document {
  name: string;
  description?: string;
  filter: Record<string, any>;
  messageContent?: string;
  campaignId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  filter: {
    type: Schema.Types.Mixed,
    required: [true, 'Filter criteria is required']
  },
  messageContent: {
    type: String
  },
  campaignId: {
    type: String,
  }
}, { timestamps: true });

// Add indexes for better query performance
SegmentSchema.index({ name: 1 });
SegmentSchema.index({ campaignId: 1 });

delete mongoose.models['Segment'];
export const Segment = mongoose.model<ISegment>('Segment', SegmentSchema);
export default Segment;