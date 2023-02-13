//-----------------EXP-----------------
const fs = require('fs');
const Nedb = require('nedb');
const Datastore = require('nedb-promises');
const userDB = Datastore.create('db/users.db');
userDB.load();
const mediaDB = Datastore.create('db/media.db');
mediaDB.load();
const bookmarkDB = Datastore.create('db/bookmarks.db');
bookmarkDB.load();
const bookmarkDB2 = Datastore.create('db/bookmarks2.db');
bookmarkDB2.load();
const OutBookmarksDB = Datastore.create('db/OutBookmarks.db');
OutBookmarksDB.load();
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');

//-----------------Twitter-----------------
const { TwitterApi } = require('twitter-api-v2');
let config2 = JSON.parse(fs.readFileSync('./config2.json', 'utf8'));
let bearerToken = config2.access_token;
let refreshToken = config2.refresh_token;
let client = new TwitterApi(bearerToken);
/* const client = new TwitterApi({
    clientId: config.client_id,
}); */

//-----------------Functions-----------------

const lookupBookmarks = async () => {
    let idarray = [];
    await (async () => {
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
        await bookmarks.fetchLast(1000);
        const users = bookmarks._realData.includes.users;
        load.text = 'ユーザー取得中...';
        await userDB.insert(users);
        await setTimeout(1000);
        load.text = 'メディア取得中...';
        const media = bookmarks._realData.includes.media;
        await mediaDB.insert(media);
        await setTimeout(1000);
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
            await bookmarkDB.insert(insBM);
            idarray.push(bookmark.id);
        }
        load.succeed('1: ブックマーク取得完了');
        return;
    })();
    return idarray;
};

const lookupBookmarks2 = async () => {
    let idarray = [];
    const load = loading('1: ブックマーク取得開始').start();
    try {
        const options = {
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
            max_results: 100,
        };
        let bookmarks = await client.v2.bookmarks(options);
        const { meta } = bookmarks._realData;
        if (meta.result_count === 0) {
            load.fail('1: ブックマーク取得失敗(result_count=0)');
            process.exit(1);
        }
        let state = 1;
        do {
            const { users, media } = bookmarks._realData.includes;
            if (users) await userDB.insert(users);
            if (media) await mediaDB.insert(media);
            load.text = 'ブックマーク取得(bookmarks.db)';
            let datas = bookmarks._realData.data;
            datas.forEach((data) => {
                idarray.push(data.id);
            });
            if (!bookmarks.done) {
                await bookmarks.fetchNext();
            } else {
                state = 0;
            }
        } while (state);
    } catch (e) {
        load.fail('1: ブックマーク取得失敗');
        console.error(e);
    }
    load.succeed('1: ブックマーク取得完了' + idarray.length + '件');
    return idarray;
};
//TODO: lookupBookmarksを、saveAsJsonのように、内部のNedb関連のインスタンスをグローバル変数としてではなく、引数として受け取るようにする
const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};

const updateBookmarks = async (ids) => {
    const load = loading('取得中...').start();
    await getTweetsWithTimeBounce(ids, 0, bookmarkDB2, load);
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
            load.text = 'ブックマーク削除再開(' + cnt + '/' + ids.length + ')';
            count = 0;
        }
        //idから、apiを呼び出しブックマークを削除する(以下の式は一つのidに対しての処理)
        while (true) {
            try {
                let result = await client.v2.deleteBookmark(id);
                if (result.data.bookmarked) {
                    let l = loading('削除失敗(' + id + ')').warn();
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
const main = async () => {
    const result = await lookupBookmarks2();
    await updateBookmarks(result);
    await detaSave(bookmarkDB2, OutBookmarksDB);
    await unBookmark2(bookmarkDB2);
    return;
};

const system = async () => {
    let i = 1;
    while (i < 100) {
        console.log(i);
        try {
            await main();
            await sleepLoadingMain(5, loading('system待機中...').start());
        } catch (e) {
            console.error(e);
            process.exit(0);
        }
        i++;
    }
};

//-----------------Main-------------------
system();
//-----------------CommonLevelFunctions-----------------

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
        .succeed('取得完了 (' + tweets.data.length + '件)')
        .start('データ挿入開始');
    await bookmarkDB2.insert(tweets.data);
    if (end < ids.length) {
        load = load.succeed('取得中...' + end + '/' + ids.length);
        await getTweetsWithTimeBounce(ids, end, db, load);
    } else {
        load.succeed('2: 取得完了' + '(取得長:' + ids.length + ')');
    }
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

//------------achive-----------
const sleep = async (ms) => {
    //
    await setTimeout(ms);
    return;
};
