const Datastore = require('nedb-promises');
const userDB = Datastore.create('db/users.db');
const mediaDB = Datastore.create('db/media.db');
const bookmarkDB = Datastore.create('db/bookmarks.db');
const bookmarkDB2 = Datastore.create('db/bookmarks2.db');

console.log(1);

bookmarkDB.find({}).then((docs) => {
    console.log(2);
    console.log(docs.length);
});

console.log(3);
