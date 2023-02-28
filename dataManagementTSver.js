"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require('fs');
var path = require('path');
var axios = require('axios');
var _ = require('lodash');
var Datastore = require('nedb-promises');
var mediaDB = Datastore.create('db/media.db'); //unique
var formattedDB = Datastore.create('db/formatted.db'); //unique
var setTimeout = require('timers/promises').setTimeout;
var loading = require('loading-cli');
var fetch_1 = __importDefault(require("./fetch"));
var tweet = /** @class */ (function () {
    function tweet(tweetObj) {
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
    tweet.prototype.solveUser = function () {
        //
    };
    tweet.prototype.solveMedia = function () {
        return __awaiter(this, void 0, void 0, function () {
            var mediaKeys, result, _i, mediaKeys_1, key, mediaObj, mediaObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (typeof this.attachments === 'undefined') {
                            return [2 /*return*/, { status: 'false', message: 'no attachment' }];
                        }
                        else if (typeof this.attachments.media_keys === 'undefined' ||
                            this.attachments.media_keys.length === 0) {
                            return [2 /*return*/, { status: 'false', message: 'no media keys' }];
                        }
                        mediaKeys = this.attachments.media_keys;
                        result = {
                            status: 'true',
                            message: 'media keys solved',
                            keys: [],
                        };
                        _i = 0, mediaKeys_1 = mediaKeys;
                        _a.label = 1;
                    case 1:
                        if (!(_i < mediaKeys_1.length)) return [3 /*break*/, 4];
                        key = mediaKeys_1[_i];
                        return [4 /*yield*/, mediaDB.find({ media_key: key })];
                    case 2:
                        mediaObj = _a.sent();
                        if (mediaObj.length === 0) {
                            result.status = 'warn';
                            result.message = 'media not found';
                            result.keys && result.keys.push(key);
                        }
                        else {
                            mediaObject = new media(mediaObj[0]);
                            this.media[key] = mediaObject;
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    tweet.prototype.fetchMedia = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, _a, _b, _c, _i, key, mediaObj, fetchResult;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        result = {
                            id: this.id,
                            status: 'true',
                            message: 'media fetched',
                            fetchedKeys: [],
                            failedKeysResults: [],
                            noNeedtoFetchKeys: [],
                        };
                        _a = this.media;
                        _b = [];
                        for (_c in _a)
                            _b.push(_c);
                        _i = 0;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _b.length)) return [3 /*break*/, 4];
                        _c = _b[_i];
                        if (!(_c in _a)) return [3 /*break*/, 3];
                        key = _c;
                        mediaObj = this.media[key];
                        return [4 /*yield*/, mediaObj.fetch()];
                    case 2:
                        fetchResult = _d.sent();
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
                        _d.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    Object.defineProperty(tweet.prototype, "fullData", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(tweet.prototype, "fullDataString", {
        get: function () {
            return JSON.stringify(this, null, 4);
        },
        enumerable: false,
        configurable: true
    });
    tweet.dataSample = {
        id: '1515993545697419265',
        attachments: { media_keys: ['3_1515695352426676225'] },
        created_at: '2022-04-18T10:00:01.000Z',
        text: 'メイドマックイーン💜\n#ウマ娘　#メジロマックイーン https://t.co/78NiOPlnZn',
        edit_history_tweet_ids: ['1515993545697419265'],
        author_id: '1263529160430899200',
        _id: 'wuWzAAy0y9C63jAa',
    };
    return tweet;
}());
var media = /** @class */ (function () {
    function media(mediaObj) {
        var media_key = mediaObj.media_key, url = mediaObj.url, type = mediaObj.type, _id = mediaObj._id, preview_image_url = mediaObj.preview_image_url;
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
    media.prototype.fetch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.inLocal) {
                            return [2 /*return*/, { status: 1, message: 'already in local' }];
                        }
                        if (!(this.type === 'video' || this.type === 'animated_gif')) return [3 /*break*/, 5];
                        if (fs.existsSync(this.preview_image_filepath)) {
                            return [2 /*return*/, { status: 1, message: 'already in local' }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, fetch_1.default)(this.preview_image_filepath, this.preview_image_url)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { status: 3, message: 'preview image fetched' }];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                status: 2,
                                message: 'preview image fetch failed',
                                error: error_1,
                                key: this.media_key,
                            }];
                    case 4: return [3 /*break*/, 8];
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, (0, fetch_1.default)(this.filepath, this.url)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        return [2 /*return*/, { status: 2, message: 'fetch failed' }];
                    case 8: return [2 /*return*/, { status: 3, message: 'fetched' }];
                }
            });
        });
    };
    Object.defineProperty(media.prototype, "fullData", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(media.prototype, "inLocal", {
        get: function () {
            return fs.existsSync(this.filepath);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(media.prototype, "fullDataString", {
        get: function () {
            return JSON.stringify(this, null, 4);
        },
        enumerable: false,
        configurable: true
    });
    media.prototype.pathSolver = function (ifPreview) {
        if (ifPreview === void 0) { ifPreview = false; }
        var path = 'media/';
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
        }
        else {
            path += 'preview/';
            return path + this.preview_image_filename;
        }
        return path + this.filename;
    };
    media.dataSample = {
        media_key: '3_1384153802148782092',
        url: 'https://pbs.twimg.com/media/EzWAjKuVoAwiGsE.jpg',
        type: 'photo',
        _id: '00QL3fyWhff8tBvM',
    };
    return media;
}());
var user = /** @class */ (function () {
    function user(userObj) {
        this.id = userObj.id;
        this.name = userObj.name;
        this.username = userObj.username;
        this._id = userObj._id;
    }
    Object.defineProperty(user.prototype, "fullData", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    user.prototype.solve = function () {
        //プロフィール画像などを取得する
        //
    };
    user.dataSample = {
        id: '252997912',
        name: '愚者は経験に学び、賢者は歴史に学ぶ（略してグシャケン？）',
        username: 'History_JP_5963',
        _id: 'whkvmvKcVCgPmFLy',
    };
    return user;
}());
//================================================================================================
var fetchAllMedia = function (tweetArray) { return __awaiter(void 0, void 0, void 0, function () {
    var load, data, _i, tweetArray_1, tweet_1, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                load = loading('メディアデータを取得中...(1/' + tweetArray.length + ')').start();
                data = [];
                _i = 0, tweetArray_1 = tweetArray;
                _a.label = 1;
            case 1:
                if (!(_i < tweetArray_1.length)) return [3 /*break*/, 4];
                tweet_1 = tweetArray_1[_i];
                return [4 /*yield*/, tweet_1.fetchMedia()];
            case 2:
                result = _a.sent();
                data.push(result);
                load.text =
                    'メディアデータを取得中...(' +
                        (tweetArray.indexOf(tweet_1) + 1) +
                        '/' +
                        tweetArray.length +
                        ')';
                _a.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                load.succeed('メディアデータ取得完了');
                return [2 /*return*/, data];
        }
    });
}); };
var tweetMediaSolver = function (tweetArray) { return __awaiter(void 0, void 0, void 0, function () {
    var load, data, _i, tweetArray_2, tweet_2, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                load = loading('メディアデータを解決中...(1/' + tweetArray.length + ')').start();
                data = [];
                _i = 0, tweetArray_2 = tweetArray;
                _a.label = 1;
            case 1:
                if (!(_i < tweetArray_2.length)) return [3 /*break*/, 5];
                tweet_2 = tweetArray_2[_i];
                return [4 /*yield*/, tweet_2.solveMedia()];
            case 2:
                result = _a.sent();
                data.push(result);
                load.text =
                    'メディアデータを解決中...(' +
                        (data.length + 1) +
                        '/' +
                        tweetArray.length +
                        ')';
                return [4 /*yield*/, setTimeout(1)];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 1];
            case 5:
                load.succeed('メディアデータ解決完了');
                return [2 /*return*/, data];
        }
    });
}); };
var readJson = function () {
    var data = fs.readFileSync('JSON/dataManagement.json', 'utf-8');
    return JSON.parse(data);
};
var writeJson = function (data) {
    fs.writeFileSync('JSON/dataManagement.json', JSON.stringify(data, null, 4));
};
var saveAsJson = function (data, filename) {
    fs.writeFileSync("./JSON/".concat(filename, ".json"), JSON.stringify(data, null, 4), 'utf8');
};
var getDate = function () {
    var dt = new Date();
    var text = dt.getFullYear() + //年の取得
        ('00' + (dt.getMonth() + 1)).slice(-2) + //月の取得 ※0~11で取得になるため+1
        ('00' + dt.getDate()).slice(-2) + //日付の取得
        ('00' + dt.getHours()).slice(-2) + //時間の取得
        ('00' + dt.getMinutes()).slice(-2) + //分の取得
        ('00' + dt.getSeconds()).slice(-2); //秒の取得
    return text;
};
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var tweets, tweetArray, _i, tweets_1, item, solveResult, fetchResult, faileResults, _a, fetchResult_1, item;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, formattedDB.find({})];
            case 1:
                tweets = _b.sent();
                tweetArray = [];
                for (_i = 0, tweets_1 = tweets; _i < tweets_1.length; _i++) {
                    item = tweets_1[_i];
                    tweetArray.push(new tweet(item));
                }
                return [4 /*yield*/, tweetMediaSolver(tweetArray)];
            case 2:
                solveResult = _b.sent();
                return [4 /*yield*/, fetchAllMedia(tweetArray)];
            case 3:
                fetchResult = _b.sent();
                faileResults = [];
                for (_a = 0, fetchResult_1 = fetchResult; _a < fetchResult_1.length; _a++) {
                    item = fetchResult_1[_a];
                    if (item.status === 'warn') {
                        faileResults.push(item);
                    }
                }
                saveAsJson(solveResult, 'solveResult');
                saveAsJson(fetchResult, 'fetchResult');
                saveAsJson(tweetArray, 'tweetArray');
                saveAsJson(faileResults, 'faileResults');
                return [2 /*return*/];
        }
    });
}); })();
