const multer = require('multer');
const Message = require('../models/messageModel');
const File = require('../models/fileModel');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
sharp.cache(false);
const { WebSocketServer } = require('ws');
const { sendFcmNotification } = require('./notificationControllers');
const User = require('../models/userModel');


// Tạo danh sách lưu trữ user đang online
const onlineUsers = new Set();

// WebSocket server
const initSocket = (http) => {
    const sockserver = new WebSocketServer({ server: http });
    sockserver.on('connection', ws => {
        console.log('New client connected!')
        ws.send('connection established')
        ws.on('close', () => {
            console.log('Client has disconnected!');
            if (ws.userId) {
                onlineUsers.delete(ws.userId);
                broadcastOnlineUsers();
            }
        })
        ws.onerror = function () {
            console.log('websocket error')
        }
        ws.on('message', async (data) => {
            try {
                const mess = JSON.parse(data);

                switch (mess.type) {
                    case 'send':
                        await handleSendMessage(mess);
                        break;
                    case 'fetch':
                        await handleFetchMessages(ws, mess);
                        break;
                    case 'last_message':
                        await handleFetchLastMessage(ws, mess);
                        break;
                    case 'check_online':
                        await handleCheckOnline(ws, mess);
                        break;
                    case 'login':
                        handleLogin(ws, mess);
                        break;
                    default:
                        console.log('Unknown message type:', mess.type);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Unknown message type'
                        }));
                        break;
                }
            } catch (error) {
                console.log('Error processing message:', error);
            }
        });

        // Xử lý đăng nhập và cập nhật trạng thái online
        function handleLogin(ws, message) {
            const { userId } = message;
            if (userId) {
                ws.userId = userId; // Gắn userId cho WebSocket
                onlineUsers.add(userId); // Thêm user vào danh sách online
                broadcastOnlineUsers(); // Gửi danh sách online tới tất cả các client
            }
        }

        // Xử lý kiểm tra trạng thái online của user
        async function handleCheckOnline(ws, message) {
            const { userIds } = message; // Danh sách userId cần kiểm tra
            if (!Array.isArray(userIds)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid userIds format'
                }));
                return;
            }

            // Kiểm tra trạng thái online
            const status = userIds.map((id) => ({
                userId: id,
                online: onlineUsers.has(id),
            }));

            ws.send(JSON.stringify({
                type: 'online_status',
                data: status
            }));
        }

        // Gửi danh sách user đang online tới tất cả các client
        function broadcastOnlineUsers() {
            const onlineList = Array.from(onlineUsers); // Chuyển Set thành Array
            sockserver.clients.forEach((client) => {
                if (client.readyState === 1) { // Kiểm tra client có kết nối không
                    client.send(JSON.stringify({
                        type: 'online_users',
                        data: onlineList
                    }));
                }
            });
        }

        async function handleSendMessage(mess) {
            const { sender, receiver, message, media } = mess;
            const newMessage = new Message({ sender, receiver, message, media });

            // Lưu tin nhắn mới vào cơ sở dữ liệu
            await newMessage.save();

            // Lấy FCM token của người nhận
            const receiverUser = await User.findById(receiver);
            const senderUser = await User.findById(sender);
            const nameSender = senderUser.username;
            if (receiverUser && receiverUser.fcm_token) {
                const fcmToken = receiverUser.fcm_token;
                const title = `New message from ${nameSender}`;  // Tạo tiêu đề thông báo
                const body = message;  // Nội dung thông báo

                // Gọi hàm gửi thông báo FCM cho người nhận
                try {
                    await sendFcmNotification(fcmToken, title, body, receiver);
                    console.log('FCM notification sent successfully');
                } catch (error) {
                    console.error('Error sending FCM notification:', error);
                }
            }

            // Broadcast tin nhắn mới cho các client qua WebSocket
            sockserver.clients.forEach(async (client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'new_message',
                        data: newMessage
                    }));
                }
            });
        }

        async function handleFetchMessages(ws, mess) {
            const { user1, user2 } = mess;

            const messages = await Message.find({
                $or: [
                    { sender: user1, receiver: user2 },
                    { sender: user2, receiver: user1 }
                ]
            }).sort({ createdAt: 1 });

            ws.send(JSON.stringify({
                type: 'history',
                data: messages
            }));
        }

        async function handleFetchLastMessage(ws, mess) {
            const { user1, user2 } = mess;

            try {
                // Tìm tin nhắn cuối cùng giữa hai người dùng
                const lastMessage = await Message.findOne({
                    $or: [
                        { sender: user1, receiver: user2 },
                        { sender: user2, receiver: user1 }
                    ]
                }).sort({ createdAt: -1 }); // Sắp xếp giảm dần để lấy tin nhắn mới nhất
                let responseData = lastMessage;

                if (lastMessage && lastMessage.media) {
                    // Nếu có media, trả về thông báo "Sent an image"
                    responseData = {
                        "sender": lastMessage.sender,
                        "receiver": lastMessage.receiver,
                        "message": "Sent an image",
                        "media": lastMessage.media,
                        "createdAt": lastMessage.createdAt
                    }
                }
                // Gửi lại cho client
                ws.send(JSON.stringify({
                    type: 'last_message',
                    data: responseData || null
                }));
            } catch (error) {
                console.log('Error fetching last message:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Error fetching last message'
                }));
            }
        }
    })
}

module.exports = initSocket;


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const randomString = crypto.randomBytes(6).toString('hex'); // 6 bytes => 12 ký tự hex
        const uniqueName = `${Date.now()}-${randomString}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });

module.exports.sendMedia = [
    upload.single('file'),
    async (req, res) => {
        if (!req.file) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        const fileTypeMapping = {
            'images': ['image/jpeg', 'image/png', 'image/gif', 'application/octet-stream'],
            'videos': ['video/mp4', 'video/mkv', 'video/avi'],
            'audios': ['audio/mpeg', 'audio/wav'],
            'documents': ['application/pdf', 'application/msword'],
        };

        let folder = null;

        for (const [key, mimeTypes] of Object.entries(fileTypeMapping)) {
            if (mimeTypes.includes(req.file.mimetype)) {
                folder = key;
                break;
            }
        }

        if (!folder) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
            return res.status(400).json({ success: false, error: 'Invalid file type' });
        }

        const uploadDir = path.join(__dirname, `../uploads/${folder}`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        let filePath = `${req.protocol}://${req.get('host')}/uploads/${folder}/${req.file.filename}`;

        if (folder === 'images') {
            try {
                const extname = path.extname(req.file.originalname).toLowerCase();
                const outputFilename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extname}`;
                const outputPath = path.join(__dirname, `../uploads/${folder}/${outputFilename}`);

                await sharp(req.file.path)
                    .resize({ width: 800 })
                    .jpeg({ quality: 70 })
                    .toFile(outputPath);

                await fs.promises.unlink(req.file.path);

                filePath = `${req.protocol}://${req.get('host')}/uploads/${folder}/${outputFilename}`;
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Image processing failed' });
            }
        } else if (folder === 'videos') {
            try {
                const outputFilename = `compressed-${req.file.filename}`;
                const outputPath = path.join(__dirname, `../uploads/${folder}/${outputFilename}`);

                await new Promise((resolve, reject) => {
                    ffmpeg(req.file.path)
                        .output(outputPath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .videoBitrate('500k')
                        .audioBitrate('96k')
                        .size('1280x720')
                        .outputOptions(['-crf', '30', '-preset', 'medium'])
                        .on('end', async () => {
                            fs.unlink(req.file.path, (err) => {
                                if (err) console.error('Error deleting original video:', err);
                            });
                            filePath = `${req.protocol}://${req.get('host')}/uploads/${folder}/${outputFilename}`;
                            resolve();
                        })
                        .on('error', reject)
                        .run();
                });
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Video compression failed' });
            }
        } else {
            const newFilePath = path.join(uploadDir, req.file.filename);
            fs.renameSync(req.file.path, newFilePath);
        }

        try {
            const newFile = await File.create({ filePath, fileType: folder });
            return res.status(200).json({ success: true, file: newFile });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
    },
];