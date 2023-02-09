const sex = {
    _maxResultsWhenFetchLast: 100,
    _realData: {
        data: [
            {
                edit_history_tweet_ids: ['1530546479454384129'],
                text: '俺らのトロールピックでプロゲーマー1人の人生壊して草 https://t.co/ZE7pFhirWF',
                referenced_tweets: [
                    {
                        type: 'quoted',
                        id: '1530513659616968704',
                    },
                ],
                author_id: '1492917360206180353',
                id: '1530546479454384129',
            },
        ],
        includes: {
            users: [
                {
                    id: '1492917360206180353',
                    name: '太田',
                    username: 'yxkmadd',
                },
            ],
            tweets: [
                {
                    edit_history_tweet_ids: ['1530513659616968704'],
                    text: '【Atlas News】\n\nAtlasGaming  Valorant部門所属\n\nTaem1n  @TAEMINvlrt \n\n選手を契約違反により、契約解除致します事をお知らせさせて頂きます\n\n#AtlasGaming',
                    author_id: '1212943642777677824',
                    id: '1530513659616968704',
                },
            ],
        },
        meta: {
            result_count: 1,
        },
    },
    _rateLimit: {
        limit: 180,
        remaining: 163,
        reset: 1675915370,
    },
    _instance: {
        _currentUser: null,
        _currentUserV2: {
            value: {
                data: {
                    id: '980345742593212416',
                    name: 'Buntin-Liz',
                    username: 'LArchel_Liz',
                },
            },
            promise: {},
        },
        _requestMaker: {
            rateLimits: {
                'https://api.twitter.com/2/users/me': {
                    limit: 75,
                    remaining: 70,
                    reset: 1675915370,
                },
                'https://api.twitter.com/2/users/:id/bookmarks': {
                    limit: 180,
                    remaining: 163,
                    reset: 1675915370,
                },
            },
            clientSettings: {},
            bearerToken:
                'VUtKVlhxZTRfdVY4NGsxb0lxenlLZ19rZ29QM3djbmhDNTdGZVJRcjhaVTB4OjE2NzU5MTMzMDgyODg6MToxOmF0OjE',
        },
        _prefix: 'https://api.twitter.com/2/',
    },
    _queryParams: {
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
        max_results: 100,
    },
    _sharedParams: {
        id: '980345742593212416',
    },
    _endpoint: 'users/:id/bookmarks',
};

const { users, media } = sex._realData.includes;

console.log(users);
console.log(media);
