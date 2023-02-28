//-----------------modules-------------------------
import TwitterAPI, {
    TweetV2PaginableTimelineParams,
    TweetV2,
} from 'twitter-api-v2';
import fs = require('fs');
import DataStore = require('nedb-promises');
import loading, { Loading } from 'loading-cli';
const { setTimeout } = require('timers/promises');
const { saveAsJson } = require('./myUtil');
//-----------------interfaces----------------------
interface config {
    api_key: string;
    api_key_secret: string;
    bearer_token: string;
    access_token: string;
    access_token_secret: string;
    client_id: string;
    client_secret: string;
    discord_bot_token: string;
}
interface config2 {
    token_type?: string;
    expires_in?: number;
    access_token: string;
    scope?: string[];
    refresh_token: string;
    expires_at?: number;
}
interface tweet {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    attachments?: { media_keys: string[] }[];
    edit_history_tweet_ids?: string[];
}
type lookupFunc = () => Promise<string[]>; //lookupBookmarks2
type updateFunc = (ids: string[]) => Promise<void>; //updateBookmarks
type ins = (tweets: TweetV2[], db: DataStore<{ _id: string }>) => Promise<void>; //insertTweets
//-----------------datastores----------------------
//const db: DataStore<{ _id: string }> = DataStore.create('./db/bookmarks.db');
const userDB = DataStore.create('./db/users.db');
const mediaDB = DataStore.create('./db/media.db');
const db = DataStore.create('./db/bookmarks.db');

//-----------------config--------------------------
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')) as config;
const config2 = JSON.parse(
    fs.readFileSync('./config2.json', 'utf8')
) as config2;
let bearerToken = config2.access_token;
let refreshToken = config2.refresh_token;
let client = new TwitterAPI(bearerToken);
//-----------------develog-------------------------
const sampleIds = JSON.parse(
    fs.readFileSync('./JSON/ids.json', 'utf-8')
) as string[];
//-----------------functions-----------------------

const refreshBearerToken = async () => {
    const load = loading('Refreshing Bearer Token').start();
    const subClient = new TwitterAPI({
        clientId: config.client_id,
        clientSecret: config.client_secret,
    });
    const {
        client: refreshed,
        accessToken,
        refreshToken: newRefreshToken,
    } = await subClient.refreshOAuth2Token(refreshToken);
    bearerToken = accessToken;
    refreshToken = newRefreshToken || refreshToken;
    client = new TwitterAPI(bearerToken);
    fs.writeFileSync(
        './config2.json',
        JSON.stringify({
            access_token: bearerToken,
            refresh_token: refreshToken,
        }),
        'utf-8'
    );
    load.succeed('Bearer Token Refreshed');
};

const lookupBookmarks: lookupFunc = async () => {
    let idarray: string[] = [];
    const load = loading('1: ブックマーク取得開始').start();
    try {
        const options: Partial<TweetV2PaginableTimelineParams> = {
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
                'alt_text',
                'variants',
            ],
            max_results: 100,
        };
        let bookmarks = await client.v2.bookmarks(options);
        const meta = bookmarks.meta;
        if (meta.result_count === 0) {
            load.fail('1: ブックマーク取得失敗(result_count=0)');
            process.exit(1);
        }
        let state = 1;
        do {
            const users = bookmarks.includes.users;
            const media = bookmarks.includes.media;
            if (users) await userDB.insert(users);
            if (media) await mediaDB.insert(media);
            load.text = 'ブックマーク取得(bookmarks.db)';
            let data = bookmarks.tweets;
            const ids = data.map((tweet) => tweet.id);
            idarray = idarray.concat(ids);
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
    load.succeed('1: ブックマーク取得完了');
    return idarray;
};

const sleepLoading = async (minutes: number, load: Loading) => {
    let m = minutes;
    load.text = `次の処理まで${m}分待機中`;
    while (true) {
        await setTimeout(1000 * 60);
        m -= 1;
        load.text = `次の処理まで${m}分待機中`;
        if (m === 0) {
            load.succeed('待機終了');
            break;
        }
    }
};

const getTweets = async (ids: string[]) => {
    let load = loading('2: ツイート取得開始').start();
    if (ids.length === 0) {
        load.fail('2: ツイート取得失敗(ids.length=0)');
        process.exit(1);
    }
    let tweets: TweetV2[] = [];
    const options: Partial<TweetV2PaginableTimelineParams> = {
        'tweet.fields': ['created_at', 'attachments', 'author_id'],
    };
    if (ids.length > 100) {
        const ids2d = ids.reduce((acc, cur, i) => {
            const idx = Math.floor(i / 100);
            const last = acc[idx];
            if (last) {
                last.push(cur);
            } else {
                acc[idx] = [cur];
            }
            return acc;
        }, [] as string[][]);
        for (const ids of ids2d) {
            while (true) {
                try {
                    tweets = tweets.concat(
                        (await client.v2.tweets(ids, options)).data
                    );
                    break;
                } catch (e: any) {
                    load = load.succeed('レートリミット到達');
                    await sleepLoading(15, load.start());
                    refreshBearerToken();
                    load.start('2: ツイート取得開始');
                    continue;
                }
            }
        }
    } else {
        tweets = tweets.concat((await client.v2.tweets(ids, options)).data);
    }
    load.succeed('2: ツイート取得完了');
    return tweets;
};

const insertWithoutDep: ins = async (
    tweets: TweetV2[],
    db: DataStore<{ _id: string }>
) => {
    let count = 1,
        nodup = 0;
    const load = loading('3: ツイート挿入開始').start();
    for (const tweet of tweets) {
        const now = '挿入中...(' + count + '/' + tweets.length + ')';
        load.text = now;
        const dep = await db.find({ id: tweet.id });
        if (dep.length === 0) {
            await db.insert(tweet);
            nodup++;
        }
        count++;
    }
    count--;
    load.succeed('3:挿入完了(' + nodup + '/' + count + ')');
    return;
};

const unBookmark = async (ids: string[]) => {
    let load = loading('4:ブックマーク削除開始').start();
    let count = 0;
    let cnt = 1;
    for (const id of ids) {
        load.text = '4:ブックマーク削除中... (' + cnt + '/' + ids.length + ')';
        if (count >= 50) {
            load = load.succeed(
                'レート制限により停止しました。15分待機します...(' +
                    cnt +
                    '/' +
                    ids.length +
                    ')'
            );
            await sleepLoading(15, load.start());
            await refreshBearerToken();
            load.start('ブックマーク削除再開(' + cnt + '/' + ids.length + ')');
            count = 0;
        }
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
                await sleepLoading(15, load.start());
                await refreshBearerToken();
                load.start(
                    'ブックマーク削除再開(' + cnt + '/' + ids.length + ')'
                );
            }
        }
    }
    load.succeed('4: ブックマーク削除完了');
    return;
};

const main = async () => {
    const ids = await lookupBookmarks();
    const tweets = await getTweets(ids);
    await insertWithoutDep(tweets, db);
    await unBookmark(ids);
    return;
};

main();
