# Rakuten Proxy Setup

楽天APIが `CLIENT_IP_NOT_ALLOWED` を返す場合、Vercelから楽天APIへ直接送信せず、楽天に許可した固定IPサーバー経由で呼び出します。

## 構成

```text
Vercel / Next.js
  -> RAKUTEN_PROXY_URL
  -> 固定IPサーバー scripts/rakuten-proxy-server.mjs
  -> 楽天API
```

## 固定IPサーバー側の環境変数

```env
PORT=8787
RAKUTEN_APPLICATION_ID=
RAKUTEN_APP_ID=
RAKUTEN_ACCESS_KEY=
RAKUTEN_AFFILIATE_ID=
RAKUTEN_PROXY_API_KEY=
```

`RAKUTEN_PROXY_API_KEY` はVercelからプロキシを呼ぶための共有キーです。`SALES_API_KEY` とは別の長いランダム文字列にしてください。

## 固定IPサーバーで起動

```bash
npm install
npm run rakuten:proxy
```

ヘルスチェック:

```bash
curl https://your-fixed-ip-proxy.example.com/health
```

## Vercel側の環境変数

Vercelの Environment Variables に追加します。

```env
RAKUTEN_PROXY_URL=https://your-fixed-ip-proxy.example.com
RAKUTEN_PROXY_API_KEY=固定IPサーバー側と同じ値
```

`RAKUTEN_PROXY_URL` が入っている場合、Next.js側は楽天APIを直接呼ばず、プロキシへPOSTします。未設定の場合は従来通り直接楽天APIを呼びます。

## 注意

- 楽天の「許可されたIPアドレス」には、固定IPサーバーの送信元IPを入れてください。
- Vercelの通常のHobby構成では送信元IPが固定されないため、楽天の許可IPには向きません。
- プロキシURLは公開URLになります。必ず `RAKUTEN_PROXY_API_KEY` を設定してください。
