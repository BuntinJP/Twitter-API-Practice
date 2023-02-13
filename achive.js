const sleep = async (ms) => {
    //
    await setTimeout(ms);
    return;
};

const sleepLoading = async (minutes, load) => {
    let m = minutes;
    load.text = 'レート制限により一時停止中...(残り' + m + '分)';
    while (true) {
        await setTimeout(60000);
        m--;
        load.text = 'レート制限により一時停止中...(残り' + m + '分)';
        if (m <= 0) {
            load.text = '待機終了';
            break;
        }
    }
    return;
};

const lookupBookmarks = async () => {
    let idarray = [];
    await (async () => {
        const load = loading('ブックマーク取得開始').start();
        //max 800
        const bookmarks = await client.v2.bookmarks({
            expansions: [
                'referenced_tweets.id',
                'author_id',
                'attachments.media_keys',
            ],
            'media.fields': [
                'media_key',
                'preview_image_url',
                'type',
                'url',
                'public_metrics',
                'non_public_metrics',
                'organic_metrics',
                'promoted_metrics',
                'alt_text',
                'variants',
            ],
        });
        await bookmarks.fetchLast(1000);
        const users = bookmarks._realData.includes.users;
        load.text = 'ユーザー取得中...';
        await userDB.insert(users);
        await setTimeout(1000);
        load.text = 'メディア取得中...';
        const media = bookmarks._realData.includes.media;
        await mediaDB.insert(media);
        await setTimeout(1000);
        load.text = 'ブックマーク取得中...';
        const c = bookmarks._realData.data.length;
        let cnt = 1;
        for await (const bookmark of bookmarks) {
            load.text = 'ブックマーク取得中... (' + cnt + '/' + c + ')';
            let insBM = {
                id: bookmark.id,
                text: bookmark.text,
                author_id: bookmark.author_id,
                attachments: bookmark.attachments,
            };
            await bookmarkDB.insert(insBM);
            idarray.push(bookmark.id);
        }
        load.succeed('1: ブックマーク取得完了');
        return;
    })();
    return idarray;
};

const saveAsJson = (data, filename) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};
