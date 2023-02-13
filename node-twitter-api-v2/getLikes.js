//-----------------EXP-----------------
const fs = require('fs');
const Datastore = require('nedb-promises');
const likeDB = Datastore.create('db/like.db');
const userDB = Datastore.create('db/users.db');
const mediaDB = Datastore.create('db/media.db');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const config2 = JSON.parse(fs.readFileSync('./config2.json', 'utf8'));
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');

//-----------------Twitter-----------------
const { TwitterApi } = require('twitter-api-v2');
let { access_token: accessToken, refresh_token: refreshToken } = config2;
let client = new TwitterApi(accessToken);

//-----------------Classes-----------------

//https://twitter.com/intent/user?user_id=980345742593212416
//-----------------Functions-----------------
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

const lookupLikes = async () => {
    //const user_id = '980345742593212416';
    const user_id = '2478403218';
    const options = {
        expansions: ['attachments.media_keys', 'author_id'],
        'media.fields': ['media_key', 'type', 'url', 'preview_image_url'],
    };
    let count = 1;
    let load = loading('いいねを取得中 pagenation:' + count).start();
    let result = await client.v2.userLikedTweets(user_id, options);
    let length = result._realData.data.length;
    let newLength = 0;
    load = load.succeed('いいね取得成功 pagenation:' + count);
    while (!result.done) {
        load.start();
        count++;
        load.text = 'いいねを取得中 pagenation:' + count;
        try {
            await result.fetchNext();
        } catch (err) {
            if (err.code === 429) {
                load = load.warn(
                    'いいね取得失敗 レートリミット到達 pagenation:' + count
                );
                await sleepLoading(15, load.start(), 'm');
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
        newLength = result._realData.data.length;
        load = load.succeed(
            'いいね取得成功(' + (newLength - length) + ') pagenation:' + count
        );
        length = newLength;
    }
    load = load
        .succeed('いいね取得成功 pagenation:' + count)
        .start('データとして保存します。');
    const data = result._realData.data;
    const { users, media } = result._realData.includes;
    load.text = 'ツイート保存中';
    await likeDB.insert(data);
    load.text = 'ユーザー保存中';
    await userDB.insert(users);
    load.text = 'メディア保存中';
    await mediaDB.insert(media);
    load.succeed('保存完了');
    return result;
};

const lookupTest = async () => {
    const user_id = '980345742593212416';
    const options = {
        expansions: ['attachments.media_keys', '', 'author_id'],
        'media.fields': ['media_key', 'type', 'url', 'preview_image_url'],
    };
    let count = 1;
    let load = loading('いいねを取得中 pagenation:' + count).start();
    try {
        let result = await client.v2.userLikedTweets(user_id, options);
    } catch (err) {
        saveAsJson(err, 'error');
    }
    return result;
};

const sleepLoading = async (times, load, timeType) => {
    let time = times;
    if (timeType === 'm') {
        for (let i = 0; i < time; i++) {
            await setTimeout(60000);
            load.text = '再開まで' + (time - i) + '分';
        }
    } else if (timeType === 'h') {
        time = times * 60000 * 60;
        load.text = '' + times + '時間待機';
        await setTimeout(time);
    } else {
        time = times * 1000;
    }
    load.succeed('再開');
    return;
};

const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};
//------------------Main------------------

lookupLikes();
