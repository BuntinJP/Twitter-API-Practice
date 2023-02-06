import tweepy
import json

config = json.load(open('config.json', 'r'))
scopes = ['tweet.read', 'users.read', 'bookmark.read', 'bookmark.write', 'offline.access']
oauth2_user_handler = tweepy.OAuth2UserHandler(client_id=config['client_id'], redirect_uri='https://api.buntin.tech/twitter', scope=scopes, client_secret=config['client_secret'])

# まず認証画面の URL を生成する
auth_url = oauth2_user_handler.get_authorization_url()
# 上の URL にアクセスして認証を許可してリダイレクト先の URL を（パラメータ付きで）改めて以下に入力する
print(auth_url)
redirect_url = input("Enter Redirect URL: ")
# 適切なパラメータ付きのリダイレクト先の URL を渡したとき一時的なトークンがもらえる
token = oauth2_user_handler.fetch_token(redirect_url)
print(token)
