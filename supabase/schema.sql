-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- before hitting /seed. Creates all tables plus the RPC functions used by
-- aggregation queries (cards, filtered invoices/customers).

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid default uuid_generate_v4() primary key,
  name varchar(255) not null,
  email text not null unique,
  password text not null
);

create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  name varchar(255) not null,
  email varchar(255) not null,
  image_url varchar(255) not null,
  user_id uuid references users(id) on delete cascade
);

create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid not null references customers(id),
  amount int not null,
  status varchar(255) not null,
  date date not null,
  user_id uuid references users(id) on delete cascade
);

create table if not exists revenue (
  month varchar(4) not null unique,
  revenue int not null
);

-- Card data: counts + paid/pending sums, in one round trip.
create or replace function get_card_data(_user_id uuid)
returns table (
  number_of_invoices bigint,
  number_of_customers bigint,
  total_paid bigint,
  total_pending bigint
)
language sql
stable
as $$
  select
    (select count(*) from invoices where user_id = _user_id)::bigint,
    (select count(*) from customers where user_id = _user_id)::bigint,
    coalesce(sum(case when status = 'paid' then amount else 0 end), 0)::bigint,
    coalesce(sum(case when status = 'pending' then amount else 0 end), 0)::bigint
  from invoices
  where user_id = _user_id;
$$;

-- Filtered invoices for the table view (search across joined columns).
create or replace function get_filtered_invoices(
  _user_id uuid,
  q text,
  page_offset int,
  page_limit int
)
returns table (
  id uuid,
  amount int,
  date date,
  status varchar,
  name varchar,
  email varchar,
  image_url varchar,
  customer_id uuid
)
language sql
stable
as $$
  select
    i.id, i.amount, i.date, i.status,
    c.name, c.email, c.image_url, i.customer_id
  from invoices i
  join customers c on i.customer_id = c.id
  where i.user_id = _user_id and (
    c.name ilike '%' || q || '%' or
    c.email ilike '%' || q || '%' or
    i.amount::text ilike '%' || q || '%' or
    i.date::text ilike '%' || q || '%' or
    i.status ilike '%' || q || '%'
  )
  order by i.date desc
  limit page_limit offset page_offset;
$$;

-- Page count for filtered invoices.
create or replace function get_invoices_count(_user_id uuid, q text)
returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from invoices i
  join customers c on i.customer_id = c.id
  where i.user_id = _user_id and (
    c.name ilike '%' || q || '%' or
    c.email ilike '%' || q || '%' or
    i.amount::text ilike '%' || q || '%' or
    i.date::text ilike '%' || q || '%' or
    i.status ilike '%' || q || '%'
  );
$$;

-- Customers table with per-customer aggregates.
create or replace function get_filtered_customers(_user_id uuid, q text)
returns table (
  id uuid,
  name varchar,
  email varchar,
  image_url varchar,
  total_invoices bigint,
  total_pending bigint,
  total_paid bigint
)
language sql
stable
as $$
  select
    c.id, c.name, c.email, c.image_url,
    count(i.id)::bigint as total_invoices,
    coalesce(sum(case when i.status = 'pending' then i.amount else 0 end), 0)::bigint as total_pending,
    coalesce(sum(case when i.status = 'paid' then i.amount else 0 end), 0)::bigint as total_paid
  from customers c
  left join invoices i on c.id = i.customer_id and i.user_id = _user_id
  where c.user_id = _user_id
    and (c.name ilike '%' || q || '%' or c.email ilike '%' || q || '%')
  group by c.id, c.name, c.email, c.image_url
  order by c.name asc;
$$;
