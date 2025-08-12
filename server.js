const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('sound'), (req, res) => {
    res.sendStatus(200);
});

app.get('/files', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        res.json(files);
    });
});

app.listen(port, () => {
    console.log(`Soundboard server running at http://localhost:${port}`);
});
