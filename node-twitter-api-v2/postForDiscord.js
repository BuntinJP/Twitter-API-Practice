const axios = require('axios');
const config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));

const headers = {
    'Content-Type': 'application/json',
    Authorization: config.discord_bot_token,
    'User-Agent': 'Buntin-API/1.0',
    Accept: '*/*',
};

async function postForDiscord(title, content, imageURL, channelID) {
    axios.post(
        'https://discord.com/api/channels/' + channelID + '/messages',
        {
            embeds: [
                {
                    title: title,
                    description: content,
                    color: 7506394,
                    thumbnail: {
                        url: imageURL,
                    },
                },
            ],
        },
        { headers: headers }
    );
}

module.exports = { postForDiscord };
