const Message = require('../models/messageModel');

const handleSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('connect_error', (err) => {
            console.error('Socket connect error:', err.message);
        });

        // Lấy tin nhắn giữa hai người qua socket
        socket.on('getmessages', async ({ user1, user2 }) => {
            if (!user1 || !user2) {
                return socket.emit('messages-error', { error: 'Thiếu thông tin user1 hoặc user2!' });
            }

            try {
                const messages = await Message.find({
                    $or: [
                        { sender: user1, receiver: user2 },
                        { sender: user2, receiver: user1 },
                    ],
                }).sort({ createdAt: 1 }); // Sắp xếp theo thời gian

                // Gửi danh sách tin nhắn lại cho client
                socket.emit('messages-data', { success: true, data: messages });
            } catch (error) {
                socket.emit('messages-error', { error: 'Lỗi khi lấy tin nhắn!' });
            }
        });

        // Sự kiện gọi video
        socket.on('call-user', (data) => {
            io.to(data.to).emit('call-made', {
                offer: data.offer,
                from: socket.id,
            });
        });

        socket.on('make-answer', (data) => {
            io.to(data.to).emit('answer-made', {
                answer: data.answer,
                from: socket.id,
            });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
}

module.exports = handleSocket;