//-----------------EXP-----------------
const fs = require('fs');
const Nedb = require('nedb');
const userDB = new Nedb({ filename: 'db/users.db', autoload: true });
const mediaDB = new Nedb({ filename: 'db/media.db', autoload: true });
const bookmarkDB = new Nedb({ filename: 'db/bookmarks.db', autoload: true });
const bookmarkDB2 = new Nedb({ filename: 'db/bookmarks2.db', autoload: true });
const deleteDB = new Nedb({ filename: 'db/delete.db', autoload: true });
const OutBookmarksDB = new Nedb({
    filename: 'db/OutBookmarks.db',
    autoload: true,
});
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const loading = require('loading-cli');

//-----------------Twitter-----------------
const { TwitterApi } = require('twitter-api-v2');
const { DataResolver } = require('discord.js');
let config2 = JSON.parse(fs.readFileSync('./config2.json', 'utf8'));
let bearerToken = config2.access_token;
let refreshToken = config2.refresh_token;
let client = new TwitterApi(bearerToken);
const callbackurl = 'https://api.buntin.tech/twitter';
/* const client = new TwitterApi({
    clientId: config.client_id,
}); */

//-----------------Functions-----------------

const lookupBookmarks = async () => {
    const load = loading('ブックマーク取得開始').start();
    //max 800
    const bookmarks = await client.v2.bookmarks({
        expansions: [
            'referenced_tweets.id',
            'author_id',
            'attachments.media_keys',
        ],
        'media.fields': [
            'media_key',
            'preview_image_url',
            'type',
            'url',
            'public_metrics',
            'non_public_metrics',
            'organic_metrics',
            'promoted_metrics',
            'alt_text',
            'variants',
        ],
    });
    const loadFetch = loading('ブックマーク取得').start();
    await bookmarks.fetchLast(1000);
    loadFetch.succeed(bookmarks._realData.data.length + '件取得');
    const users = bookmarks._realData.includes.users;
    load.text = 'ユーザー取得中...';
    userDB.insert(users, function (err, newDoc) {
        // Needy debug
    });
    load.text = 'メディア取得中...';
    const media = bookmarks._realData.includes.media;
    mediaDB.insert(media, function (err, newDoc) {
        // Needy debug
    });
    load.text = 'ブックマーク取得中...';
    const c = bookmarks._realData.data.length;
    let cnt = 1;
    for await (const bookmark of bookmarks) {
        load.text = 'ブックマーク取得中... (' + cnt + '/' + c + ')';
        let insBM = {
            id: bookmark.id,
            text: bookmark.text,
            author_id: bookmark.author_id,
            attachments: bookmark.attachments,
        };
        bookmarkDB.insert(insBM, function (err, newDoc) {
            // Needy debug
        });
        bookmarkDB.insert(deleteDB, (err, nd) => {
            //
        });
    }
    load.succeed('ブックマーク取得完了');
};
//lookupBookmarks();

const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};

const test = async () => {
    const testDB = new Nedb({ filename: 'db/test.db', autoload: true });
    let bookmarks = await client.v2.bookmarks({
        expansions: [
            'referenced_tweets.id',
            'author_id',
            'attachments.media_keys',
        ],
        'media.fields': [
            'media_key',
            'preview_image_url',
            'type',
            'url',
            'public_metrics',
            'non_public_metrics',
            'organic_metrics',
            'promoted_metrics',
            'alt_text',
            'variants',
        ],
    });
    await bookmarks.fetchLast(1000);
    console.log(bookmarks._realData.data.length);
};

const getTweet = async (id) => {
    let tweet = await client.v2.singleTweet(id, {});
    console.log(tweet);
};

const getTweets = async (ids) => {
    //ids:Array of tweet id[String] MAX = about 100;
    //リクエストヘッダーの制限により、100件以上のツイートを取得できない。
    //return Promise
    const rt = await client.v2.tweets(ids, {
        'tweet.fields': ['created_at', 'attachments', 'author_id'],
    });
    return rt;
};

const getTweetsWithTimeBounce = async (ids, start, load = null) => {
    //ids:Array of tweet id[String](MAX is infinty)
    //using recursion to avoid rate limit
    //betgin, start = 0;
    let end = start + 100;
    if (end > ids.length) {
        end = ids.length;
    }
    await getTweets(ids.slice(start, end)).then((tweets) => {
        let data = tweets.data;
        bookmarkDB2.insert(data, (err, newDoc) => {
            //
        });
    });
    if (end < ids.length) {
        load.text = '取得中...' + end + '/' + ids.length;
        sleep(1000).then(() => {
            getTweetsWithTimeBounce(ids, end, load);
        });
    } else {
        load.succeed('取得完了');
        console.log('取得長:' + ids.length);
    }
};

const updateBookmarks = async () => {
    bookmarkDB.loadDatabase();
    bookmarkDB.find({}, function (err, docs) {
        if (err !== null) {
            console.error(err);
        }
        const ids = docs.map((docs) => docs.id);
        const load = loading('取得中...').start();
        getTweetsWithTimeBounce(ids, 0, load);
    });
};

const unBookmarkWithTimeBounce = async (ids, start, load = null) => {
    let unit = 45;
    let end = start + unit;
    if (end > ids.length) {
        end = ids.length;
    }
    let count = 0;
    //削除処理
    for (i of ids.slice(start, end)) {
        load.text = '削除中...' + (start + count) + '/' + ids.length + ' ';
        let commonLoading = loading('削除(' + i + ')');
        commonLoading.frame(['←', '↖', '↑', '↗', '→', '↘', '↓', '↙']);
        commonLoading.start();
        while (true) {
            try {
                let result = await client.v2.deleteBookmark(i);
                if (result.data.bookmarked === false) {
                    commonLoading.succeed();
                    break;
                } else {
                    commonLoading.fail();
                }
            } catch (e) {
                commonLoading.fail(e);
                load.text =
                    '削除中...' +
                    (start + count) +
                    '/' +
                    ids.length +
                    '\n レート制限により一時停止中(10分) : (' +
                    start +
                    '/ ' +
                    ids.length +
                    ')';
                await sleepLoading(600000, load);
            }
        }
    }
    if (end < ids.length) {
        load.text =
            'レート制限により一時停止中(15分) : (' +
            end +
            '/ ' +
            ids.length +
            ')';
        sleep(900000).then(() => {
            refreshBearerToken().then(() => {
                unBookmarkWithTimeBounce(ids, end, load);
            });
        });
    } else {
        load.succeed('全てのブックマークを削除しました');
        console.log('削除長:' + ids.length);
    }
};

const unBookmark = async (ids) => {
    bookmarkDB2.loadDatabase();
    bookmarkDB2.find({}, function (err, docs) {
        if (err !== null) {
            console.error(err);
        }
        const ids = docs.map((docs) => docs.id);
        const load = loading('ブックマーク削除中...').start();
        unBookmarkWithTimeBounce(ids, 0, load);
    });
};

const sleep = (ms) => {
    //using for recursion
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const sleepLoading = (ms, load) => {
    //using for recursion
    load.text = 'レート制限回避のため、一時停止中(' + ms / 60000 + '分)...';
    return new Promise((resolve) => setTimeout(resolve, ms));
};
const refreshBearerToken = async () => {
    const subClient = new TwitterApi({
        clientId: config.client_id,
        clientSecret: config.client_secret,
    });
    const {
        client: refreshed,
        accessToken,
        refreshToken: newRefreshToken,
    } = await subClient.refreshOAuth2Token(refreshToken);
    bearerToken = accessToken;
    refreshToken = newRefreshToken;
    client = new TwitterApi(bearerToken);
    fs.writeFileSync(
        './config2.json',
        JSON.stringify({
            access_token: bearerToken,
            refresh_token: refreshToken,
        }),
        'utf8'
    );
};

const detaSave = () => {
    const load = loading('データベース初期化...').start();
    let ins = 0;
    let del = 0;
    bookmarkDB2
        .find({})
        .sort({ created_at: -1 })
        .exec((err, docs) => {
            OutBookmarksDB.insert(docs, (err, doc) => {
                console.log('完了');
            });
        });
    OutBookmarksDB.loadDatabase();
    let Out = [];
    OutBookmarksDB.find({})
        .sort({ created_at: -1 })
        .exec((err, docs) => {
            Out = docs;
        });
    OutBookmarksDB.remove({}, { multi: true }, (err, numRemoved) => {
        del = numRemoved;
    });
    load.text = 'データベース挿入中...';
    OutBookmarksDB.insert(Out, (err, doc) => {
        ins = doc.length;
    });
    if (ins == del) {
        load.succeed('データベース保存完了(' + ins + '件)');
    } else {
        load.fail('データベース保存失敗(' + ins + '件/' + del + '件)');
    }
};

const moveTheData = (from, to) => {
    from.find({}, (err, docs) => {
        to.insert(docs, (err, doc) => {
            console.log('完了');
        });
    });
};

const clearTheData = (from) => {
    from.remove({}, { multi: true }, (err, numRemoved) => {
        console.log('完了\n' + numRemoved + '件削除');
    });
};

const sortTheData = (from) => {
    let ins = 0;
    let del = 0;
    let Out = [];
    const load = loading('データベースソート中...').start();
    from.find({})
        .sort({ created_at: -1 })
        .exec((err, docs) => {
            Out = docs;
        });
    from.remove({}, { multi: true }, (err, numRemoved) => {
        del = numRemoved;
    });
    load.text = 'データベース挿入中...';
    from.insert(Out, (err, doc) => {
        ins = doc.length;
    });
    if (ins == del) {
        load.succeed('ソート完了');
    } else {
        load.fail('ソート失敗 データの整合性が失われた可能性があります。');
    }
};
//-----------------Main-----------------
sortTheData(OutBookmarksDB);
//-----------------OAuth2-----------------
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
