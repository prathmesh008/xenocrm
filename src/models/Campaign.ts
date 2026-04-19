import mongoose, { Schema, model, Model } from 'mongoose';

  export   interface ICampaign {
       userId: string;
       name: string;
       audienceSize: number;
       sentCount: number;
       failedCount: number;
       createdAt: Date;
       customers: string[];
       tag: string
     }

     const CampaignSchema = new Schema<ICampaign>({
       userId: { type: String, required: true },
       name: { type: String, required: true },
       audienceSize: { type: Number, required: true, min: 0 },
       sentCount: { type: Number, required: true, min: 0 },
       failedCount: { type: Number, required: true, min: 0 },
       createdAt: { type: Date, default: Date.now },
       tag:{type:String, required:true},
       customers: [{ type: String, ref: 'Customer' }],
     });

     const Campaign: Model<ICampaign> = mongoose.models.Campaign || model<ICampaign>('Campaign', CampaignSchema);

     export default Campaign;