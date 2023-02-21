const fs = require('fs');
const _ = require('lodash');
const Datastore = require('nedb-promises');
const userDB = Datastore.create('db/users.db'); //unique
const mediaDB = Datastore.create('db/media.db'); //unique
const OutBookmarksDB = Datastore.create('db/OutBookmarks.db'); //not unique
const FinalBookmarksDB = Datastore.create('db/FinalBookmarks.db'); //unique
const likes1 = Datastore.create('db/like.db'); //unique
const likes2 = Datastore.create('db/larchel_liz_likes.db'); //unique
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');
const dataStores = [
    userDB,
    mediaDB,
    OutBookmarksDB,
    formattedDB,
    FinalBookmarksDB,
];

const tweetSample = {
    author_id: '1231279027458961410',
    id: '1372168843691401220',
    edit_history_tweet_ids: ['1372168843691401220'],
    attachments: {
        media_keys: [
            '3_1372168820702343172',
            '3_1372168820614254595',
            '3_1372168820744355840',
            '3_1372168820551348225',
        ],
    },
    created_at: '2021-03-17T12:52:00.000Z',
    text: 'ぶらぶらする親友コンビ https://t.co/JnegLS9OQy',
    _id: 'knV1CbKNjCE66RYw',
};

const intercept = async (from, to) => {
    const result = await from.find({});
    for (const item of result) {
        const { _id, ...rest } = item;
        await to.insert(rest);
    }
};
const dataLoading = async (array) => {
    for (const item of array) {
        await item.load();
    }
};
dataLoading(dataStores);

//------------main
insertWithoutDeplicate(OutBookmarksDB, formattedDB);
