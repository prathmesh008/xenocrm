import mongoose, { Schema, model, Model } from 'mongoose';

interface IOrder {
  customerId: string;
  amount: number;
  date: Date;
}

const OrderSchema = new Schema<IOrder>({
  customerId: { type: String, required: true, ref: 'Customer' },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
});

const Order: Model<IOrder> = mongoose.models.Order || model<IOrder>('Order', OrderSchema);

export default Order;