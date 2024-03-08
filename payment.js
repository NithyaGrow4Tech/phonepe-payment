// payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    merchantTransactionId: { type: String, required: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
