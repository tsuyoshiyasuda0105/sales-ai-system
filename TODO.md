# TODO

## Phase 1: Project Migration

- [x] `C:\sedori_project` にプロジェクト一式を移動
- [x] Codexプロジェクト移行用の文脈ファイルを作成
- [x] Supabase向けのPrisma設定を追加
- [ ] Codexの新規プロジェクトで `C:\sedori_project` を開く
- [ ] 新しいCodexプロジェクトで `PROJECT_CONTEXT.md` を読む

## Phase 2: Supabase Setup

- [ ] Supabaseで新規プロジェクトを作成
- [ ] SupabaseのDatabase passwordを控える
- [ ] Transaction pooler URLを取得
- [ ] Direct connection URLを取得
- [ ] Project URLを取得
- [ ] anon keyを取得
- [ ] service_role keyを取得
- [ ] `.env.example` を `.env` にコピー
- [ ] `.env` にSupabase接続情報を設定
- [ ] `npm install` を実行
- [ ] `npm run prisma:generate` を実行
- [ ] `npm run prisma:deploy` を実行
- [ ] `npm run build` を実行

## Phase 3: Database

- [ ] 現在のSQL設計とPrisma migrationの整合性を確認
- [ ] `organizations` 初期データを作成
- [ ] Demo Storeを作成
- [ ] サンプル商品を作成
- [ ] サンプル販路価格を作成
- [ ] サンプル価格差チャンスを作成
- [ ] サンプル在庫を作成
- [ ] サンプルジョブ履歴を作成
- [ ] シードスクリプトを作成
- [ ] RLS方針をSupabaseで検証

## Phase 4: App Data Integration

- [ ] ダッシュボードをDB読み込みに変更
- [ ] 横断比較をDB/API読み込みに変更
- [ ] 価格差チャンスをDB読み込みに変更
- [ ] 商品/AI判定をDB読み込みに変更
- [ ] 在庫画面をDB読み込みに変更
- [ ] ジョブ画面をDB読み込みに変更
- [ ] API設定画面をDB保存に変更

## Phase 5: Security

- [ ] APIキー保存方式を決める
- [ ] KMS候補を決める
- [ ] `api_credentials` の暗号化実装
- [ ] service role keyをサーバー専用に固定
- [ ] organization_idベースのアクセス制御を実装
- [ ] 監査ログの保存処理を実装
- [ ] API routeごとの権限チェックを実装

## Phase 6: External API Integrations

- [ ] 楽天APIキーを取得
- [ ] Yahoo APIキーを取得
- [ ] Keepa APIキーを取得
- [ ] OpenAI APIキーを取得
- [ ] 楽天商品検索の取得処理を作成
- [ ] Yahoo商品検索の取得処理を作成
- [ ] Keepa価格履歴の取得処理を作成
- [ ] OpenAIによる商品マッチング/判定を作成
- [ ] Amazon SP-APIは後続フェーズとして整理

## Phase 7: Jobs And Scheduler

- [ ] Redis/BullMQの実行環境を決める
- [ ] 価格取得ジョブを作成
- [ ] Keepa更新ジョブを作成
- [ ] 在庫滞留チェックジョブを作成
- [ ] 価格差再計算ジョブを作成
- [ ] ジョブ履歴をDBに保存
- [ ] 失敗時リトライ方針を実装

## Phase 8: SaaS Readiness

- [ ] 利用量計測を実装
- [ ] プラン別制限を実装
- [ ] テナント別API利用量を記録
- [ ] 請求/課金テーブルを実装
- [ ] Stripe等の課金連携を検討
- [ ] 利用規約/プライバシーポリシーの草案を作成

## Immediate Next Step

次にやること:

```text
Supabaseプロジェクトを作成し、C:\sedori_project\.env に接続情報を設定する。
その後、Prisma migrationをSupabaseに適用する。
```

