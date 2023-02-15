const fs = require('fs');
const Datastore = require('nedb-promises');
const userDB = Datastore.create('db/users.db');
userDB.load();
const mediaDB = Datastore.create('db/media.db');
mediaDB.load();
const OutBookmarksDB2 = Datastore.create('db/OutBookmarks2.db');
OutBookmarksDB2.load();
const OutBookmarksDB = Datastore.create('db/OutBookmarks.db');
OutBookmarksDB.load();
const formattedDB = Datastore.create('db/formatted.db');
const formattedDB2 = Datastore.create('db/formatted2.db');
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');

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

insertWithoutDeplicate(OutBookmarksDB2, formattedDB2);

const test = () => {
    let dup = 0,
        nodup = 0;
    dup++;
    console.log(dup);
    console.log(nodup);
};

//test();
