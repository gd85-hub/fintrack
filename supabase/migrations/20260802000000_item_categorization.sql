create table item_category_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  normalized_name text not null check (char_length(normalized_name) > 0),
  category_id     uuid references categories(id),
  action          text not null default 'categorize' check (action in ('categorize', 'exclude')),
  hit_count       int not null default 1 check (hit_count > 0),
  updated_at      timestamptz not null default now(),
  unique (user_id, normalized_name),
  check (
    (action = 'categorize' and category_id is not null) or
    (action = 'exclude' and category_id is null)
  )
);

create index item_category_rules_lookup_idx
  on item_category_rules (user_id, normalized_name);

create trigger item_category_rules_set_updated_at
  before update on item_category_rules
  for each row execute function set_updated_at();

alter table item_category_rules enable row level security;

create policy item_category_rules_select on item_category_rules
  for select using (user_id = auth.uid());
create policy item_category_rules_insert on item_category_rules
  for insert with check (user_id = auth.uid());
create policy item_category_rules_update on item_category_rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy item_category_rules_delete on item_category_rules
  for delete using (user_id = auth.uid());
