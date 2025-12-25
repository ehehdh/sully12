-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Rooms table
create table if not exists public.rooms (
  id uuid default uuid_generate_v4() primary key,
  topic text not null,
  title text,
  description text,
  stance text not null check (stance in ('agree', 'disagree', 'neutral')),
  stage text not null default 'waiting',
  stage_started_at timestamptz default now(),
  logic_score_pro integer default 0,
  logic_score_con integer default 0,
  settings jsonb default '{"introduction": {"duration": 60, "turns": 1}, "rebuttal": {"duration": 120, "turns": 1}, "cross": {"duration": 180, "turns": 1}, "closing": {"duration": 60, "turns": 1}}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Participants table
create table if not exists public.participants (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  user_name text not null,
  stance text not null check (stance in ('agree', 'disagree', 'neutral', 'observer')),
  is_typing boolean default false,
  logic_score integer default 50,
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Messages table
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  role text not null check (role in ('user', 'opponent', 'moderator', 'system')),
  content text not null,
  message_type text default 'text',
  sender_name text,
  fallacy_detected text,
  fact_check_status text,
  logic_score_change integer default 0,
  created_at timestamptz default now()
);

-- RLS Policies (Open for prototype)
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

create policy "Public rooms are viewable by everyone" on public.rooms for select using (true);
create policy "Anyone can create a room" on public.rooms for insert with check (true);
create policy "Anyone can update a room" on public.rooms for update using (true);

create policy "Public participants are viewable by everyone" on public.participants for select using (true);
create policy "Anyone can join a room" on public.participants for insert with check (true);
create policy "Anyone can update participants" on public.participants for update using (true);

create policy "Public messages are viewable by everyone" on public.messages for select using (true);
create policy "Anyone can send a message" on public.messages for insert with check (true);
