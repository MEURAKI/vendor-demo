-- PROFILES table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  role text not null default 'vendor',  -- 'vendor' | 'admin'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-insert profile on new user
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS + policies
alter table public.profiles enable row level security;

create policy "Read own profile"
on public.profiles for select using (auth.uid() = id);

create policy "Update own profile"
on public.profiles for update using (auth.uid() = id);

-- Admin helper + policies
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create policy "Admins read all"
on public.profiles for select using (public.is_admin());

create policy "Admins update all"
on public.profiles for update using (public.is_admin());
