# Sedori AI MVP REST API Design

## Design Principles

- All tenant APIs require organization context in the path: `/v1/organizations/{organization_id}/...`.
- The authenticated user must be an active member of `{organization_id}`. Authorization is evaluated by `organization_members.role`.
- MVP roles are `owner`, `admin`, and `member`.
- Required role means the minimum role for the endpoint. `member` includes read and normal operations, `admin` includes operational configuration, and `owner` includes billing, destructive security actions, and ownership-sensitive changes.
- Every write endpoint emits `audit_logs`; credential usage also emits `api_credential_access_logs`.
- List endpoints support `limit`, `cursor`, `sort`, and domain-specific filters unless stated otherwise.
- Soft-deleted rows are hidden by default. Restore and hard delete are out of MVP scope unless listed.
- Pre-auth identity provider callbacks and initial organization provisioning are outside this tenant API surface. The MVP application must resolve or select an organization before calling these APIs.

## Common Headers

| Header | Required | Purpose |
|---|---:|---|
| `Authorization: Bearer <token>` | Yes | Authenticates the user session. |
| `Idempotency-Key` | For POST writes | Prevents duplicate purchases, exports, job runs, and listing/order mutations. |
| `X-Request-Id` | Recommended | Correlates app logs, job logs, audit logs, and security events. |

## Auth / Organization

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/me` | Return current user, membership, role, and organization settings for the selected organization. | `users`, `organizations`, `organization_members`, `organization_security_settings` | member |
| GET | `/v1/organizations/{organization_id}` | Get organization profile, status, timezone, and currency. | `organizations`, `organization_members` | member |
| PATCH | `/v1/organizations/{organization_id}` | Update organization name, slug, timezone, currency, and basic settings. | `organizations`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/members` | List active, invited, suspended, and left members. | `organization_members`, `users` | admin |
| PATCH | `/v1/organizations/{organization_id}/members/{member_id}` | Change member role or status. | `organization_members`, `audit_logs`, `security_events` | owner |
| DELETE | `/v1/organizations/{organization_id}/members/{member_id}` | Remove a member from the organization. | `organization_members`, `audit_logs`, `security_events` | owner |
| POST | `/v1/organizations/{organization_id}/invitations` | Invite a user by email with a role. | `organization_invitations`, `organization_members`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/invitations` | List pending, accepted, expired, and revoked invitations. | `organization_invitations`, `users` | admin |
| DELETE | `/v1/organizations/{organization_id}/invitations/{invitation_id}` | Revoke an invitation. | `organization_invitations`, `audit_logs` | admin |
| POST | `/v1/organizations/{organization_id}/invitations/{invitation_id}/accept` | Accept an invitation into the selected organization. | `organization_invitations`, `organization_members`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/auth/logout` | Revoke the current session for this organization context. | `sessions`, `audit_logs`, `security_events` | member |

## API Credentials

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/api-credentials` | List connected external API credentials without returning secrets. | `api_credentials` | admin |
| POST | `/v1/organizations/{organization_id}/api-credentials` | Create encrypted credentials for Amazon SP-API, Keepa, Rakuten, Yahoo, eBay, accounting, AI, or other providers. | `api_credentials`, `audit_logs`, `security_events` | admin |
| GET | `/v1/organizations/{organization_id}/api-credentials/{credential_id}` | Get credential metadata, status, scopes, and last verification result. | `api_credentials` | admin |
| PATCH | `/v1/organizations/{organization_id}/api-credentials/{credential_id}` | Update display name, scopes, status, or encrypted token material. | `api_credentials`, `audit_logs`, `security_events` | admin |
| DELETE | `/v1/organizations/{organization_id}/api-credentials/{credential_id}` | Revoke and soft-delete a credential. | `api_credentials`, `audit_logs`, `security_events` | owner |
| POST | `/v1/organizations/{organization_id}/api-credentials/{credential_id}/verify` | Verify external connectivity and update last verified/error fields. | `api_credentials`, `api_credential_access_logs`, `security_events` | admin |
| POST | `/v1/organizations/{organization_id}/api-credentials/{credential_id}/rotate` | Rotate encrypted key/token material and record security event. | `api_credentials`, `api_credential_access_logs`, `audit_logs`, `security_events` | owner |
| GET | `/v1/organizations/{organization_id}/api-credential-access-logs` | List credential access and verification logs. | `api_credential_access_logs`, `api_credentials`, `users`, `job_runs` | admin |

## Products / Identifiers

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/products` | Search products by title, brand, model, status, category, or identifier. | `products`, `product_identifiers` | member |
| POST | `/v1/organizations/{organization_id}/products` | Create a product master record. | `products`, `product_identifiers`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/products/{product_id}` | Get product details, identifiers, latest market prices, and match summary. | `products`, `product_identifiers`, `market_prices`, `channel_product_matches`, `ai_scores` | member |
| PATCH | `/v1/organizations/{organization_id}/products/{product_id}` | Update product attributes, restriction flags, notes, or status. | `products`, `audit_logs` | member |
| DELETE | `/v1/organizations/{organization_id}/products/{product_id}` | Archive a product and hide it from active workflows. | `products`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/products/{product_id}/identifiers` | List JAN/EAN/UPC/ISBN/ASIN/SKU/model/channel identifiers. | `product_identifiers` | member |
| POST | `/v1/organizations/{organization_id}/products/{product_id}/identifiers` | Add an identifier to a product. | `product_identifiers`, `products`, `audit_logs` | member |
| PATCH | `/v1/organizations/{organization_id}/product-identifiers/{identifier_id}` | Update identifier metadata, confidence, primary flag, or source channel. | `product_identifiers`, `audit_logs` | member |
| DELETE | `/v1/organizations/{organization_id}/product-identifiers/{identifier_id}` | Soft-delete an identifier. | `product_identifiers`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/market-prices` | Query historical market prices by product, channel, condition, seller, and fetched time. | `market_prices`, `products` | member |
| POST | `/v1/organizations/{organization_id}/market-prices` | Ingest fetched price snapshots from marketplace APIs or crawlers. | `market_prices`, `api_credentials`, `job_runs`, `usage_logs` | member |

## Cross Platform Compare

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| POST | `/v1/organizations/{organization_id}/cross-platform/compare` | Run an on-demand comparison for identifiers, product IDs, or channel URLs. | `products`, `product_identifiers`, `market_prices`, `channel_product_matches`, `cross_channel_opportunities`, `usage_logs` | member |
| GET | `/v1/organizations/{organization_id}/channel-product-matches` | List product matches across channels with confidence and verification filters. | `channel_product_matches`, `products`, `product_identifiers` | member |
| POST | `/v1/organizations/{organization_id}/channel-product-matches` | Create or import a channel-to-product match. | `channel_product_matches`, `products`, `market_prices`, `audit_logs` | member |
| PATCH | `/v1/organizations/{organization_id}/channel-product-matches/{match_id}` | Verify, correct, or detach a channel match. | `channel_product_matches`, `audit_logs` | member |
| DELETE | `/v1/organizations/{organization_id}/channel-product-matches/{match_id}` | Archive an incorrect channel match. | `channel_product_matches`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/cross-channel-opportunities` | List detected price gaps, restock watches, and exit opportunities. | `cross_channel_opportunities`, `products`, `channel_product_matches`, `market_prices`, `ai_scores` | member |
| GET | `/v1/organizations/{organization_id}/cross-channel-opportunities/{opportunity_id}` | Get opportunity detail with buy/sell price basis and profit assumptions. | `cross_channel_opportunities`, `products`, `market_prices`, `ai_scores` | member |
| POST | `/v1/organizations/{organization_id}/cross-channel-opportunities/{opportunity_id}/refresh` | Refresh prices and recompute opportunity metrics. | `cross_channel_opportunities`, `market_prices`, `jobs`, `job_runs`, `usage_logs` | member |

## Sourcing Candidates / Opportunities

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/sourcing-candidates` | List sourcing candidates by status, channel, condition, profit, ROI, and AI judgement. | `sourcing_candidates`, `cross_channel_opportunities`, `products`, `ai_scores` | member |
| POST | `/v1/organizations/{organization_id}/sourcing-candidates` | Create a candidate from manual input, a channel URL, or an opportunity. | `sourcing_candidates`, `products`, `cross_channel_opportunities`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}` | Get candidate details, source listing, estimates, score, and linked opportunity. | `sourcing_candidates`, `products`, `cross_channel_opportunities`, `ai_scores` | member |
| PATCH | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}` | Update candidate status, pricing assumptions, notes, or expiry. | `sourcing_candidates`, `audit_logs` | member |
| DELETE | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}` | Archive a candidate. | `sourcing_candidates`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}/approve` | Approve a candidate for purchase planning. | `sourcing_candidates`, `audit_logs`, `alerts` | member |
| POST | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}/reject` | Reject a candidate with a reason. | `sourcing_candidates`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/sourcing-candidates/{candidate_id}/convert-to-purchase` | Create a purchase order item from an approved candidate. | `sourcing_candidates`, `purchase_orders`, `purchase_order_items`, `suppliers`, `audit_logs` | member |

## AI Scores

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/ai-scores` | List AI scores by target type, judgement, product, candidate, or opportunity. | `ai_scores`, `products`, `sourcing_candidates`, `cross_channel_opportunities` | member |
| POST | `/v1/organizations/{organization_id}/ai-scores` | Request AI scoring for a product, candidate, listing, or opportunity. | `ai_scores`, `jobs`, `job_runs`, `usage_logs`, `api_credentials` | member |
| GET | `/v1/organizations/{organization_id}/ai-scores/{score_id}` | Get score detail, judgement, rationale, feature payload, and model metadata. | `ai_scores`, `usage_logs` | member |
| POST | `/v1/organizations/{organization_id}/ai-scores/batch` | Request batch scoring for multiple targets. | `ai_scores`, `jobs`, `job_runs`, `usage_logs` | member |
| POST | `/v1/organizations/{organization_id}/ai-scores/{score_id}/feedback` | Store human feedback and corrected judgement for future evaluation. | `ai_scores`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/ai-scores/{score_id}/recalculate` | Re-run scoring with current market data and model settings. | `ai_scores`, `market_prices`, `jobs`, `job_runs`, `usage_logs` | member |

## Inventory / Purchases

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/suppliers` | List suppliers and purchase sources. | `suppliers` | member |
| POST | `/v1/organizations/{organization_id}/suppliers` | Create a supplier/source record. | `suppliers`, `audit_logs` | member |
| PATCH | `/v1/organizations/{organization_id}/suppliers/{supplier_id}` | Update supplier profile, type, notes, or status. | `suppliers`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/purchase-orders` | List purchase orders by status, supplier, date, and channel. | `purchase_orders`, `purchase_order_items`, `suppliers` | member |
| POST | `/v1/organizations/{organization_id}/purchase-orders` | Create purchase order with items and source details. | `purchase_orders`, `purchase_order_items`, `suppliers`, `sourcing_candidates`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/purchase-orders/{purchase_order_id}` | Get purchase order detail and receipt status. | `purchase_orders`, `purchase_order_items`, `receipts`, `inventory_items` | member |
| PATCH | `/v1/organizations/{organization_id}/purchase-orders/{purchase_order_id}` | Update order status, costs, expected arrival, or item quantities. | `purchase_orders`, `purchase_order_items`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/purchase-orders/{purchase_order_id}/receipts` | Receive purchased items into inventory. | `receipts`, `inventory_items`, `inventory_movements`, `purchase_orders`, `purchase_order_items`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/inventory-items` | List inventory by product, SKU, condition, location, status, and cost basis. | `inventory_items`, `products`, `purchase_order_items`, `listings` | member |
| GET | `/v1/organizations/{organization_id}/inventory-items/{inventory_item_id}` | Get inventory item detail, movements, purchase source, and linked listings/orders. | `inventory_items`, `inventory_movements`, `purchase_order_items`, `listings`, `order_items` | member |
| PATCH | `/v1/organizations/{organization_id}/inventory-items/{inventory_item_id}` | Update SKU, condition, location, status, cost basis, or notes. | `inventory_items`, `inventory_movements`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/inventory-items/{inventory_item_id}/adjustments` | Record stock adjustment, transfer, damage, or write-off. | `inventory_items`, `inventory_movements`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/inventory-movements` | List inventory movement history. | `inventory_movements`, `inventory_items`, `users` | member |
| POST | `/v1/organizations/{organization_id}/secondhand-trade-records` | Create secondhand dealer compliance record for buy/sell identity tracking. | `secondhand_trade_records`, `purchase_orders`, `orders`, `audit_logs` | admin |

## Orders / Listings

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/channels` | List configured sales channels. | `channels`, `api_credentials` | member |
| POST | `/v1/organizations/{organization_id}/channels` | Create a channel configuration. | `channels`, `api_credentials`, `audit_logs` | admin |
| PATCH | `/v1/organizations/{organization_id}/channels/{channel_id}` | Update channel settings and status. | `channels`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/listings` | List listings by channel, status, product, inventory item, and price. | `listings`, `channels`, `products`, `inventory_items` | member |
| POST | `/v1/organizations/{organization_id}/listings` | Create a marketplace listing draft or active listing. | `listings`, `inventory_items`, `products`, `channels`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/listings/{listing_id}` | Get listing detail and channel sync metadata. | `listings`, `channels`, `products`, `inventory_items`, `fees` | member |
| PATCH | `/v1/organizations/{organization_id}/listings/{listing_id}` | Update listing price, quantity, status, title, or channel fields. | `listings`, `inventory_movements`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/listings/{listing_id}/sync` | Push or pull listing state with the external channel. | `listings`, `channels`, `api_credentials`, `api_credential_access_logs`, `jobs`, `job_runs` | member |
| GET | `/v1/organizations/{organization_id}/orders` | List orders by channel, status, buyer, purchased date, and shipment state. | `orders`, `order_items`, `channels`, `shipments`, `returns` | member |
| POST | `/v1/organizations/{organization_id}/orders/import` | Import orders from channel APIs or uploaded marketplace data. | `orders`, `order_items`, `fees`, `shipments`, `api_credentials`, `usage_logs` | member |
| GET | `/v1/organizations/{organization_id}/orders/{order_id}` | Get order detail, items, fees, shipment, return, and accounting links. | `orders`, `order_items`, `fees`, `shipments`, `returns`, `accounting_entries` | member |
| PATCH | `/v1/organizations/{organization_id}/orders/{order_id}` | Update internal order status, memo, shipment state, or reconciliation flags. | `orders`, `shipments`, `returns`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/orders/{order_id}/shipments` | Create or update shipment tracking for an order. | `shipments`, `orders`, `audit_logs` | member |
| POST | `/v1/organizations/{organization_id}/orders/{order_id}/returns` | Create return/refund workflow record. | `returns`, `orders`, `order_items`, `fees`, `inventory_movements`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/fees` | List marketplace fees by order, listing, channel, and fee type. | `fees`, `orders`, `order_items`, `listings` | member |

## Accounting Exports

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/accounting-accounts` | List internal accounting account mappings. | `accounting_accounts` | admin |
| POST | `/v1/organizations/{organization_id}/accounting-accounts` | Create account mapping for sales, COGS, fees, tax, cash, or inventory. | `accounting_accounts`, `audit_logs` | admin |
| PATCH | `/v1/organizations/{organization_id}/accounting-accounts/{account_id}` | Update account mapping. | `accounting_accounts`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/accounting-entries` | List generated accounting entries by period, status, source, and type. | `accounting_entries`, `orders`, `fees`, `purchase_orders`, `inventory_movements` | member |
| POST | `/v1/organizations/{organization_id}/accounting-entries/generate` | Generate accounting entries from orders, purchases, fees, inventory movements, and settlements. | `accounting_entries`, `orders`, `fees`, `purchase_orders`, `inventory_movements`, `settlement_reports`, `jobs`, `job_runs` | admin |
| PATCH | `/v1/organizations/{organization_id}/accounting-entries/{entry_id}` | Update entry status, mapping, memo, or manual adjustment fields. | `accounting_entries`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/accounting-exports` | List exports to CSV, freee, Money Forward, or other formats. | `accounting_exports`, `accounting_export_entries` | member |
| POST | `/v1/organizations/{organization_id}/accounting-exports` | Create an export job for a period and destination format. | `accounting_exports`, `accounting_export_entries`, `accounting_entries`, `jobs`, `job_runs`, `api_credentials`, `usage_logs` | admin |
| GET | `/v1/organizations/{organization_id}/accounting-exports/{export_id}` | Get export status, counts, errors, and download metadata. | `accounting_exports`, `accounting_export_entries`, `job_runs` | member |
| GET | `/v1/organizations/{organization_id}/accounting-exports/{export_id}/download` | Download completed export file. | `accounting_exports`, `audit_logs` | admin |
| POST | `/v1/organizations/{organization_id}/settlement-reports/import` | Import channel settlement report data. | `settlement_reports`, `accounting_entries`, `api_credentials`, `jobs`, `job_runs` | admin |
| GET | `/v1/organizations/{organization_id}/cashflow-snapshots` | List cashflow snapshots by period. | `cashflow_snapshots`, `accounting_entries`, `orders`, `purchase_orders` | member |
| POST | `/v1/organizations/{organization_id}/tax-summary-reports/generate` | Generate tax summary for a target period. | `tax_summary_reports`, `accounting_entries`, `fees`, `orders`, `purchase_orders`, `jobs`, `job_runs` | admin |

## Jobs / Alerts

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/jobs` | List scheduled and manual jobs by type, queue, status, and next run. | `jobs` | admin |
| POST | `/v1/organizations/{organization_id}/jobs` | Create a scheduled job for price fetch, order import, scoring, accounting, or alert checks. | `jobs`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/jobs/{job_id}` | Get job configuration and latest run summary. | `jobs`, `job_runs` | admin |
| PATCH | `/v1/organizations/{organization_id}/jobs/{job_id}` | Update job status, schedule, payload, retry policy, and concurrency. | `jobs`, `audit_logs` | admin |
| DELETE | `/v1/organizations/{organization_id}/jobs/{job_id}` | Archive a job and stop future runs. | `jobs`, `audit_logs` | admin |
| POST | `/v1/organizations/{organization_id}/jobs/{job_id}/run` | Enqueue an immediate manual job run. | `jobs`, `job_runs`, `audit_logs`, `usage_logs` | member |
| GET | `/v1/organizations/{organization_id}/job-runs` | List job run history by job, status, queue, trigger, and time. | `job_runs`, `jobs` | admin |
| GET | `/v1/organizations/{organization_id}/job-runs/{run_id}` | Get job run detail, progress, output payload, and failure reason. | `job_runs`, `jobs`, `job_run_logs` | admin |
| POST | `/v1/organizations/{organization_id}/job-runs/{run_id}/cancel` | Cancel a queued or running job run. | `job_runs`, `audit_logs` | admin |
| POST | `/v1/organizations/{organization_id}/job-runs/{run_id}/retry` | Retry a failed or timed-out job run. | `job_runs`, `jobs`, `audit_logs`, `usage_logs` | admin |
| GET | `/v1/organizations/{organization_id}/job-runs/{run_id}/logs` | List logs for a job run. | `job_run_logs`, `job_runs` | admin |
| GET | `/v1/organizations/{organization_id}/alerts` | List alerts by severity, status, target type, and creation time. | `alerts`, `alert_deliveries`, `jobs`, `job_runs` | member |
| PATCH | `/v1/organizations/{organization_id}/alerts/{alert_id}` | Mute, resolve, or reopen an alert. | `alerts`, `audit_logs` | member |
| GET | `/v1/organizations/{organization_id}/notification-channels` | List notification channels. | `notification_channels` | admin |
| POST | `/v1/organizations/{organization_id}/notification-channels` | Create email, Slack, webhook, LINE, SMS, Discord, or other notification channel. | `notification_channels`, `audit_logs` | admin |
| PATCH | `/v1/organizations/{organization_id}/notification-channels/{channel_id}` | Update notification channel configuration and status. | `notification_channels`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/alert-deliveries` | List alert delivery attempts and failures. | `alert_deliveries`, `alerts`, `notification_channels` | admin |

## Usage / Billing

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/usage` | Return usage summary by period, feature, provider, model, job type, and API action. | `usage_logs`, `billing_usage_limits`, `billing_subscriptions` | admin |
| GET | `/v1/organizations/{organization_id}/usage/logs` | List detailed usage events for AI, API calls, jobs, exports, and imports. | `usage_logs`, `users`, `job_runs`, `api_credentials` | admin |
| GET | `/v1/organizations/{organization_id}/billing/plans` | List active billing plans available to the organization. | `billing_plans` | owner |
| GET | `/v1/organizations/{organization_id}/billing/subscription` | Get current subscription, plan, status, trial, and renewal metadata. | `billing_subscriptions`, `billing_plans`, `billing_usage_limits` | owner |
| POST | `/v1/organizations/{organization_id}/billing/subscription` | Start or change subscription plan. | `billing_subscriptions`, `billing_plans`, `billing_invoices`, `audit_logs` | owner |
| PATCH | `/v1/organizations/{organization_id}/billing/subscription` | Pause, resume, cancel, or update billing metadata. | `billing_subscriptions`, `billing_invoices`, `audit_logs` | owner |
| GET | `/v1/organizations/{organization_id}/billing/usage-limits` | List plan and organization usage limits. | `billing_usage_limits`, `billing_plans`, `billing_subscriptions` | owner |
| PATCH | `/v1/organizations/{organization_id}/billing/usage-limits/{limit_id}` | Update configurable organization usage limit overrides. | `billing_usage_limits`, `audit_logs` | owner |
| GET | `/v1/organizations/{organization_id}/billing/invoices` | List invoices. | `billing_invoices`, `billing_invoice_items` | owner |
| GET | `/v1/organizations/{organization_id}/billing/invoices/{invoice_id}` | Get invoice detail and line items. | `billing_invoices`, `billing_invoice_items` | owner |

## Audit Logs / Security Events

| method | path | purpose | main tables | required role |
|---|---|---|---|---|
| GET | `/v1/organizations/{organization_id}/audit-logs` | Search audit log events by action, resource, actor, and time range. | `audit_logs`, `users` | admin |
| GET | `/v1/organizations/{organization_id}/audit-logs/{audit_log_id}` | Get detailed before/after data and metadata for an audit event. | `audit_logs`, `users` | admin |
| GET | `/v1/organizations/{organization_id}/security-events` | List login, credential, permission, billing, and anomaly security events. | `security_events`, `users` | admin |
| GET | `/v1/organizations/{organization_id}/security-events/{event_id}` | Get security event detail and resolution metadata. | `security_events`, `users` | admin |
| POST | `/v1/organizations/{organization_id}/security-events/{event_id}/resolve` | Resolve a security event. | `security_events`, `audit_logs` | admin |
| POST | `/v1/organizations/{organization_id}/security-events/{event_id}/reopen` | Reopen a resolved security event. | `security_events`, `audit_logs` | admin |
| GET | `/v1/organizations/{organization_id}/security-settings` | Get organization security settings, retention windows, and credential rotation policy. | `organization_security_settings` | admin |
| PATCH | `/v1/organizations/{organization_id}/security-settings` | Update audit retention, security retention, and credential rotation settings. | `organization_security_settings`, `audit_logs`, `security_events` | owner |

