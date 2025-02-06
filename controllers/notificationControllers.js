const { getAccessToken } = require('../firebase/getAccessToken');

async function sendFcmNotification(userTokenFCM, title, body, idUser) {
    const fcmUrl = 'https://fcm.googleapis.com/v1/projects/messager-5cc23/messages:send';
    const token = await getAccessToken(); // Hàm lấy access token

    const messageData = {
        message: {
            token: userTokenFCM,
            notification: {
                title,
                body,
            },
            data: {
                idUser
            }
        },
    };

    const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
    });

    const resData = await response.json();

    if (!response.ok) {
        throw new Error(resData.error || 'Không thể gửi thông báo FCM');
    }

    return resData; // Trả về dữ liệu phản hồi từ FCM
}
module.exports = { sendFcmNotification };