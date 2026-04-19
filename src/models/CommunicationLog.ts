import mongoose, { Schema, model, Model, Document } from 'mongoose';

interface ICommunicationLog extends Document {
  customerId: string;
  segmentId?: string;
  campaignId?: string;
  message: string;
  status: string;
  timestamp: Date;
}

const CommunicationLogSchema = new Schema<ICommunicationLog>({
  customerId: { type: String, required: true, ref: 'Customer', index: true },
  segmentId:  { type: String, index: true },
  campaignId: { type: String, index: true },
  message:    { type: String, required: true },
  status:     { type: String, required: true, index: true },
  timestamp:  { type: Date, required: true },
}, { timestamps: true });

CommunicationLogSchema.index({ customerId: 1, campaignId: 1 });

const CommunicationLog: Model<ICommunicationLog> =
  mongoose.models.CommunicationLog ||
  model<ICommunicationLog>('CommunicationLog', CommunicationLogSchema);

export default CommunicationLog;