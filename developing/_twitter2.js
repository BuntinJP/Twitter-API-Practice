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
const { setTimeout } = require('timers/promises');

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
    saveAsJson(bookmarks, 'bookmarks');
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
//TODO: lookupBookmarksを、saveAsJsonのように、内部のNedb関連のインスタンスをグローバル変数としてではなく、引数として受け取るようにする
const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};

const updateBookmarks = async () => {
    bookmarkDB.loadDatabase();
    bookmarkDB.find({}, function (err, docs) {
        if (err !== null) {
            console.error(err);
        }
        const ids = docs.map((docs) => docs.id);
        const load = loading('取得中...').start();
        getTweetsWithTimeBounce(ids, 0, bookmarkDB2, load);
    });
};

const detaSave = (prevDB, finalDB) => {
    let loadingDetaSave = loading('最終データベースに登録中...').start();
    prevDB.loadDatabase();
    prevDB.find({}, function (err, docs) {
        if (err !== null) {
            console.error(err);
        }
        finalDB.insert(docs, (err, newDoc) => {
            if (err !== null) {
                loadingDetaSave.fail('最終データベースに登録失敗');
                console.error(err);
            }
            loadingDetaSave.succeed(
                '最終データベースに登録完了(' + newDoc.length + '件)'
            );
        });
    });
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

const unBookmark = async (db) => {
    const loadUnBookmark = loading('ブックマーク削除開始').start();
    db.loadDatabase();
    await db.find({}, async (err, docs) => {
        if (err !== null) {
            console.error(err);
        }
        const ids = docs.map((docs) => docs.id);
        let count = 0;
        let cnt = 1;
        for (const id of ids) {
            loadUnBookmark.text =
                'ブックマーク削除中... (' + cnt + '/' + ids.length + ')';
            if (count >= 50) {
                await sleepLoading(15, loadUnBookmark);
                count = 0;
            }
            while (true) {
                try {
                    let result = await client.v2.deleteBookmark(id);
                    if (result.data.bookmarked === false) {
                    } else {
                        let l = loading('削除失敗(' + id + ')').warn();
                    }
                    cnt++;
                    count++;
                    break;
                } catch (e) {
                    count = 0;
                    await refreshBearerToken();
                    await sleepLoading(15, loadUnBookmark);
                }
            }
        }
        loadUnBookmark.succeed('ブックマーク削除完了');
    });
};

const main = async () => {
    lookupBookmarks();
    await updateBookmarks();
    detaSave(bookmarkDB2, OutBookmarksDB);
    await unBookmark(bookmarkDB2);
    refreshBearerToken();
};
//-----------------CommonLevelFunctions-----------------
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
        await sleep(900000).then(() => {
            refreshBearerToken().then(() => {
                unBookmarkWithTimeBounce(ids, end, load);
            });
        });
    } else {
        load.text('全てのブックマークを削除しました');
    }
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

const getTweetsWithTimeBounce = async (ids, start, db, load = null) => {
    //ids:Array of tweet id[String](MAX is infinty)
    //using recursion to avoid rate limit
    //betgin, start = 0;
    let end = start + 100;
    if (end > ids.length) {
        end = ids.length;
    }
    await getTweets(ids.slice(start, end)).then((tweets) => {
        let data = tweets.data;
        db.insert(data, (err, newDoc) => {
            //
        });
    });
    if (end < ids.length) {
        load.text = '取得中...' + end + '/' + ids.length;
        sleep(1000).then(() => {
            getTweetsWithTimeBounce(ids, end, db, load);
        });
    } else {
        load.succeed('取得完了');
        console.log('取得長:' + ids.length);
    }
};

const sleep = async (ms) => {
    //
    await setTimeout(ms);
    return;
};

const sleepLoading = async (minutes, load) => {
    let m = minutes;
    load.text = 'レート制限により一時停止中...(残り' + m + '分)';
    while (true) {
        await setTimeout(60000);
        m--;
        load.text = 'レート制限により一時停止中...(残り' + m + '分)';
        if (m <= 0) {
            load.text = '待機終了';
            break;
        }
    }
    return;
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
    from.loadDatabase();
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
