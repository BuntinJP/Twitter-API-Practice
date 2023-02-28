//-----------------modules-------------------------
import TwitterAPI, {
    TweetV2PaginableTimelineParams,
    TweetV2,
    TweetV2PaginableListParams,
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
type ins = (tweets: TweetV2[], db: DataStore<{ _id: string }>) => Promise<void>; //insertTweets
type lookupFunc = (db: DataStore<{ _id: string }>) => Promise<void>; //lookupBookmarks2
//-----------------datastores----------------------
//const db: DataStore<{ _id: string }> = DataStore.create('./db/bookmarks.db');
const likeDB = DataStore.create('./db/likes/likes.db');
const userDB = DataStore.create('./db/likes/users.db');
const mediaDB = DataStore.create('./db/likes/media.db');
//-----------------config--------------------------
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')) as config;
const config2 = JSON.parse(
    fs.readFileSync('./config2.json', 'utf8')
) as config2;
let bearerToken = config2.access_token;
let refreshToken = config2.refresh_token;
let client = new TwitterAPI(bearerToken);
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

const lookupLikes = async () => {
    //const user_id = '980345742593212416';
    const user_id = '2478403218';
    const options: Partial<TweetV2PaginableListParams> = {
        expansions: ['attachments.media_keys', 'author_id'],
        'media.fields': ['media_key', 'type', 'url', 'preview_image_url'],
    };
    let count = 1;
    let load = loading('いいねを取得中 pagenation:' + count).start();
    let result = await client.v2.userLikedTweets(user_id, options);
    load = load.succeed('いいね取得成功 pagenation:' + count);
    while (!result.done) {
        load.start();
        count++;
        load.text = 'いいねを取得中 pagenation:' + count;
        try {
            await result.fetchNext();
        } catch (err: any) {
            if (err.code === 429) {
                load = load.warn(
                    'いいね取得失敗 レートリミット到達 pagenation:' + count
                );
                await sleepLoading(15, load.start());
                count--;
                continue;
            } else if (err.code === 401) {
                load = load.warn(
                    'いいね取得失敗 トークン失効 pagenation:' + count
                );
                await refreshBearerToken();
                count--;
                continue;
            } else {
                load = load.fail(
                    'いいね取得失敗 その他のエラー pagenation:' + count
                );
                saveAsJson(err, 'error');
                return;
            }
        }
    }
    load = load.succeed('いいね取得成功').start('データとして保存します。');
    const tweets = result.data.data;
    const includes = result.data.includes || {};
    const media = includes.media;
    const users = includes.users;
    load.text = 'ツイート保存中';
    await likeDB.insert(tweets);
    load.text = 'ユーザー保存中';
    await userDB.insert(users);
    load.text = 'メディア保存中';
    await mediaDB.insert(media);
    load.succeed('保存完了');
    return result;
};

lookupLikes();
