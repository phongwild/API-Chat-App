const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

// Hàm lấy Bearer Token
async function getAccessToken() {
    try {
        // Tạo GoogleAuth với thông tin từ biến môi trường
        const auth = new GoogleAuth({
            credentials: {
                type: 'service_account',
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCibjN32P3l/MM5\n+sYFc1GskiGWLIblHx9w8z2r9GBMixL4zU8wj3yzN1A7phfx8tqKgiz5ar06dA4R\ntCsJAFK1qWxJFo7Jt2wnNfnsyETJdDz06SjOMz2GDSvOsFi+136whszIYcqgzSbs\np0fJdcJYVpV/gdKGkntO+NlUyLYXnJjQ3fjqhObCbHIjAOx+OhRrSdr13fO+o673\ncFpH6MxFkEcY3Z1KA5x9XOky6ZJGwEKiAc01Mc9yf7WuPtExtzVRhVmXcPPX6dw1\nABk6pT1BRKCyilrtWnb2ggfKD/IL8HrqRMlmhWxLegf66KTUGzj8s4GfgcmSbLQE\ndN33m36XAgMBAAECggEASV+Xj1FtrAkolVXTQt4LbHWch254xyJufQLb/oPHRnxi\nZxKzbX+7uGdJrpBCa9Ck6QGR2F9fuHp5aoTlFc1YD2jHmiJ/AN8DE5ld2xjCffAs\nowN6I99gsN/dRKJDjH3i5FIYSoJmWoohxbBxDK/NyULfiHg4BgNAgXWHEzYRj4s8\nRY9FYxEdIQo+ZB3c9YiuG9LJjWV78Kv4VKc3voH2bgphyJDVH7/XJSnlQjugtpI0\n3tiFpNM9I/craSdaTl4bIJoE4+qjS67TH7L0cun7Wg28o9k5IMCp90p4G/IODRvM\nQ3wFog+d1Yel/za4SSA8WFLvIRcDoBfk+XXkyBlWvQKBgQDe3HK5jVnuXUtdpOI6\nQ+krE+h+KlGJ4O3ErMjmNuxMdrffvy6YJnJR1RsNmObLkX59VRWugzYMKOQqk39n\nrVZrKwZa14Lv62Y/z5igp0bsv/4JEeUXeE5V9Qi/s6Iau9aHmzmWzgMZzIQLvCXx\nO7nL9RenFjn1hZdC3XGEAuK03QKBgQC6lV34UZ+n3YtgxIY4r6M3MF1Mn31xLRBK\n9GwnucoFXs/lcR8Lbd2hlsAYun7bdb0WJfVYwTiXwmh9lxkxhy0fMw4YeMZg4URn\np+N2vlnALkB+hyQ04eFU1X1Z3OoK8djDe3Q370u+2Z++x/YrpKfAJtYTmYyezaFW\nP1omt1rgAwKBgQC5OHaRCI2pshglKBhtXGu5xb4AvaMu+KYkQ4Zk71jM5A5GA1ry\nUWHJ6VemoWGP5sg92i0+8QZGbOXVDOlifYnJX+TUMzE7vWUpu5uaSeyEb7zuRNUm\nAHL6tcAjs2QS2/KcmcHvOCETnApSxniyWXU9seGKmMpq6DCi/fCOSueocQKBgA/l\nD5dK5M35GpmIxGJp2/6kmR4g7B/LFfs8rUYJFsO0WwORynI/zsSoQf8ZTBtIAW60\nlx0TgM202w/v4k6M1HQ29jlxeHziU+B8tez0tFKh3g6pVpVGtNp0QXR5VFrQVYX5\nq2HkedBtW6V2BWucYEoHRO9wgkE5BUiCpxxrPEufAoGBAICgQSXZ6fz7PzLYMgUn\nprzbGcRP9WJWgGZ/X8C+UXcSkycQgTulTqWblHgN+Nu7HrIMe52JSkMdZ+TBgyx3\niuuWP+doyD4CfXnCEabNuHcQEvLTwKzEht5q8kEan+Hf5VXMYIqfs96Iz5w7JMr6\nB+odsEjkeLsA8dmyAV7DgnPp\n-----END PRIVATE KEY-----\n',
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID,
                auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                token_uri: process.env.FIREBASE_TOKEN_URI,
                auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            },
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        // Lấy Access Token
        const accessToken = await auth.getAccessToken();
        console.log('Bearer Token:', accessToken);
        return accessToken;
    } catch (error) {
        console.error('Lỗi khi lấy Bearer Token:', error);
    }
}
getAccessToken()
module.exports = { getAccessToken };