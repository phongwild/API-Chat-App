const mongoose = require('mongoose');
const User = require('../models/userModel'); // Đảm bảo đường dẫn đúng với file chứa model User
require('dotenv').config();


mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

const seedUsers = async () => {
    try {
        // await User.deleteMany(); // Xóa toàn bộ dữ liệu cũ (nếu có)

        const users = Array.from({ length: 50 }, (_, i) => ({
            username: `user${i + 1}`,
            email: `user${i + 1}@gmail.com`,
            avatar: `https://api-chat-app-tqym.onrender.com/uploads/images/1737081602770-5b127fc20873.jpg`,
            password: "$2a$10$yVqGg1Xb0Qg6m2HKYGGXtenJAHqilSXO99b4QBAz.2pQWRUiUktKW",
            friends: [],
            request_friends: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));

        await User.insertMany(users);
        console.log('50 sample users added!');
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        mongoose.connection.close();
    }
};

seedUsers();
