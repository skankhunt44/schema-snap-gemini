CREATE TABLE donors (
  donor_id text PRIMARY KEY,
  donor_name text,
  donor_email text,
  join_date date,
  country text
);

CREATE TABLE donor_touchpoints (
  touchpoint_id text PRIMARY KEY,
  donor_id text,
  channel text,
  touchpoint_date date,
  outcome text
);

CREATE TABLE donations (
  donation_id text PRIMARY KEY,
  donor_id text,
  program_id text,
  amount numeric,
  currency text,
  payment_method text,
  donation_date date
);

CREATE TABLE payments (
  payment_id text PRIMARY KEY,
  donation_id text,
  processor_fee numeric,
  net_amount numeric,
  settlement_date date
);

CREATE TABLE programs (
  program_id text PRIMARY KEY,
  program_name text,
  location text,
  category text,
  start_date date
);

CREATE TABLE allocations (
  allocation_id text PRIMARY KEY,
  program_id text,
  fiscal_year integer,
  allocated_amount numeric
);

CREATE TABLE campaigns (
  campaign_id text PRIMARY KEY,
  campaign_name text,
  goal_amount numeric,
  start_date date,
  end_date date,
  status text
);
