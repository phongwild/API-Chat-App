const catchAsync = require('../utils/catchAsync');
const message = require('../controllers/messageControllers');

const router = require('express').Router();

router.route('/sendmessage')
    .post(catchAsync(message.sendMessage));

router.route('/getmessage')
    .get(catchAsync(message.getMessage));

router.route('/sendmedia')
    .post(message.sendMedia);



module.exports = router;