const User = require('./models/userModel')
const jwt = require('jsonwebtoken');

module.exports.isLoggedIn = async (req, res, next) => {
    try {
        const token = req.signedCookies.jwt; // Lấy token từ cookie đã ký

        if (!token) {
            return res.status(401).json({ error: 'No token provided' }); // Token không tồn tại
        }

        // Xác minh token
        const decoded = jwt.verify(token, process.env.SECRET);

        // Tìm người dùng dựa trên thông tin từ token
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(400).json({ error: 'Invalid token: user not found' });
        }

        req.user = user; // Lưu thông tin người dùng vào request
        next(); // Cho phép tiếp tục xử lý request
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            // Xử lý lỗi token hết hạn
            return res.status(401).json({
                error: 'Token expired',
                expiredAt: err.expiredAt, // Trả về thời gian token hết hạn (nếu cần)
            });
        } else if (err.name === 'JsonWebTokenError') {
            // Xử lý lỗi token không hợp lệ
            return res.status(401).json({ error: 'Invalid token' });
        } else {
            // Xử lý các lỗi khác
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
};