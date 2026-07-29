-- Enable pgcrypto if not already (Supabase usually has gen_random_uuid available)
create extension if not exists pgcrypto;

-- ========================================================================
-- Reference tables: NULL user_id = system default; non-NULL = user-created
-- ========================================================================

create table merchant_types (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- stable code: shop, cafe, restaurant, online, other
  emoji      text not null default '',
  name       text not null,                 -- display name (RU)
  user_id    uuid references auth.users(id) on delete cascade,  -- NULL = system default
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique,                   -- stable code for system categories; NULL for user categories
  emoji      text not null default '',
  name       text not null,
  "group"    text not null,                 -- Еда, Жильё, Транспорт, ... (plain text in v1)
  type       text not null check (type in ('fixed','variable')),
  is_system  boolean not null default false,
  user_id    uuid references auth.users(id) on delete cascade,  -- NULL = system default
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ========================================================================
-- FX rates: server-written, user read-only. History kept per day.
-- ========================================================================

create table fx_rates (
  date           date not null,
  base_currency  text not null check (char_length(base_currency) = 3),
  quote_currency text not null check (char_length(quote_currency) = 3),
  rate           numeric(18,8) not null check (rate > 0),
  source         text not null default '',
  created_at     timestamptz not null default now(),
  primary key (date, base_currency, quote_currency)
);

-- ========================================================================
-- Per-user data
-- ========================================================================

create table merchants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type_id    uuid references merchant_types(id),
  aliases    text[] not null default '{}',  -- alternate strings to match OCR merchant names
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index merchants_user_name_uniq on merchants (user_id, lower(name));

create table receipts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null check (source in ('fiscal_qr','ocr_photo','ocr_email')),
  merchant_id uuid references merchants(id) on delete set null,
  tax_id     text,                          -- ПИБ / VAT id if known
  occurred_at timestamptz,
  total      numeric(18,2),
  currency   text check (char_length(currency) = 3),
  payment_type text,
  raw_json   jsonb,                          -- parsed receipt payload (NO image is stored)
  parsed_ok  boolean not null default false,
  created_at timestamptz not null default now()
);

create table expenses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  occurred_on      date not null,            -- date used for FX + month grouping (Europe/Belgrade)
  occurred_at      timestamptz,              -- exact time if known (from receipt)
  description      text not null default '',
  category_id      uuid not null references categories(id),
  merchant_id      uuid references merchants(id) on delete set null,  -- NULL = место не определено
  original_amount  numeric(18,2) not null check (original_amount >= 0),
  original_currency text not null check (char_length(original_currency) = 3),  -- any world currency
  amount_rsd       numeric(18,2),            -- filled at write time in Phase 1; NULL until computed
  amount_usd       numeric(18,2),
  amount_eur       numeric(18,2),
  fx_rate_date     date,                     -- which day's rates were used for conversion
  note             text,
  source           text not null check (source in ('manual','fiscal_qr','ocr_photo','ocr_email')),
  receipt_id       uuid references receipts(id) on delete set null,   -- many expenses per receipt (line items)
  is_recurring     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index expenses_user_date_idx on expenses (user_id, occurred_on);
create index expenses_receipt_idx   on expenses (receipt_id);

create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  merchant_id   uuid references merchants(id) on delete set null,
  category_id   uuid references categories(id),
  amount        numeric(18,2) not null check (amount >= 0),
  currency      text not null check (char_length(currency) = 3),
  period        text not null check (period in ('weekly','monthly','quarterly','yearly')),
  active        boolean not null default true,
  next_charge_date date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ========================================================================
-- updated_at maintenance
-- ========================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger merchants_set_updated_at     before update on merchants     for each row execute function set_updated_at();
create trigger expenses_set_updated_at      before update on expenses      for each row execute function set_updated_at();
create trigger subscriptions_set_updated_at before update on subscriptions for each row execute function set_updated_at();

alter table merchant_types enable row level security;
alter table categories     enable row level security;
alter table fx_rates       enable row level security;
alter table merchants      enable row level security;
alter table receipts       enable row level security;
alter table expenses       enable row level security;
alter table subscriptions  enable row level security;

-- Reference tables: everyone reads system rows (user_id NULL) + their own; writes only their own.
create policy mt_select on merchant_types for select using (user_id is null or user_id = auth.uid());
create policy mt_insert on merchant_types for insert with check (user_id = auth.uid());
create policy mt_update on merchant_types for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mt_delete on merchant_types for delete using (user_id = auth.uid());

create policy cat_select on categories for select using (user_id is null or user_id = auth.uid());
create policy cat_insert on categories for insert with check (user_id = auth.uid());
create policy cat_update on categories for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cat_delete on categories for delete using (user_id = auth.uid());

-- FX rates: authenticated users read-only. No insert/update/delete policies => blocked for anon/auth.
-- (The server writes rates using the service role, which bypasses RLS.)
create policy fx_select on fx_rates for select to authenticated using (true);

-- Per-user tables: full CRUD scoped to the owner.
create policy merchants_all on merchants
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy receipts_all on receipts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy expenses_all on expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_all on subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Merchant types
insert into merchant_types (slug, emoji, name, sort) values
  ('shop',       '🛒', 'Магазин',   10),
  ('cafe',       '☕', 'Кафе',       20),
  ('restaurant', '🍽', 'Ресторан',   30),
  ('online',     '🌐', 'Онлайн',     40),
  ('other',      '📍', 'Прочее',     50);

-- System category for "not recognized" (never deletable via UI; referenced in code by slug)
insert into categories (slug, emoji, name, "group", type, is_system, sort) values
  ('uncategorized', '❓', 'Не распознано', 'Прочее', 'variable', true, 0);

-- Default categories (from the user's existing tracker)
insert into categories (emoji, name, "group", type, active, sort) values
  ('🍔', 'Кафе и рестораны', 'Еда',       'variable', true,  10),
  ('🛒', 'Продукты',         'Еда',       'variable', true,  20),
  ('☕', 'Кофе',             'Еда',       'variable', true,  30),
  ('🏠', 'Аренда',           'Жильё',     'fixed',    true,  40),
  ('⚡', 'Коммуналка',       'Жильё',     'fixed',    true,  50),
  ('💻', 'Интернет',         'Жильё',     'fixed',    true,  60),
  ('🚗', 'Транспорт',        'Транспорт', 'variable', true,  70),
  ('⛽', 'Бензин',           'Транспорт', 'variable', false, 80),
  ('🏥', 'Здоровье',         'Здоровье',  'variable', true,  90),
  ('💊', 'Аптека',           'Здоровье',  'variable', true, 100),
  ('🎭', 'Развлечения',      'Досуг',     'variable', true, 110),
  ('✈️', 'Путешествия',      'Досуг',     'variable', true, 120),
  ('👕', 'Одежда',           'Личное',    'variable', true, 130),
  ('🎁', 'Подарки',          'Личное',    'variable', true, 140),
  ('🐾', 'Животные',         'Личное',    'variable', true, 150),
  ('🧴', 'Гигиена',          'Личное',    'variable', true, 160),
  ('📱', 'Мобильная связь',  'Сервисы',   'variable', true, 170),
  ('📱', 'Подписки',         'Сервисы',   'fixed',    true, 180),
  ('📚', 'Образование',      'Развитие',  'variable', true, 190),
  ('💼', 'Работа',           'Работа',    'variable', true, 200),
  ('📋', 'Налоги',           'Работа',    'variable', true, 210),
  ('🔧', 'Ремонт',           'Дом',       'variable', true, 220),
  ('🏠', 'Быт',              'Дом',       'variable', true, 230),
  ('📺', 'Техника',          'Дом',       'variable', true, 240),
  ('📦', 'Прочее',           'Прочее',    'variable', true, 250);
