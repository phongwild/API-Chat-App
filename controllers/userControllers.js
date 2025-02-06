const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Mailgen = require('mailgen');
const sendOtp = require('../utils/sendOTP');
const { default: mongoose } = require('mongoose');
const { sendFcmNotification } = require('./notificationControllers');
const otpModel = require('../models/otpModel');

let otpRateLimit = {}; // Lưu số lần gửi OTP
const OTP_THROTTLE_TIME = 30 * 1000; // 30 giây
const OTP_RATE_LIMIT = 5; // 3 lần gửi trong 1 giờ
const OTP_RATE_LIMIT_TIME = 60 * 60 * 1000; // 1 giờ

module.exports.getAllUser = async (req, res) => {
    const users = await User.find();
    res.json(users);
}

module.exports.getUsers = async (req, res) => {
    try {
        const { search, uid } = req.query;
        let users;

        if (!uid) {
            return res.status(400).json({ message: 'Missing user ID' });
        }

        if (search) {
            // const isObjectId = mongoose.Types.ObjectId.isValid(search);
            users = await User.find({
                $and: [
                    { _id: { $ne: uid } }, // Loại trừ người tìm kiếm
                    {
                        $or: [
                            { username: { $regex: search, $options: 'i' } },
                            { email: { $regex: search, $options: 'i' } }
                        ]
                    }
                ]
            });
        } else {
            users = await User.find({ _id: { $ne: uid } });
        }
        res.status(200).json(users);
    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({ message: `Internal server error + ${error}` });
    }
}

module.exports.login = async (req, res) => {
    let { email, password } = req.body;
    if (!email || !password) res.status(400).json('missing fields');
    else {
        email = email.toLowerCase();
        const user = await User.findOne({ email: email });
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ id: user._id }, `${process.env.SECRET}`, { expiresIn: '30d' });
            res.cookie('jwt', token, { signed: true, httpOnly: true, maxAge: 1000 * 60 * 60 }).json(user);
        }
        else {
            res.status(400).json('login failed');
        }
    }
}

module.exports.register = async (req, res) => {
    let { username, email, password } = req.body;
    email = email.toLowerCase();
    const registeredEmail = await User.findOne({ email: email });

    if (registeredEmail) {
        return res.status(400).json('Email already exists');
    }

    // Kiểm tra rate limit
    const currentTime = Date.now();
    if (otpRateLimit[email]) {
        const { count, lastRequestTime } = otpRateLimit[email];

        // Quá giới hạn rate limit
        if (count >= OTP_RATE_LIMIT && currentTime - lastRequestTime < OTP_RATE_LIMIT_TIME) {
            return res.status(429).json('Too many OTP requests. Please try again later.');
        }

        // Throttle: Kiểm tra khoảng cách 30 giây giữa 2 lần gửi OTP
        if (currentTime - lastRequestTime < OTP_THROTTLE_TIME) {
            return res.status(429).json(`Please wait ${Math.ceil((OTP_THROTTLE_TIME - (currentTime - lastRequestTime)) / 1000)} seconds before requesting another OTP.`);
        }
    }

    // Tạo mã OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5 phút
    await otpModel.findOneAndUpdate(
        { email, username, password },
        { otp, expiresAt },
        { upsert: true, new: true }
    )

    // Cập nhật rate limit
    otpRateLimit[email] = otpRateLimit[email] || { count: 0, lastRequestTime: 0 };
    otpRateLimit[email].count += 1;
    otpRateLimit[email].lastRequestTime = currentTime;

    // Gửi OTP qua email
    try {
        const result = await sendOtp(email, username, otp);
        if (result.success) {
            return res.status(200).json('OTP sent to email!');
        } else {
            return res.status(500).json({ message: 'Failed to send OTP', error: result.error });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json('Internal server error');
    }
};

//Verify otp
module.exports.verifyOtp = async (req, res) => {
    let { email, otp } = req.body;
    email = email.toLowerCase();

    // Kiểm tra email có trong OTP storage không
    const userOtp = await otpModel.findOne({ email });
    if (!userOtp) {
        return res.status(400).json('Invalid or expired OTP');
    }

    // Kiểm tra OTP có đúng không
    if (userOtp.otp !== otp) {
        return res.status(400).json('Incorrect OTP. Please try again.');
    }

    // Kiểm tra OTP đã hết hạn chưa
    if (userOtp.expiresAt < Date.now()) {
        await otpModel.deleteOne({ email });
        return res.status(400).json('OTP expired. Please request a new one.');
    }

    // Nếu OTP hợp lệ, đăng ký tài khoản
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(userOtp.password, salt);

    const avatar = `${req.protocol}://${req.get('host')}/uploads/images/1737081602770-5b127fc20873.jpg`;

    await User.create({ username: userOtp.username, email: userOtp.email, password: hash, avatar: avatar });

    // Xóa OTP khỏi storage và rate limit
    await otpModel.deleteOne({ email });
    delete otpRateLimit[email];

    res.status(201).json('Registration successful');
};

module.exports.logout = (req, res) => {
    res.clearCookie('jwt').json('logout');
};

module.exports.profile = async (req, res) => {
    const token = req.signedCookies.jwt;
    if (token) {
        const decoded = jwt.verify(token, `${process.env.SECRET}`);
        const user = await User.findById(decoded.id);
        res.json(user);
    }
    else {
        res.status(400).json('no token');
    }
}

module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email: email });
    if (user) {
        const secret = `${process.env.SECRET}${user.password}`;
        const token = jwt.sign({ id: user._id }, secret, { expiresIn: '5m' });

        // Configure nodemailer with Gmail service
        let config = {
            service: 'gmail',
            auth: {
                user: `${process.env.EMAIL}`,
                pass: `${process.env.PASSWORD}`
            }
        };

        let transporter = nodemailer.createTransport(config);

        // Create email body using Mailgen
        let MailGenerator = new Mailgen({
            theme: 'default',
            product: {
                name: 'Netflix API',
                link: 'https://mailgen.js/'
            }
        });

        var response = {
            body: {
                name: user.username, // Use user's name to personalize
                intro: 'We received a request to reset the password for your account.',
                action: {
                    instructions: 'To reset your password, please click the button below:',
                    button: {
                        color: '#4CAF50', // Green button for better contrast
                        text: 'Reset Password',
                        link: `${req.protocol}://${req.get('host')}/user/resetpassword/${user._id}/${token}`
                    }
                },
                outro: 'If you didn’t request a password reset, please ignore this email. Your password will remain unchanged.',
                signature: 'Best regards, Netflix API'
            }
        };

        // Generate email HTML content
        var emailBody = MailGenerator.generate(response);

        let message = {
            from: `${process.env.EMAIL}`,
            to: `${email}`,
            subject: 'Password Reset Request',
            html: emailBody
        };

        transporter.sendMail(message)
            .then(() => res.status(201).json('Email sent successfully!'))
            .catch((err) => res.status(400).json({ message: 'Error sending email', error: err }));

    } else {
        res.status(400).json('Email not registered');
    }
};

module.exports.resetPassword = async (req, res) => {
    const { id, token } = req.params;
    const { password } = req.body;
    const oldUser = await User.findById(id);
    if (!oldUser) {
        res.status(400).json('user not found');
    }
    else {
        const secret = `${process.env.SECRET}${oldUser.password}`;
        if (jwt.verify(token, secret)) {
            oldUser.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
            await oldUser.save();
            res.json('password changed');
        }
        else {
            res.status(400).json('invalid token');
        }
    }

}

module.exports.sendFriendRequest = async (req, res) => {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
        return res.status(400).json({ success: false, error: 'Missing sender or receiver' });
    }

    try {
        // Tìm người dùng A (sender) và người dùng B (receiver)
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        if (!sender || !receiver) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Kiểm tra nếu đã là bạn hoặc đã có yêu cầu kết bạn
        if (sender.friends.includes(receiverId)) {
            return res.status(400).json({ success: false, error: 'Already friends' });
        }
        if (sender.sent_request_friends.includes(receiverId)) {
            return res.status(400).json({ success: false, error: 'Request already sent' });
        }
        // Nếu người gửi đã nhận được yêu cầu từ người nhận (2 chiều gửi yêu cầu) thì tự động xác nhận
        if (sender.received_request_friends.includes(receiverId)) {
            // Xóa yêu cầu đã tồn tại
            sender.received_request_friends = sender.received_request_friends.filter(id => id.toString() !== receiverId.toString());
            receiver.sent_request_friends = receiver.sent_request_friends.filter(id => id.toString() !== senderId.toString());
            // Thêm nhau vào danh sách bạn bè
            sender.friends.push(receiverId);
            receiver.friends.push(senderId);

            await sender.save();
            await receiver.save();

            // Gửi thông báo cho cả hai bên (nếu cần)
            if (sender.fcm_token) {
                await sendFcmNotification(sender.fcm_token, `${receiver.username} accepted your friend request.`, 'You are now friends!', sender);
            }
            if (receiver.fcm_token) {
                await sendFcmNotification(receiver.fcm_token, `You and ${sender.username} are now friends!`, 'Friend added', receiver);
            }
            return res.status(200).json({ success: true, message: 'Friend request auto accepted' });
        }
        //Send notification
        if (receiver.fcm_token) {
            const fcmToken = receiver.fcm_token;
            const title = `${sender.username} has sent you a friend request.`;  // Tạo tiêu đề thông báo
            const body = 'Add friend';  // Nội dung thông báo

            // Gọi hàm gửi thông báo FCM cho người nhận
            try {
                await sendFcmNotification(fcmToken, title, body, receiver);
                console.log('FCM notification sent successfully');
            } catch (error) {
                console.error('Error sending FCM notification:', error);
            }
        }

        // Thêm người nhận vào danh sách yêu cầu kết bạn của người gửi
        sender.sent_request_friends.push(receiverId);
        receiver.received_request_friends.push(senderId);

        await sender.save();
        await receiver.save();

        res.status(200).json({ success: true, message: 'Friend request sent' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.acceptFriendRequest = async (req, res) => {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
        return res.status(400).json({ success: false, error: 'Missing sender or receiver' });
    }

    try {
        // Tìm người dùng A (receiver) và người dùng B (sender)
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        const nameSender = sender.username;
        if (!sender || !receiver) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Kiểm tra xem người nhận có yêu cầu kết bạn từ người gửi không
        if (!receiver.received_request_friends.includes(senderId)) {
            return res.status(400).json({ success: false, error: 'No request found' });
        }

        // Xóa yêu cầu kết bạn từ người gửi và người nhận
        receiver.received_request_friends = receiver.received_request_friends.filter(id => id.toString() !== senderId.toString());
        sender.sent_request_friends = sender.sent_request_friends.filter(id => id.toString() !== receiverId.toString());

        receiver.friends.push(senderId);
        sender.friends.push(receiverId);

        await sender.save();
        await receiver.save();

        if (sender.fcm_token) {
            const fcmToken = receiver.fcm_token;
            const title = `${nameSender} has accepted your friend request.`;  // Tạo tiêu đề thông báo
            const body = 'You are now friend';  // Nội dung thông báo

            // Gọi hàm gửi thông báo FCM cho người nhận
            try {
                await sendFcmNotification(fcmToken, title, body, receiver);
                console.log('FCM notification sent successfully');
            } catch (error) {
                console.error('Error sending FCM notification:', error);
            }
        }

        res.status(200).json({ success: true, message: 'Friend request accepted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.declineFriendRequest = async (req, res) => {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
        return res.status(400).json({ success: false, error: 'Missing sender or receiver' });
    }

    try {
        // Tìm người dùng A (receiver) và người dùng B (sender)
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        const nameSender = sender.username;
        if (!sender || !receiver) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Kiểm tra nếu yêu cầu kết bạn tồn tại
        if (!receiver.received_request_friends.includes(senderId)) {
            return res.status(400).json({ success: false, error: 'No request found' });
        }

        // Xóa sender khỏi request_friends của receiver
        receiver.received_request_friends = receiver.received_request_friends.filter(id => id.toString() !== senderId.toString());
        sender.sent_request_friends = sender.sent_request_friends.filter(id => id.toString() !== receiverId.toString());

        await receiver.save();
        await sender.save();

        if (sender.fcm_token) {
            const fcmToken = receiver.fcm_token;
            const title = `${nameSender} has declined your friend request.`;  // Tạo tiêu đề thông báo
            const body = 'Declined friend';  // Nội dung thông báo

            // Gọi hàm gửi thông báo FCM cho người nhận
            try {
                await sendFcmNotification(fcmToken, title, body, receiver);
                console.log('FCM notification sent successfully');
            } catch (error) {
                console.error('Error sending FCM notification:', error);
            }
        }

        res.status(200).json({ success: true, message: 'Friend request declined' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.removeFriend = async (req, res) => {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
        return res.status(400).json({ success: false, error: 'Missing user or friend id' });
    }

    try {
        const user = await User.findById(userId);
        const friend = await User.findById(friendId);

        if (!user || !friend) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Kiểm tra nếu không phải bạn bè
        if (!user.friends.includes(friendId)) {
            return res.status(400).json({ success: false, error: 'Not friends' });
        }

        // Xóa nhau khỏi danh sách bạn bè
        user.friends = user.friends.filter(id => id.toString() !== friendId.toString());
        friend.friends = friend.friends.filter(id => id.toString() !== userId.toString());

        await user.save();
        await friend.save();

        res.status(200).json({ success: true, message: 'Friend removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.getUserByID = async (req, res) => {
    try {
        const id = req.query.id;

        // Tìm user theo ID
        const user = await User.findById(id);

        // Kiểm tra nếu không tìm thấy user
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Trả về thông tin user nếu tìm thấy
        return res.status(200).json(user);
    } catch (error) {
        // Xử lý lỗi
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;

        //check user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        //update user
        const updateUser = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: updateUser });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

module.exports.putFcmToken = async (req, res) => {
    try {
        const { userID } = req.params;
        const { fcmToken } = req.body;

        // Kiểm tra nếu không có FCM Token
        if (!fcmToken) {
            return res.status(400).json({
                success: false,
                message: 'FCM Token không được để trống',
            });
        }

        //Update fcm
        const putFcm = await User.findByIdAndUpdate(
            userID,
            { fcm_token: fcmToken },
            { new: true }
        );

        if (!putFcm) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user',
            });
        }
        res.status(200).json({
            success: true,
            message: 'FCM Token đã được cập nhật thành công',
            data: putFcm,
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật FCM Token:', error);
        res.status(500).json({
            success: false,
            message: `Lỗi: ${error.message}`,
        });
    }
}

module.exports.getFriendsList = async (req, res) => {
    try {
        const { uid, check, search } = req.query;
        if (!uid || !check) {
            return res.status(400).json({
                success: false,
                message: 'UserID or check is required',
            });
        }
        const user = await User.findById(uid);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        var friends = [];
        if (check === 'true') {
            if (search != null) {
                friends = await User.find({
                    _id: { $in: user.friends, $ne: uid },
                    $or: [
                        { username: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                });
            } else {
                friends = await User.find({ _id: { $in: user.friends, $ne: uid } });
            }
        }
        if (check === 'false') {
            friends = friends = await User.find({
                _id: { $in: user.received_request_friends, $ne: uid },
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            });
        }
        return res.status(200).json({
            success: true,
            data: friends,
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách bạn bè:', error);
        res.status(500).json({
            success: false,
            message: `Lỗi: ${error.message}`,
        });
    }
};
