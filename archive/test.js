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
const formattedDB = Datastore.create('db/formatted.db'); //unique
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { setTimeout } = require('timers/promises');
const loading = require('loading-cli');

(async () => {
    const result = await OutBookmarksDB.find({});
    console.log(result.length);
    const ids = result.map((item) => item.id);
    let i = 0;
    for (const id of ids) {
        const match = await formattedDB.count({ id: id });
        if (match === 0) {
            console.log(id);
        } else {
            console.log(true);
        }
    }
})();
