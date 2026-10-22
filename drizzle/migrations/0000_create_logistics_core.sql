-- ENUMS
create type public.app_role as enum ('admin','staff','user');
create type public.shipment_status as enum ('booked','picked_up','in_transit','customs','out_for_delivery','delivered','exception');
create type public.service_kind as enum ('courier','luggage','freight');
create type public.service_level as enum ('express','standard','economy');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- SHIPMENTS
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  kind public.service_kind not null default 'courier',
  level public.service_level not null default 'express',
  status public.shipment_status not null default 'booked',
  origin_city text not null,
  origin_country text not null,
  origin_code text,
  dest_city text not null,
  dest_country text not null,
  dest_code text,
  sender_name text not null,
  sender_phone text,
  recipient_name text not null,
  recipient_phone text,
  recipient_address text not null,
  weight_kg numeric(10,2) not null default 1,
  length_cm numeric(10,1),
  width_cm numeric(10,1),
  height_cm numeric(10,1),
  pieces int not null default 1,
  declared_value numeric(12,2),
  contents text,
  price_cents int not null default 0,
  currency text not null default 'EUR',
  pickup_at timestamptz,
  eta timestamptz,
  progress int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shipments to authenticated;
grant all on public.shipments to service_role;
alter table public.shipments enable row level security;
create policy "own shipments select" on public.shipments for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "own shipments insert" on public.shipments for insert to authenticated with check (auth.uid() = user_id);
create policy "own shipments update" on public.shipments for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "own shipments delete" on public.shipments for delete to authenticated using (auth.uid() = user_id);

-- EVENTS
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.shipment_status not null,
  location text,
  note text,
  occurred_at timestamptz not null default now()
);
grant select, insert on public.shipment_events to authenticated;
grant all on public.shipment_events to service_role;
alter table public.shipment_events enable row level security;
create policy "events of own shipments" on public.shipment_events for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id and (s.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "insert events for own shipments" on public.shipment_events for insert to authenticated
  with check (exists (select 1 from public.shipments s where s.id = shipment_id and (s.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create index on public.shipment_events (shipment_id, occurred_at desc);
create index on public.shipments (user_id, created_at desc);

-- TRACKING NUMBER GENERATION
create or replace function public.gen_tracking_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tracking_number is null or new.tracking_number = '' then
    new.tracking_number := 'MRD-' || to_char(now(),'YY') || '-' ||
      lpad((floor(random()*10000))::int::text, 4, '0') || '-' ||
      lpad((floor(random()*10000))::int::text, 4, '0');
  end if;
  return new;
end $$;
create trigger shipments_tracking_number before insert on public.shipments
for each row execute function public.gen_tracking_number();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger shipments_touch before update on public.shipments
for each row execute function public.touch_updated_at();

-- PUBLIC TRACKING (safe columns only, no PII)
create or replace function public.track_shipment(_tracking text)
returns table (
  tracking_number text,
  status public.shipment_status,
  kind public.service_kind,
  level public.service_level,
  origin_city text, origin_country text, origin_code text,
  dest_city text, dest_country text, dest_code text,
  weight_kg numeric, pieces int, progress int,
  eta timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.tracking_number, s.status, s.kind, s.level,
         s.origin_city, s.origin_country, s.origin_code,
         s.dest_city, s.dest_country, s.dest_code,
         s.weight_kg, s.pieces, s.progress, s.eta, s.created_at
  from public.shipments s
  where upper(s.tracking_number) = upper(trim(_tracking))
  limit 1
$$;
grant execute on function public.track_shipment(text) to anon, authenticated;

create or replace function public.track_shipment_events(_tracking text)
returns table (status public.shipment_status, location text, note text, occurred_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.status, e.location, e.note, e.occurred_at
  from public.shipment_events e
  join public.shipments s on s.id = e.shipment_id
  where upper(s.tracking_number) = upper(trim(_tracking))
  order by e.occurred_at asc
$$;
grant execute on function public.track_shipment_events(text) to anon, authenticated;

-- PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- DEMO SHIPMENT (public tracking demo, no owner)
insert into public.shipments
  (tracking_number, user_id, kind, level, status, origin_city, origin_country, origin_code,
   dest_city, dest_country, dest_code, sender_name, recipient_name, recipient_address,
   weight_kg, pieces, price_cents, currency, progress, pickup_at, eta, contents)
values
  ('MRD-26-4471-9920', null, 'courier', 'express', 'in_transit', 'Frankfurt', 'DE', 'FRA',
   'Tokyo', 'JP', 'HND', 'Meridian Demo', 'K. Tanaka', '2-7-1 Marunouchi, Chiyoda, Tokyo',
   24, 2, 18940, 'EUR', 72, now() - interval '9 hours', now() + interval '20 hours', 'Machine parts'),
  ('MRD-26-5521-7743', null, 'luggage', 'standard', 'customs', 'London', 'GB', 'LHR',
   'Dubai', 'AE', 'DXB', 'Meridian Demo', 'A. Haddad', 'Marina Gate 1, Dubai Marina',
   31.5, 3, 12400, 'EUR', 41, now() - interval '2 days', now() + interval '10 hours', 'Personal luggage');

insert into public.shipment_events (shipment_id, status, location, note, occurred_at)
select s.id, v.status::public.shipment_status, v.loc, v.note, now() - (v.hrs || ' hours')::interval
from public.shipments s
join (values
  ('MRD-26-4471-9920','booked','Frankfurt, DE','Booking confirmed · label issued', 30),
  ('MRD-26-4471-9920','picked_up','Frankfurt, DE','Collected from sender', 26),
  ('MRD-26-4471-9920','in_transit','FRA sorting centre','Departed sorting · belt 07A', 22),
  ('MRD-26-4471-9920','in_transit','FRA airside','Boarded flight MX-204', 9),
  ('MRD-26-5521-7743','booked','London, GB','Booking confirmed · label issued', 54),
  ('MRD-26-5521-7743','picked_up','London, GB','Bags collected', 50),
  ('MRD-26-5521-7743','in_transit','LHR cargo','Departed London Heathrow', 44),
  ('MRD-26-5521-7743','customs','Dubai, AE','Held for customs inspection', 6)
) as v(tn, status, loc, note, hrs) on v.tn = s.tracking_number;