-- Give every account an editable copy of the default category template.
-- The NULL-user rows remain as the template for future accounts.

alter table categories drop constraint if exists categories_slug_key;

create unique index if not exists categories_user_slug_uniq
  on categories (user_id, slug)
  where slug is not null;

create or replace function seed_user_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (
    emoji,
    name,
    "group",
    type,
    is_system,
    user_id,
    active,
    sort,
    slug
  )
  select
    emoji,
    name,
    "group",
    type,
    false,
    new.id,
    active,
    sort,
    slug
  from categories
  where user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function seed_user_categories();

-- Existing accounts receive any missing defaults without duplicating names.
insert into categories (
  emoji,
  name,
  "group",
  type,
  is_system,
  user_id,
  active,
  sort,
  slug
)
select
  defaults.emoji,
  defaults.name,
  defaults."group",
  defaults.type,
  false,
  users.id,
  defaults.active,
  defaults.sort,
  defaults.slug
from auth.users users
cross join (
  select * from categories where user_id is null
) defaults
where not exists (
  select 1
  from categories existing
  where existing.user_id = users.id
    and existing.name = defaults.name
);

-- If a user already created a same-name fallback, make it the user's stable
-- uncategorized row instead of inserting a duplicate.
update categories own
set slug = template.slug
from categories template
where template.user_id is null
  and template.slug is not null
  and own.user_id is not null
  and own.name = template.name
  and own.slug is null;

-- Re-point references from shared defaults to the same-name account copy.
update expenses expense
set category_id = own.id
from categories template, categories own
where template.user_id is null
  and expense.category_id = template.id
  and own.user_id = expense.user_id
  and own.name = template.name;

update subscriptions subscription
set category_id = own.id
from categories template, categories own
where template.user_id is null
  and subscription.category_id = template.id
  and own.user_id = subscription.user_id
  and own.name = template.name;

update item_category_rules rule
set category_id = own.id
from categories template, categories own
where template.user_id is null
  and rule.category_id = template.id
  and own.user_id = rule.user_id
  and own.name = template.name;

-- Production verification (run after applying this migration):
-- select count(*) from expenses e join categories c on c.id = e.category_id
--   where c.user_id is null; -- expected: 0
-- select count(*) from subscriptions s join categories c on c.id = s.category_id
--   where c.user_id is null; -- expected: 0
-- select count(*) from item_category_rules r join categories c on c.id = r.category_id
--   where c.user_id is null; -- expected: 0
-- select user_id, count(*) from categories
--   where slug = 'uncategorized' and user_id is not null
--   group by user_id having count(*) <> 1; -- expected: no rows
-- with default_count as (
--   select count(*) as value from categories where user_id is null
-- )
-- select u.id, count(c.id) from auth.users u
-- left join categories c on c.user_id = u.id
-- group by u.id having count(c.id) < (select value from default_count);
-- expected: no rows
-- select u.id, d.name from auth.users u
-- cross join categories d
-- left join categories own on own.user_id = u.id and own.name = d.name
-- where d.user_id is null and own.id is null; -- expected: no rows
-- Before/after spot-check: group expenses by e.user_id and c.name; totals and
-- counts must stay unchanged because only category IDs are re-pointed.
