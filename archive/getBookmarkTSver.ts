//-----------------EXP-----------------
const fs = require('fs');
const Datastore = require('nedb-promises');
const userDB = Datastore.create('db/users.db');
userDB.load();
const mediaDB = Datastore.create('db/media.db');
mediaDB.load();
const bookmarkDB2 = Datastore.create('db/bookmarks2.db');
bookmarkDB2.load();
const OutBookmarksDB = Datastore.create('db/OutBookmarks.db');
OutBookmarksDB.load();
const db = Datastore.create('db/formatted.db'); //unique
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
//-----------------Interface-----------------
type lookupFunc = () => Promise<string[]>; //lookupBookmarks2
type updateFunc = (ids: string[]) => Promise<void>; //updateBookmarks
//-----------------Functions-----------------

const lookupBookmarks2: lookupFunc = async () => {
    let idarray: string[] = [];
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
            let datas: any[] = bookmarks._realData.data;
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

const updateBookmarks: updateFunc = async (ids) => {
    const load = loading('取得中...').start();
    await getTweetsWithTimeBounce(ids, 0, bookmarkDB2, load);
    return;
};

const filterNedbsId = (doc: any) => {
    return {
        id: doc.id,
        text: doc.text,
        author_id: doc.author_id,
        attachments: doc.attachments,
    };
};
const detaSave = async (prevDB: any, finalDB: any) => {
    const prevDoc = await prevDB.find({});
    await finalDB.insert(prevDoc.map(filterNedbsId));
    return;
};

const unBookmark2 = async (db: any) => {
    let load = loading('ブックマーク削除開始').start();
    const data: any[] = await db.find({});
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
const main = async () => {
    const result = await lookupBookmarks2();
    await updateBookmarks(result);
    await detaSave(bookmarkDB2, OutBookmarksDB);
    await unBookmark2(bookmarkDB2);
    await insertWithoutDeplicate(OutBookmarksDB, db);
    await OutBookmarksDB.removeMany({});
    return;
};

const system = async () => {
    let i = 1;
    while (i < 100) {
        console.log(i);
        try {
            await main();
            await sleepLoadingMain(10, loading('system待機中...').start());
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

const insertWithoutDeplicate = async (from, to) => {
    let dup = 0,
        noDup = 0;
    let load = loading('重複無くデータを挿入します...').start();
    const result = await from.find({});
    load.text = 'データ長: ' + result.length;
    let count = 1;
    for (const item of result) {
        const now = '挿入中...(' + count + '/' + result.length + ')';
        load.text = now;
        const { _id, ...rest } = item;
        const deplicated = await to.find({ id: rest.id });
        if (deplicated.length === 0) {
            await to.insert(rest);
            noDup++;
        } else {
            dup++;
            //load = load.warn('重複データ : text = ' + deplicated[0].text).start();
        }
        count++;
    }
    load.succeed(
        '挿入完了(重複: ' +
            dup +
            ', 重複無し: ' +
            noDup +
            '/' +
            result.length +
            ')'
    );
};
const removeDeplicate = async (from) => {
    let load = loading('重複を削除します...').start();
    const result = (await from.find({})).map((item) => {
        const { _id, ...rest } = item;
        return rest;
    });
    load.text = 'データベースロード完了';
    from.remove({}, { multi: true });
    let count = 1;
    let length = result.length;
    let dup = 0,
        noDup = 0;
    for (const item of result) {
        load.text = '重複削除中...(' + count + '/' + length + ')';
        const db = (await from.find({})).map((item) => {
            const { _id, ...rest } = item;
            return rest;
        });
        let isDup = false;
        for (const item2 of db) {
            if (_.isEqual(item, item2)) {
                isDup = true;
                break;
            } else {
            }
        }
        if (!isDup) {
            await from.insert(item);
            noDup++;
        } else {
            dup++;
        }
        count++;
    }
    load.succeed('重複削除完了: 重複: ' + dup + ', 重複無し: ' + noDup);
};
export {};
