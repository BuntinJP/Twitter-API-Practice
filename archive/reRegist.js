//-----------------EXP-----------------
const fs = require('fs');
const Datastore = require('nedb-promises');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');
const formattedDB = Datastore.create('db/formatted.db');
const newFormattedDB = Datastore.create('db/newFormatted.db');
const test = Datastore.create('db/test.db');

//-----------------Twitter-----------------
const { TwitterApi } = require('twitter-api-v2');
let config2 = JSON.parse(fs.readFileSync('./config2.json', 'utf8'));
let bearerToken = config2.access_token;
let refreshToken = config2.refresh_token;
let client = new TwitterApi(bearerToken);

const updateBookmarks = async (ids, db) => {
    const load = loading('取得中...').start();
    await getTweetsWithTimeBounce(ids, 0, db, load);
    return;
};

const filterNedbsId = (doc) => {
    return {
        id: doc.id,
        text: doc.text,
        author_id: doc.author_id,
        attachments: doc.attachments,
    };
};
const detaSave = async (prevDB, finalDB) => {
    const prevDoc = await prevDB.find({});
    await finalDB.insert(prevDoc.map(filterNedbsId));
    return;
};

const unBookmark2 = async (db) => {
    let load = loading('ブックマーク削除開始').start();
    const data = await db.find({});
    const ids = data.map((data) => data.id);
    let count = 0;
    let cnt = 1;
    for (const id of ids) {
        //load.started
        load.text = 'ブックマーク削除中... (' + cnt + '/' + ids.length + ')';
        if (count >= 50) {
            load = load.succeed(
                'レート制限により停止しました。15分待機します...(' +
                    cnt +
                    '/' +
                    ids.length +
                    ')'
            );
            await sleepLoadingMain(15, load.start());
            refreshBearerToken();
            load.start('ブックマーク削除再開(' + cnt + '/' + ids.length + ')');
            count = 0;
        }
        //idから、apiを呼び出しブックマークを削除する(以下の式は一つのidに対しての処理)
        while (true) {
            try {
                let result = await client.v2.deleteBookmark(id);
                if (result.data.bookmarked) {
                    load = loading('削除失敗(' + id + ')').warn();
                }
                cnt++;
                count++;
                break;
            } catch (e) {
                count = 0;
                load = load.succeed(
                    'レート制限により停止しました。(' +
                        cnt +
                        '/' +
                        ids.length +
                        ')'
                );
                await sleepLoadingMain(15, load.start());
                await refreshBearerToken();
                load.start(
                    'ブックマーク削除再開(' + cnt + '/' + ids.length + ')'
                );
            }
        }
    }
    await db.removeMany({});
    db.load();
    load.succeed('3: ブックマーク削除完了');
    return;
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
/* const main = async () => {
    const result = await lookupBookmarks2();
    await updateBookmarks(result);
    await detaSave(bookmarkDB2, OutBookmarksDB);
    await unBookmark2(bookmarkDB2);
    return;
}; */

//-----------------Main-------------------

//-----------------CommonLevelFunctions-----------------
const getTweets = async (ids) => {
    //ids:Array of tweet id[String] MAX = about 100;
    //リクエストヘッダーの制限により、100件以上のツイートを取得できない。
    //return Promise
    const rt = await client.v2.tweets(ids, {
        'tweet.fields': ['created_at', 'attachments', 'author_id'],
    });
    return rt.data;
};

const getTweetsWithTimeBounce = async (ids, start, db, load = null) => {
    let end = start + 100;
    let tweets;
    load.text = '取得中...' + start + '-' + end + '/' + ids.length;
    if (end > ids.length) {
        end = ids.length;
    }
    try {
        tweets = await getTweets(ids.slice(start, end));
    } catch (err) {
        if (err.code === 429) {
            load = load
                .succeed(
                    'レート制限により停止しました。15分待機します...(' +
                        start +
                        '-' +
                        end +
                        '/' +
                        ids.length +
                        ')'
                )
                .start('待機');
            await sleepLoadingMain(15, load);
            tweets = await getTweets(ids.slice(start, end));
        }
    }

    load = load
        .succeed('取得完了 (' + tweets.length + '件)')
        .start('データ挿入開始');
    await db.insert(tweets);
    if (end < ids.length) {
        load = load.succeed('取得中...' + end + '/' + ids.length);
        await getTweetsWithTimeBounce(ids, end, db, load);
    } else {
        load.succeed('2: 取得完了' + '(取得長:' + ids.length + ')');
    }
    return;
};

const sleepLoadingMain = async (minutes, load) => {
    let m = minutes;
    load.text = 'レート制限により一時停止中...(残り' + m + '分)';
    while (true) {
        await setTimeout(60000);
        m--;
        load.text = 'レート制限により一時停止中...(残り' + m + '分)';
        if (m <= 0) {
            load = load.succeed('待機終了(' + minutes + '分)');
            break;
        }
    }
    return;
};

const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};

(async () => {
    const result = await formattedDB.find({});
    const ids = result.map((doc) => doc.id);
    const ids2 = await (await newFormattedDB.find({})).map((doc) => doc.id);
    for (id of ids) {
        if (ids2.includes(id)) {
            //
        } else {
            console.log(id);
            console.log(
                JSON.stringify((await formattedDB.find({ id: id }))[0], null, 4)
            );
        }
    }
})();
