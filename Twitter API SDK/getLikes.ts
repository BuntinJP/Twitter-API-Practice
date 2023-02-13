const fs = require('fs');
const { Client } = require('twitter-api-sdk');

const config = () => {
    return JSON.parse(fs.readFileSync('./config.json', 'utf8'));
};
