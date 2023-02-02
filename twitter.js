const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new TwitterApi(config.BearerToken);

async function searchUsers(query) {
    const foundUsers = await client.v1.searchUsers(query);

    // use an async for-of to iterate over the multiple result pages!
    for await (const user of foundUsers) {
        console.log('User matching search:', user.screen_name);
    }
}

async function getTimeLine() {
    // Home timeline is available in v1 API, so use .v1 prefix
    const homeTimeline = await client.v1.homeTimeline();

    // Current page is in homeTimeline.tweets
    console.log(homeTimeline.tweets.length, 'fetched.');

    const nextHomePage = await homeTimeline.next();
    console.log(
        'Fetched tweet IDs in next page:',
        nextHomePage.tweets.map((tweet) => tweet.id_str)
    );
}

async function whoami() {
    const me = await client.v2.me();
    console.log('My name is', me.name);
}

whoami();
