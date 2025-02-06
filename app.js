const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const ExpressError = require('./utils/ExpressError');
const cookieParser = require('cookie-parser');
const http = require('http').createServer(app);
const mongoose = require('mongoose');


// Cấu hình Keep-Alive
http.keepAliveTimeout = 120 * 1000; // Thời gian tối đa giữ kết nối (120 giây)
http.headersTimeout = 125 * 1000; // Thời gian tối đa chờ headers
http.on('connection', (socket) => {
    socket.setKeepAlive(true);
});

// Kết nối MongoDB
const dbURL = process.env.DB_URL;
mongoose.connect(dbURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', (error) => console.error('Database connection error:', error));
db.once('open', () => console.log('Connected to the database'));

// Middleware cơ bản
app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(process.env.SECRET)); // Xử lý cookie
app.use(express.json()); // Xử lý dữ liệu JSON
app.use('/uploads', express.static('uploads')); // Đường dẫn static cho file upload

// Middleware timeout cho request (nếu mất quá nhiều thời gian)
app.use((req, res, next) => {
    res.setTimeout(500000, () => {
        console.error('Request has timed out');
        res.status(408).json({ error: 'Request Timeout' });
    });
    next();
});

const initSocket = require('./controllers/messageControllers');
// app.use((req, res, next) => {
//     if (req.headers['x-forwarded-proto'] !== 'https') {
//         return res.redirect(`https://${req.headers.host}${req.url}`);
//     }
//     next();
// });
initSocket(http);


// Router
const userRoutes = require('./routes/userRoutes');
app.use('/user', userRoutes);

const messageRoutes = require('./routes/messageRoutes');
app.use('/message', messageRoutes);

// Xử lý route không tồn tại (404)
app.all('*', (req, res, next) => {
    next(new ExpressError('API Not Found', 404));
});

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
    const { statusCode = 500, message = 'Something went wrong' } = err;
    console.error(`Error: ${message} (status: ${statusCode})`);
    res.status(statusCode).json({ error: message });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Export app (nếu cần dùng để test hoặc module)
module.exports = app;
