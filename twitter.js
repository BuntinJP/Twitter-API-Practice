const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { postForDiscord } = require('./postForDiscord.js');

//const client = new TwitterApi(config.bearer_token);
const client = new TwitterApi({
    clientId: config.client_id,
});
async function lookupBookmarks() {
    const bookmarks = await client.v2.bookmarks({
        expansions: ['referenced_tweets.id'],
    });

    for await (const bookmark of bookmarks) {
        const quotedTweet = bookmarks.includes.quote(bookmark);

        if (quotedTweet) {
            console.log(
                'Bookmarked tweet',
                bookmark.id,
                'is a quote of',
                quotedTweet.id
            );
        }
    }
}

async function tweet(content) {
    const { data: createdTweet } = await client.v2.tweet(content);
    console.log('Tweet', createdTweet.id, ':', createdTweet.text);
}

async function getOauth2Token() {
    // Don't forget to specify 'offline.access' in scope list if you want to refresh your token later
    const callbackurl = 'https://api.buntin.tech/twitter';
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
        callbackurl,
        {
            scope: [
                'tweet.read',
                'users.read',
                'bookmark.read',
                'offline.access',
            ],
        }
    );
    console.log('url:' + url);
    console.log('codeVerifier:' + codeVerifier);
    console.log('state:' + state);
    // Redirect your user to {url}, store {state} and {codeVerifier} into a DB/Redis/memory after user redirection
}

getOauth2Token();
