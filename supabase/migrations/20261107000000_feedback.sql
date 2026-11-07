create table feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  message     text not null check (char_length(message) between 1 and 4000),
  app_version text,
  platform    text,
  created_at  timestamptz not null default now()
);

alter table feedback enable row level security;

create policy feedback_insert on feedback
  for insert with check (user_id = auth.uid());
create policy feedback_select on feedback
  for select using (user_id = auth.uid());
