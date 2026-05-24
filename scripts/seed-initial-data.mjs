import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sql = `
insert into users (id, email, email_normalized, name, email_verified_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'demo@example.com',
  'demo@example.com',
  'Demo Owner',
  now()
)
on conflict (email_normalized) do update
set name = excluded.name,
    updated_at = now();

insert into organizations (id, name, slug, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000101',
  'Demo Store',
  'demo-store',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (slug) do update
set name = excluded.name,
    owner_user_id = excluded.owner_user_id,
    updated_at = now();

insert into organization_members (organization_id, user_id, role, status, joined_at)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'owner',
  'active',
  now()
)
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    updated_at = now();

insert into channels (id, organization_id, channel, name, is_enabled, settings, created_by_user_id, updated_by_user_id)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'rakuten', 'Rakuten Research', true, '{"mode":"research"}'::jsonb, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'amazon_jp', 'Amazon JP Sales', true, '{"mode":"sales"}'::jsonb, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', 'mercari', 'Mercari Manual', true, '{"mode":"manual"}'::jsonb, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (organization_id, channel, name) do update
set is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

insert into products (
  id, organization_id, title, normalized_title, brand, manufacturer, model_number,
  category, sub_category, description, image_url, status, default_condition,
  notes, created_by_user_id, updated_by_user_id
)
values
  (
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000000101',
    'Nintendo Switch Joy-Con Neon Used Good',
    'nintendo switch joy con neon used good',
    'Nintendo',
    'Nintendo',
    'HAC-A-JAEAA',
    'Game Accessories',
    'Controller',
    'Seed product for marketplace sales validation.',
    null,
    'active',
    'good',
    'Fast-moving accessory. Check drift and included straps before listing.',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000001002',
    '00000000-0000-4000-8000-000000000101',
    'Panasonic Nanoe Hair Dryer EH-NA0J',
    'panasonic nanoe hair dryer eh na0j',
    'Panasonic',
    'Panasonic',
    'EH-NA0J',
    'Beauty Appliances',
    'Hair Dryer',
    'Popular model with strong resale demand.',
    null,
    'active',
    'good',
    'Operation check and filter condition matter for pricing.',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000001003',
    '00000000-0000-4000-8000-000000000101',
    'Canon PIXUS TS8530 Inkjet Printer',
    'canon pixus ts8530 inkjet printer',
    'Canon',
    'Canon',
    'TS8530',
    'PC Peripherals',
    'Printer',
    'Printer category sample with higher logistics and defect risk.',
    null,
    'active',
    'acceptable',
    'Nozzle status and shipping size drive risk.',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set title = excluded.title,
    normalized_title = excluded.normalized_title,
    brand = excluded.brand,
    manufacturer = excluded.manufacturer,
    model_number = excluded.model_number,
    category = excluded.category,
    sub_category = excluded.sub_category,
    description = excluded.description,
    status = excluded.status,
    default_condition = excluded.default_condition,
    notes = excluded.notes,
    updated_at = now();

insert into product_identifiers (organization_id, product_id, identifier_type, identifier_value, source_channel, is_primary, confidence_score)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'jan', '4902370544064', 'amazon_jp', true, 98),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'asin', 'B01N6QKT7H', 'amazon_jp', false, 92),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001002', 'jan', '4549980652953', 'rakuten', true, 96),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001003', 'jan', '4549292185502', 'yahoo_shopping', true, 93)
on conflict (organization_id, identifier_type, identifier_value) do update
set product_id = excluded.product_id,
    source_channel = excluded.source_channel,
    is_primary = excluded.is_primary,
    confidence_score = excluded.confidence_score,
    updated_at = now();

insert into market_prices (
  organization_id, product_id, source_channel, source_product_id, source_url,
  condition, price_amount, shipping_amount, point_value_amount, available_quantity,
  is_in_stock, seller_name, sales_rank, review_count, review_rating, raw_payload
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'rakuten', 'rakuten-joycon-seed', 'https://search.rakuten.co.jp/search/mall/joy-con/', 'good', 4280, 550, 120, 4, true, 'Rakuten Seed Shop', null, 128, 4.5, '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'amazon_jp', 'B01N6QKT7H', 'https://www.amazon.co.jp/s?k=joy-con', 'good', 6980, 0, 0, 12, true, 'Amazon JP', 2400, 842, 4.4, '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001002', 'yahoo_auction', 'yahoo-eh-na0j-seed', 'https://auctions.yahoo.co.jp/search/search?p=EH-NA0J', 'good', 14400, 900, 0, 2, true, 'Yahoo Auction Seller', null, 74, 4.2, '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001002', 'mercari', 'mercari-eh-na0j-seed', 'https://jp.mercari.com/search?keyword=EH-NA0J', 'good', 19800, 750, 0, 8, true, 'Mercari Market', null, 211, 4.3, '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001003', 'store', 'hardoff-ts8530-seed', null, 'acceptable', 8800, 0, 0, 1, true, 'Hard Off Seed', null, 30, 4.0, '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001003', 'yahoo_auction', 'yahoo-ts8530-seed', 'https://auctions.yahoo.co.jp/search/search?p=TS8530', 'acceptable', 14800, 1500, 0, 3, true, 'Yahoo Auction Market', null, 56, 4.1, '{"seed":true}'::jsonb);

insert into cross_channel_opportunities (
  id, organization_id, product_id, buy_channel, buy_channel_product_id, buy_url,
  buy_condition, buy_price_amount, buy_shipping_amount, buy_point_value_amount,
  sell_channel, sell_channel_product_id, sell_url, sell_condition,
  expected_sell_price_amount, estimated_fee_amount, estimated_shipping_amount,
  estimated_packaging_amount, estimated_profit_amount, estimated_roi,
  estimated_profit_margin, match_confidence_score, demand_score, risk_score,
  judgement, reason_summary, risk_notes, status, source_snapshot
)
values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'rakuten', 'rakuten-joycon-seed', 'https://search.rakuten.co.jp/search/mall/joy-con/', 'good', 4280, 550, 120, 'amazon_jp', 'B01N6QKT7H', 'https://www.amazon.co.jp/s?k=joy-con', 'good', 6980, 698, 520, 80, 852, 0.1764, 0.1221, 86, 82, 42, 'a', '楽天仕入れからAmazon販売の検証用チャンスです。', '動作確認とスティックドリフト確認が必要です。', 'watching', '{"seed":true}'::jsonb),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001002', 'yahoo_auction', 'yahoo-eh-na0j-seed', 'https://auctions.yahoo.co.jp/search/search?p=EH-NA0J', 'good', 14400, 900, 0, 'mercari', 'mercari-eh-na0j-seed', 'https://jp.mercari.com/search?keyword=EH-NA0J', 'good', 19800, 1980, 750, 120, 1650, 0.1078, 0.0833, 78, 76, 46, 'b', '美容家電カテゴリの検証用チャンスです。', 'フィルター汚れと動作音を確認してください。', 'watching', '{"seed":true}'::jsonb)
on conflict (id) do update
set estimated_profit_amount = excluded.estimated_profit_amount,
    estimated_roi = excluded.estimated_roi,
    judgement = excluded.judgement,
    status = excluded.status,
    updated_at = now();

insert into inventory_items (
  organization_id, product_id, inventory_sku, status, condition, quantity,
  acquisition_cost_amount, expected_sell_price_amount, listed_channel,
  listed_price_amount, warehouse_code, location_code, notes, created_by_user_id, updated_by_user_id
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'INV-JOYCON-001', 'listed', 'good', 1, 4830, 6980, 'amazon_jp', 6980, 'MAIN', 'A-01', 'Seed listed inventory.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001002', 'INV-DRYER-001', 'received', 'good', 1, 15300, 19800, 'mercari', 19800, 'MAIN', 'B-02', 'Seed received inventory.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (organization_id, inventory_sku) do update
set status = excluded.status,
    condition = excluded.condition,
    quantity = excluded.quantity,
    acquisition_cost_amount = excluded.acquisition_cost_amount,
    expected_sell_price_amount = excluded.expected_sell_price_amount,
    listed_channel = excluded.listed_channel,
    listed_price_amount = excluded.listed_price_amount,
    updated_at = now();

insert into jobs (
  id, organization_id, queue_name, job_key, name, description, job_type,
  status, schedule_type, payload, priority, max_attempts, created_by_user_id, updated_by_user_id
)
values
  ('00000000-0000-4000-8000-000000003001', '00000000-0000-4000-8000-000000000101', 'imports', 'rakuten-keyword-import', 'Rakuten keyword import', '楽天APIから商品候補を取り込むジョブのseedです。', 'rakuten_product_search', 'active', 'manual', '{"keyword":"joy-con","limit":10}'::jsonb, 10, 3, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (organization_id, queue_name, job_key) do update
set name = excluded.name,
    description = excluded.description,
    payload = excluded.payload,
    updated_at = now();

insert into job_runs (
  id, organization_id, job_id, queue_name, run_key, status, trigger_type,
  scheduled_for, enqueued_at, started_at, finished_at, attempt_number,
  max_attempts, progress, input_payload, output_payload
)
values (
  '00000000-0000-4000-8000-000000003101',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000003001',
  'imports',
  'seed-run-rakuten-001',
  'succeeded',
  'manual',
  now(),
  now(),
  now(),
  now(),
  1,
  1,
  100,
  '{"keyword":"joy-con","limit":10}'::jsonb,
  '{"insertedProducts":3,"source":"seed"}'::jsonb
)
on conflict (id) do update
set status = excluded.status,
    progress = excluded.progress,
    input_payload = excluded.input_payload,
    output_payload = excluded.output_payload,
    finished_at = now();
`;

async function main() {
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(`${statement};`);
  }

  const [organizationCount, productCount, opportunityCount, inventoryCount, jobCount] = await Promise.all([
    prisma.organizations.count(),
    prisma.products.count(),
    prisma.cross_channel_opportunities.count(),
    prisma.inventory_items.count(),
    prisma.jobs.count()
  ]);

  console.log(
    JSON.stringify(
      {
        seeded: true,
        organizationCount,
        productCount,
        opportunityCount,
        inventoryCount,
        jobCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
