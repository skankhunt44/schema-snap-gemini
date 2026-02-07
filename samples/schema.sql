CREATE TABLE donors (
  donor_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  join_date DATE
);

CREATE TABLE programs (
  program_id TEXT PRIMARY KEY,
  program_name TEXT,
  location TEXT
);

CREATE TABLE donations (
  donation_id TEXT PRIMARY KEY,
  donor_id TEXT,
  program_id TEXT,
  amount NUMERIC,
  donation_date DATE
);
