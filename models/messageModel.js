const mongoose = require('mongoose');
const schema = mongoose.Schema;

const MessageSchema = new schema({
    sender: { type: schema.ObjectId, ref: 'User', required: true },
    receiver: { type: schema.ObjectId, ref: 'User', required: true },
    message: { type: String, required: false }, // Message text, optional
    media: { type: String }, // Đường dẫn file (nếu có)
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'document'], required: false }, // Loại file
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
