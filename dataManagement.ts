const fs = require('fs');
const path = require('path');
const axios = require('axios');
const _ = require('lodash');
const Datastore = require('nedb-promises');
const mediaDB = Datastore.create('db/media.db'); //unique
const formattedDB = Datastore.create('db/formatted.db'); //unique
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');
import fetch from './fetch';
interface media {
    media_key: string;
    url: string;
    type: string;
    preview_image_url: string;
    _id: string;
    filename: string;
    filepath: string;
    preview_image_filename: string;
    preview_image_filepath: string;
}
class tweet {
    constructor(tweetObj) {
        this.id = tweetObj.id;
        this.text = tweetObj.text;
        this.author_id = tweetObj.author_id;
        this.created_at = tweetObj.created_at;
        this.attachments = tweetObj.attachments;
        this.edit_history_tweet_ids = tweetObj.edit_history_tweet_ids;
        this._id = tweetObj._id;
        this.type = 'tweet';
        this.media = {};
    }
    static dataSample = {
        id: '1515993545697419265',
        attachments: { media_keys: ['3_1515695352426676225'] },
        created_at: '2022-04-18T10:00:01.000Z',
        text: 'メイドマックイーン💜\n#ウマ娘　#メジロマックイーン https://t.co/78NiOPlnZn',
        edit_history_tweet_ids: ['1515993545697419265'],
        author_id: '1263529160430899200',
        _id: 'wuWzAAy0y9C63jAa',
    };
    solveUser() {
        //
    }
    async solveMedia() {
        if (typeof this.attachments === 'undefined') {
            let data = readJson();
            data.noAttachment.push(this.id);
            writeJson(data);
            return { status: 'false', message: 'no attachment' };
        } else if (
            typeof this.attachments.media_keys === 'undefined' ||
            this.attachments.media_keys.length === 0
        ) {
            let data = readJson();
            data.noMedia.push(this.id);
            writeJson(data);
            return { status: 'false', message: 'no media keys' };
        }
        const mediaKeys = this.attachments.media_keys;
        let result = {
            status: 'true',
            message: 'media keys solved',
            keys: [],
        };
        for (const key of mediaKeys) {
            //mediaDBからkeyを検索
            const mediaObj = await mediaDB.find({ media_key: key });
            if (mediaObj.length === 0) {
                result.status = 'warn';
                result.message = 'media not found';
                result.keys.push(key);
            } else {
                //mediaクラスを作成
                const mediaObject = new media(mediaObj[0]);
                this.media[key] = mediaObject;
            }
        }
        if (result.status === 'warn') {
            let data = readJson();
            for (const key of result.keys) {
                data.notExistMedia.push(key);
            }
            writeJson(data);
            return result;
        } else {
            //
        }
        return result;
    }

    async fetchMedia() {
        let result = {
            id: this.id,
            status: 'true',
            message: 'media fetched',
            fetchedKeys: [],
            failedKeysResults: [],
            noNeedtoFetchKeys: [],
        };
        for (const key in this.media) {
            const mediaObj = this.media[key];
            const fetchResult = await mediaObj.fetch();
            switch (fetchResult.status) {
                case 1:
                    result.noNeedtoFetchKeys.push(key);
                    break;
                case 2:
                    result.status = 'warn';
                    result.message = 'media fetch failed';
                    result.failedKeysResults.push(fetchResult);
                    break;
                case 3:
                    result.fetchedKeys.push(key);
                    break;
                default:
                    break;
            }
        }
        return result;
    }
    get fullData() {
        return this;
    }
    get fullDataString() {
        return JSON.stringify(this, null, 4);
    }
}
class media {
    media_key:string;
    url:string;
    type:string;
    preview_image_url:string;
    _id:string;
    filename:string;
    filepath:string;
    preview_image_filename:string;
    preview_image_filepath:string;
    constructor(mediaObj) {
        const { media_key, url, type, _id, preview_image_url } = mediaObj;
        this.media_key = media_key;
        this.url = url;
        this.preview_image_url = preview_image_url;
        this.type = type;
        this._id = _id;
        this.filename = url ? url.split('/').pop() : '';
        this.filepath = url ? this.pathSolver() : '';
        if (this.type !== 'photo') {
            this.preview_image_filename = preview_image_url
                ? preview_image_url.split('/').pop()
                : '';
            this.preview_image_filepath = preview_image_url
                ? this.pathSolver(true)
                : '';
        }
    }

    async fetch() {
        if (this.inLocal) {
            return { status: 1, message: 'already in local' };
        }
        if (this.type === 'video' || this.type === 'animated_gif') {
            if (fs.existsSync(this.preview_image_filepath)) {
                return { status: 1, message: 'already in local' };
            }
            //preview image fetch
            try {
                await fetch(this.preview_image_filepath, this.preview_image_url);
                return { status: 3, message: 'preview image fetched' };
            } catch (error) {
                return {
                    status: 2,
                    message: 'preview image fetch failed',
                    error: error,
                    key: this.media_key,
                };
            }
        } else {
            try {
                await fetch(this.filepath,this.url);
            } catch (error) {
                return { status: 2, message: 'fetch failed' };
            }
        }
        return { status: 3, message: 'fetched' };
    }
    get fullData() {
        return this;
    }
    get inLocal() {
        return fs.existsSync(this.filepath);
    }
    get fullDataString() {
        return JSON.stringify(this, null, 4);
    }
    pathSolver(ifPreview = false) {
        let path = 'media/';
        if (!ifPreview) {
            switch (this.type) {
                case 'photo':
                    path += 'img/';
                    break;
                case 'video':
                    path += 'video/';
                    break;
                case 'animated_gif':
                    path += 'gif/';
                    break;
                default:
                    path += 'unknown/';
                    break;
            }
        } else {
            path += 'preview/';
            return path + this.preview_image_filename;
        }
        return path + this.filename;
    }
}
class user {
    static dataSample = {
        id: '252997912',
        name: '愚者は経験に学び、賢者は歴史に学ぶ（略してグシャケン？）',
        username: 'History_JP_5963',
        _id: 'whkvmvKcVCgPmFLy',
    };
    constructor(userObj) {
        this.id = userObj.id;
        this.name = userObj.name;
        this.username = userObj.username;
        this._id = userObj._id;
    }

    get fullData() {
        return {
            id: this.id,
            name: this.name,
            username: this.username,
            _id: this._id,
        };
    }

    solve() {
        //プロフィール画像などを取得する
        //
    }
}

(async () => {
    const tweets = await formattedDB.find({});
    let tweetArray = [];
    for (const item of tweets) {
        tweetArray.push(new tweet(item));
    }
    const solveResult = await tweetMediaSolver(tweetArray);
    const fetchResult = await fetchAllMedia(tweetArray);
    const faileResults = [];
    for (const item of fetchResult) {
        if (item.status === 'warn') {
            faileResults.push(item);
        }
    }
    saveAsJson(solveResult, 'solveResult');
    saveAsJson(fetchResult, 'fetchResult');
    saveAsJson(tweetArray, 'tweetArray');
    saveAsJson(faileResults, 'faileResults');
})();
//================================================================================================
const fetchAllMedia = async (tweetArray) => {
    //tweetArray = tweet型の配列
    let load = loading(
        'メディアデータを取得中...(1/' + tweetArray.length + ')'
    ).start();
    let data = [];
    for (const tweet of tweetArray) {
        const result = await tweet.fetchMedia();
        data.push(result);
        load.text =
            'メディアデータを取得中...(' +
            (tweetArray.indexOf(tweet) + 1) +
            '/' +
            tweetArray.length +
            ')';
    }
    load.succeed('メディアデータ取得完了');
    return data;
};
const test = async () => {
    let load = loading('メインプロセス実行中...');
    const photos = await mediaDB.find({ type: 'photo' });
    const mediaArray = [];
    load.text = 'メディアデータを整形中...(1/' + photos.length + ')';
    for (const item of photos) {
        const mediaObj = new media(item);
        mediaArray.push(mediaObj);
    }
    console.log(mediaArray[mediaArray.length - 1].fullDataString);
    await mediaArray[mediaArray.length - 1].solve();
    load.succeed('メインプロセス完了');
};

const tweetMediaSolver = async (tweetArray) => {
    let load = loading(
        'メディアデータを解決中...(1/' + tweetArray.length + ')'
    ).start();
    let data = [];
    for (const tweet of tweetArray) {
        const result = await tweet.solveMedia();
        data.push(result);
        load.text =
            'メディアデータを解決中...(' +
            (data.length + 1) +
            '/' +
            tweetArray.length +
            ')';
        await setTimeout(1);
    }
    load.succeed('メディアデータ解決完了');
    return data;
};

const readJson = () => {
    const data = fs.readFileSync('JSON/dataManagement.json', 'utf-8');
    return JSON.parse(data);
};

const writeJson = (data) => {
    fs.writeFileSync('JSON/dataManagement.json', JSON.stringify(data, null, 4));
};

const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};

const getDate = () => {
    const dt = new Date();
    const text =
        dt.getFullYear() + //年の取得
        ('00' + (dt.getMonth() + 1)).slice(-2) + //月の取得 ※0~11で取得になるため+1
        ('00' + dt.getDate()).slice(-2) + //日付の取得
        ('00' + dt.getHours()).slice(-2) + //時間の取得
        ('00' + dt.getMinutes()).slice(-2) + //分の取得
        ('00' + dt.getSeconds()).slice(-2); //秒の取得
    return text;
};