const { lookup } = require('dns');
const fs = require('fs');
const Nedb = require('nedb');

const { TwitterApi } = require('twitter-api-v2');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { postForDiscord } = require('./postForDiscord.js');

const bearerToken =
    'TThhTXRsakppZjhieml6QXBtUW9Kb3hGTlpfRHZMSGJBc3pRdWRyN3BrVF9MOjE2NzU2NDY2NjU0MzM6MToxOmF0OjE';
const client = new TwitterApi(bearerToken);
const db = new Nedb({ filename: 'bookmarks.db', autoload: true });
/* const client = new TwitterApi({
    clientId: config.client_id,
}); */
const callbackurl = 'https://api.buntin.tech/twitter';

async function lookupBookmarks() {
    const bookmarks = await client.v2.bookmarks({
        expansions: ['referenced_tweets.id', 'author_id'],
    });

    /* for await (const bookmark of bookmarks) {
        console.log(bookmark);
    } */
}
lookupBookmarks();

const buffer = () => {
    fs.writeFileSync(
        './bookmarks.json',
        JSON.stringify(bookmarks, null, 2),
        'utf8'
    );
};
const test = () => {
    const insData = {
        text: 'ユウカ https://t.co/bTZN709A9s',
        edit_history_tweet_ids: ['1566356631285248001'],
        id: '1566356631285248001',
    };
    db.insert(insData, function (err, newDoc) {
        if (err !== null) {
            console.error(err);
        }
        console.log(newDoc);
    });
};
//test();
const getBookmarks = () => {
    db.find({}, function (err, docs) {
        if (err !== null) {
            console.error(err);
        }
        console.log(docs);
    });
};

async function getOauth2Redirect() {
    // Don't forget to specify 'offline.access' in scope list if you want to refresh your token later
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

async function getOauth2Token() {
    const ac = config.accounts[0];
    const { code, codeVerifier } = ac;
    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackurl,
    });
    console.log('accessToken:' + accessToken);
    console.log('refreshToken:' + refreshToken);
}

const getTweet = async (id) => {
    let tweet = await client.v2.singleTweet(id, {});
    console.log(tweet);
};

//getTweet('1618594533264232449');
