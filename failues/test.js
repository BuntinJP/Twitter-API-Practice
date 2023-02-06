const Nedb = require('nedb');
const path = require('path');
const dbpath = path.join(__dirname, 'test.db');
console.log(dbpath);
const testDB = new Nedb({ filename: dbpath, autoload: true });
testDB.loadDatabase();

const init = (db) => {
    const doc = [
        {
            edit_history_tweet_ids: ['1622404506381340672'],
            created_at: '2023-02-06T01:19:11.000Z',
            id: '1622404506381340672',
            text: '資本主義\n勝ち逃げしたい人この指とまれ\n👆',
        },
        {
            edit_history_tweet_ids: ['1622271277833793537'],
            created_at: '2023-02-05T16:29:47.000Z',
            id: '1622271277833793537',
            text: 'マックちゃん　#ウマ娘 https://t.co/7gha7GoPFw',
        },
        {
            edit_history_tweet_ids: ['1622159082840014848'],
            created_at: '2023-02-05T09:03:58.000Z',
            id: '1622159082840014848',
            text: '[R-18/NSFW]あられもない格好で街のお祭りに参加するHD2D風のRPG https://t.co/Q5azOCP6IM',
        },
        {
            edit_history_tweet_ids: ['1618911720348721154'],
            created_at: '2023-01-27T10:00:06.000Z',
            id: '1618911720348721154',
            text: '付き合いたての頃は貧乳を恥ずかしがってひた隠しにしていたのに同棲した今ではすっかり裸族になって貧乳どころか全部丸出しで胡坐かいてスマホいじってる女の子 https://t.co/vrBNRsn5RZ',
        },
    ];
    db.insert(doc, (err, doc) => {
        if (err) {
            console.error(err);
        }
        console.log(doc);
    });
};
init(testDB);

const get = (db) => {
    db.find({})
        .sort({ created_at: 1 })
        .exec((err, docs) => {
            console.log(docs);
        });
};

//get(testDB);
