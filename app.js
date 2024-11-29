const express = require('express');

const app = express();

app.get('/', (req, res) => {
    res.status(200).send('Hello, world!').end();
});

app.get('/following_verify', (req, res) => {
    res.status(200).send('/following_verify hit successful!').end();
});

app.get('/auth_redirect', (req, res) => {
    console.log(req);
    res.status(200).send('Hello, world!').end();
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});