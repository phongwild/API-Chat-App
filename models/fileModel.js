const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filePath: String,
    fileType: String,
    createdAt: { type: Date, default: Date.now }
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
