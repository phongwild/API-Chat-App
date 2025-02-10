const catchAsync = require('../utils/catchAsync');
const message = require('../controllers/messageControllers');

const router = require('express').Router();

router.route('/sendmessage')
    .post(catchAsync(message.sendMessage));

router.route('/getmessage')
    .get(catchAsync(message.getMessage));


module.exports = router;