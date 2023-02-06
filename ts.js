const Nedb = require('nedb');

const bookmark2 = new Nedb({ filename: 'db/bookmarks2.db', autoload: true });
const bookmark2bk = new Nedb({
    filename: 'db/bookmarks2bk.db',
    autoload: true,
});
const getBookmarks = async (db) => {
    db.loadDatabase();
    db.find({})
        .sort({ created_at: 1 })
        .exec((err, docs) => {
            console.log(docs[0].text);
            console.log(docs[docs.length - 1].text);
        });
};
getBookmarks(bookmark2);
