const mongoose = require('mongoose');
const schema = mongoose.Schema;

const userSchema = new schema({
    username: {
        type: String,
        required: true,
        min: 6,
        max: 20,  // Giới hạn độ dài username
        trim: true,  // Loại bỏ khoảng trắng thừa
    },

    email: {
        type: String,
        required: true,
        unique: true,
        min: 6,
        max: 255,
        trim: true,  // Loại bỏ khoảng trắng thừa
        match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, // Kiểm tra email hợp lệ
    },

    avatar: {
        type: String,
        default: ''
    },

    password: {
        type: String,
        required: true,
        min: 8,
    },

    friends: [
        {
            type: schema.Types.ObjectId,
            ref: 'User',
        },
    ],

    sent_request_friends: [
        {
            type: schema.Types.ObjectId,
            ref: 'User',
        },
    ],

    received_request_friends: [
        {
            type: schema.Types.ObjectId,
            ref: 'User',
        },
    ],

    fcm_token: {
        type: String,
        required: false,
    },

}, { timestamps: true });  // Thêm `timestamps` để tự động thêm `createdAt` và `updatedAt`

module.exports = mongoose.model('User', userSchema);
