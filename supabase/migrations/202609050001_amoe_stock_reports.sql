create table if not exists public.stock_reports (
  id uuid primary key default gen_random_uuid(),
  report_number text not null unique,
  staff_name text not null,
  branch text not null check (branch in ('Phatthanakarn', 'Sathorn Rama 3', '224 Bar')),
  shift_no smallint not null check (shift_no between 1 and 3),
  report_type text not null check (report_type in ('active', 'inactive')),
  report_date date not null,
  notes text not null default '',
  proof_paths text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_action')),
  source text not null default 'amoe-web-form',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  manager_note text
);

create table if not exists public.stock_report_lines (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  sku text not null default '',
  product_name text not null,
  unit text not null default 'g',
  opening_qty numeric(14,3) not null default 0 check (opening_qty >= 0),
  received_qty numeric(14,3) not null default 0 check (received_qty >= 0),
  transfer_in_qty numeric(14,3) not null default 0 check (transfer_in_qty >= 0),
  transfer_out_qty numeric(14,3) not null default 0 check (transfer_out_qty >= 0),
  pos_sales_qty numeric(14,3) not null default 0 check (pos_sales_qty >= 0),
  waste_qty numeric(14,3) not null default 0 check (waste_qty >= 0),
  expected_closing_qty numeric(14,3) not null,
  actual_closing_qty numeric(14,3) not null check (actual_closing_qty >= 0),
  variance_qty numeric(14,3) not null,
  inactive_reason text not null default '',
  remark text not null default '',
  created_at timestamptz not null default now(),
  unique (report_id, line_no)
);

create table if not exists public.stock_report_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index if not exists stock_reports_submitted_at_idx on public.stock_reports (submitted_at desc);
create index if not exists stock_reports_staff_date_idx on public.stock_reports (staff_name, report_date desc);
create index if not exists stock_report_lines_report_id_idx on public.stock_report_lines (report_id);

alter table public.stock_reports enable row level security;
alter table public.stock_report_lines enable row level security;
alter table public.stock_report_settings enable row level security;

revoke all on public.stock_reports from anon, authenticated;
revoke all on public.stock_report_lines from anon, authenticated;
revoke all on public.stock_report_settings from anon, authenticated;
grant all on public.stock_reports to service_role;
grant all on public.stock_report_lines to service_role;
grant all on public.stock_report_settings to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stock-report-proofs',
  'stock-report-proofs',
  false,
  650000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

