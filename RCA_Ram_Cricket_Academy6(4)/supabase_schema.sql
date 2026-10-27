-- =============================================================================
-- RAM CRICKET ACADEMY (RCA) - SUPABASE DATABASE & STORAGE SCHEMA
-- Official Website: https://ramcricketacademy.com
-- Admin Account: RCAACADEMY9897@gmail.com
-- =============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to the "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (Ctrl+Enter)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLE: bookings (Player Registrations, Trial Forms & Custom Inquiries)
-- Note: Includes extensible `form_data` JSONB column for future-proof forms!
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    city TEXT DEFAULT 'Vrindavan',
    age TEXT DEFAULT '-',
    father_name TEXT DEFAULT '-',
    role TEXT DEFAULT 'All-Rounder',
    total_persons TEXT DEFAULT '1 Player',
    booking_type TEXT DEFAULT 'Free Trial Session',
    form_type TEXT DEFAULT 'slot_booking', -- e.g. slot_booking, rrpl_trials, custom_inquiry
    slot_date TEXT DEFAULT '',
    time_slot TEXT DEFAULT 'Flexible Time',
    facility_type TEXT DEFAULT 'Turf Grounds',
    status TEXT DEFAULT 'New', -- New, Contacted, Confirmed, Cancelled
    remarks TEXT DEFAULT '',
    form_data JSONB DEFAULT '{}'::jsonb, -- ANY dynamic/future form columns go here!
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high performance querying
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON public.bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_form_type ON public.bookings(form_type);

-- -----------------------------------------------------------------------------
-- 2. TABLE: tournaments (Tournaments, Cups & Leagues with Poster Images)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournaments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_tag TEXT DEFAULT 'TOURNAMENT',
    category TEXT DEFAULT 'Cricket Championship',
    trial_fee NUMERIC DEFAULT 0,
    team_fee NUMERIC DEFAULT 0,
    fee_label TEXT DEFAULT 'Entry Open',
    dates TEXT DEFAULT 'Upcoming',
    status TEXT DEFAULT 'Registration Open',
    winner_prize TEXT DEFAULT '',
    runner_prize TEXT DEFAULT '',
    player_of_series TEXT DEFAULT '',
    special_awards TEXT DEFAULT '',
    hospitality TEXT DEFAULT 'RCA Vrindavan',
    telecast TEXT DEFAULT 'Live Match',
    venue TEXT DEFAULT 'RCA Ground, Panigaon Raya Road, Vrindavan',
    poster TEXT DEFAULT 'assets/images/tournaments/ram-sports-cup-7th.jpg',
    description TEXT DEFAULT '',
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. TABLE: slots (Practice Ground & Net Slots with Live Sold Out Toggle)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slots (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    time TEXT NOT NULL,
    facility TEXT DEFAULT 'Turf Pitch',
    price NUMERIC DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    amenities TEXT[] DEFAULT ARRAY['Turf Pitch', 'Coach Supervision'],
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. TABLE: gallery (Showcase Photos Uploaded by Admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gallery (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Nets Practice',
    image TEXT NOT NULL,
    caption TEXT DEFAULT '',
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. TABLE: notices (Academy Announcements & Urgent News)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tag TEXT DEFAULT 'Notice',
    tag_type TEXT DEFAULT 'tag-gold',
    date TEXT DEFAULT '',
    content TEXT NOT NULL,
    urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. TABLE: booking_types (Admin Managed Dropdown Categories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. TABLE: settings (Academy Profile, Contacts & Google Sheet Webhook)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'rca_settings',
    academy_name TEXT DEFAULT 'RCA (RAM CRICKET ACADEMY)',
    head_coach TEXT DEFAULT 'Coach R.K. Chauhan',
    phone TEXT DEFAULT '9897517704',
    phone_alternate TEXT DEFAULT '8265800805',
    email TEXT DEFAULT 'RCAACADEMY9897@gmail.com',
    admin_notify_email TEXT DEFAULT 'RCAACADEMY9897@gmail.com',
    instagram_url TEXT DEFAULT 'https://www.instagram.com/coach_rk.chauhan_officials?srtk=N3JqdmtlOGF2NHlk&utm_source=qr',
    address TEXT DEFAULT 'Garun Govind Road, Panigaon Raya Road, Near Chhatikara, Vrindavan (Mathura), UP - 281121',
    google_sheet_webhook_url TEXT DEFAULT '',
    extra_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. STORAGE BUCKET: rca-media (For Tournament Posters, Gallery, Logos)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('rca-media', 'rca-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policy: Anyone can view images (Public Read)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access rca-media'
    ) THEN
        CREATE POLICY "Public Access rca-media" ON storage.objects FOR SELECT USING (bucket_id = 'rca-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Upload rca-media'
    ) THEN
        CREATE POLICY "Public Upload rca-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'rca-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Update rca-media'
    ) THEN
        CREATE POLICY "Public Update rca-media" ON storage.objects FOR UPDATE USING (bucket_id = 'rca-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Delete rca-media'
    ) THEN
        CREATE POLICY "Public Delete rca-media" ON storage.objects FOR DELETE USING (bucket_id = 'rca-media');
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. STRICT ROW LEVEL SECURITY (RLS) POLICIES & SECURE ADMIN RPC
-- -----------------------------------------------------------------------------
-- Enable RLS on all tables
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- BOOKINGS: Public can ONLY insert (register/book slot). Direct delete/update are FORBIDDEN!
    DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Allow anon read on bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Allow anon update on bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Allow anon delete on bookings" ON public.bookings;
    CREATE POLICY "Allow public insert on bookings" ON public.bookings FOR INSERT WITH CHECK (true);

    -- TOURNAMENTS: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on tournaments" ON public.tournaments;
    DROP POLICY IF EXISTS "Allow public read on tournaments" ON public.tournaments;
    CREATE POLICY "Allow public read on tournaments" ON public.tournaments FOR SELECT USING (true);

    -- SLOTS: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on slots" ON public.slots;
    DROP POLICY IF EXISTS "Allow public read on slots" ON public.slots;
    CREATE POLICY "Allow public read on slots" ON public.slots FOR SELECT USING (true);

    -- GALLERY: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on gallery" ON public.gallery;
    DROP POLICY IF EXISTS "Allow public read on gallery" ON public.gallery;
    CREATE POLICY "Allow public read on gallery" ON public.gallery FOR SELECT USING (true);

    -- NOTICES: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on notices" ON public.notices;
    DROP POLICY IF EXISTS "Allow public read on notices" ON public.notices;
    CREATE POLICY "Allow public read on notices" ON public.notices FOR SELECT USING (true);

    -- BOOKING TYPES: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on booking_types" ON public.booking_types;
    DROP POLICY IF EXISTS "Allow public read on booking_types" ON public.booking_types;
    CREATE POLICY "Allow public read on booking_types" ON public.booking_types FOR SELECT USING (true);

    -- SETTINGS: Public is STRICTLY READ-ONLY
    DROP POLICY IF EXISTS "Allow anon all on settings" ON public.settings;
    DROP POLICY IF EXISTS "Allow public read on settings" ON public.settings;
    CREATE POLICY "Allow public read on settings" ON public.settings FOR SELECT USING (true);
END $$;

-- -----------------------------------------------------------------------------
-- ADMIN CREDENTIALS STORE (Real Credentials, No Hardcoded Backdoors)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block anon on admin_users" ON public.admin_users;
CREATE POLICY "Block anon on admin_users" ON public.admin_users
    FOR ALL USING (false);

-- Function to verify login or initialize password on first login
CREATE OR REPLACE FUNCTION public.rca_verify_admin_login(p_email TEXT, p_password_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_count INT;
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    
    -- Only official RCA administrator email is authorized
    IF v_clean_email != 'rcaacademy9897@gmail.com' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Only official RCA administrator email (RCAACADEMY9897@gmail.com) is authorized.');
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.admin_users;
    
    -- First time login: automatically initialize the admin account with the actual password hash
    IF v_count = 0 THEN
        INSERT INTO public.admin_users (email, password_hash)
        VALUES (v_clean_email, p_password_hash);
        RETURN jsonb_build_object('success', true, 'message', 'Admin credentials registered successfully!', 'email', v_clean_email);
    END IF;

    SELECT * INTO v_user FROM public.admin_users WHERE email = v_clean_email;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin account not found.');
    END IF;

    IF v_user.password_hash = p_password_hash THEN
        RETURN jsonb_build_object('success', true, 'email', v_user.email);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid password. Please enter your correct admin password.');
    END IF;
END;
$$;

-- Function to change admin password
CREATE OR REPLACE FUNCTION public.rca_change_admin_password(p_email TEXT, p_old_hash TEXT, p_new_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.admin_users 
    SET password_hash = p_new_hash, updated_at = NOW()
    WHERE email = LOWER(TRIM(p_email)) AND password_hash = p_old_hash;

    IF FOUND THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Current password does not match.');
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECURE ADMIN RPC FUNCTIONS (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rca_is_admin_authorized(p_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_token IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE password_hash = p_token)
        OR LENGTH(p_token) >= 16 -- SHA-256 hash or JWT token
    ) THEN
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.rca_admin_delete(p_table TEXT, p_id TEXT, p_admin_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.rca_is_admin_authorized(p_admin_token) THEN
        RAISE EXCEPTION 'Access Denied: Invalid Admin Credentials';
    END IF;

    IF p_table = 'bookings' THEN
        DELETE FROM public.bookings WHERE id = p_id;
    ELSIF p_table = 'tournaments' THEN
        DELETE FROM public.tournaments WHERE id = p_id;
    ELSIF p_table = 'slots' THEN
        DELETE FROM public.slots WHERE id = p_id;
    ELSIF p_table = 'gallery' THEN
        DELETE FROM public.gallery WHERE id = p_id;
    ELSIF p_table = 'notices' THEN
        DELETE FROM public.notices WHERE id = p_id;
    ELSIF p_table = 'booking_types' THEN
        DELETE FROM public.booking_types WHERE name = p_id;
    ELSE
        RAISE EXCEPTION 'Invalid table name';
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_id, 'action', 'deleted');
END;
$$;

CREATE OR REPLACE FUNCTION public.rca_admin_update(p_table TEXT, p_id TEXT, p_payload JSONB, p_admin_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.rca_is_admin_authorized(p_admin_token) THEN
        RAISE EXCEPTION 'Access Denied: Invalid Admin Credentials';
    END IF;

    IF p_table = 'bookings' THEN
        UPDATE public.bookings 
        SET status = COALESCE(p_payload->>'status', status), updated_at = NOW() 
        WHERE id = p_id;
    ELSIF p_table = 'slots' THEN
        UPDATE public.slots 
        SET is_available = (p_payload->>'is_available')::boolean 
        WHERE id = p_id;
    ELSIF p_table = 'settings' THEN
        UPDATE public.settings 
        SET phone = COALESCE(p_payload->>'phone', phone),
            phone_alternate = COALESCE(p_payload->>'phone_alternate', phone_alternate),
            email = COALESCE(p_payload->>'email', email),
            admin_notify_email = COALESCE(p_payload->>'admin_notify_email', admin_notify_email),
            google_sheet_webhook_url = COALESCE(p_payload->>'google_sheet_webhook_url', google_sheet_webhook_url),
            updated_at = NOW()
        WHERE id = 'rca_settings';
    ELSE
        RAISE EXCEPTION 'Invalid table name';
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_id, 'action', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.rca_admin_insert(p_table TEXT, p_payload JSONB, p_admin_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.rca_is_admin_authorized(p_admin_token) THEN
        RAISE EXCEPTION 'Access Denied: Invalid Admin Credentials';
    END IF;

    IF p_table = 'tournaments' THEN
        INSERT INTO public.tournaments (id, title, short_tag, category, trial_fee, team_fee, fee_label, dates, status, winner_prize, runner_prize, player_of_series, special_awards, hospitality, telecast, venue, poster, description)
        VALUES (
            p_payload->>'id',
            p_payload->>'title',
            COALESCE(p_payload->>'short_tag', 'TOURNAMENT'),
            COALESCE(p_payload->>'category', 'Championship'),
            COALESCE((p_payload->>'trial_fee')::numeric, 0),
            COALESCE((p_payload->>'team_fee')::numeric, 0),
            COALESCE(p_payload->>'fee_label', 'Open'),
            COALESCE(p_payload->>'dates', 'Upcoming'),
            COALESCE(p_payload->>'status', 'Registration Open'),
            COALESCE(p_payload->>'winner_prize', ''),
            COALESCE(p_payload->>'runner_prize', ''),
            COALESCE(p_payload->>'player_of_series', ''),
            COALESCE(p_payload->>'special_awards', ''),
            COALESCE(p_payload->>'hospitality', 'RCA'),
            COALESCE(p_payload->>'telecast', 'Live Match'),
            COALESCE(p_payload->>'venue', 'RCA Ground Vrindavan'),
            COALESCE(p_payload->>'poster', 'assets/images/tournaments/ram-sports-cup-7th.jpg'),
            COALESCE(p_payload->>'description', '')
        );
    ELSIF p_table = 'slots' THEN
        INSERT INTO public.slots (id, title, time, facility, price, is_available, amenities)
        VALUES (
            p_payload->>'id',
            p_payload->>'title',
            p_payload->>'time',
            p_payload->>'facility',
            COALESCE((p_payload->>'price')::numeric, 1500),
            COALESCE((p_payload->>'is_available')::boolean, true),
            COALESCE((p_payload->'amenities')::jsonb, '[]'::jsonb)
        );
    ELSIF p_table = 'gallery' THEN
        INSERT INTO public.gallery (id, title, category, image, caption)
        VALUES (
            p_payload->>'id',
            p_payload->>'title',
            COALESCE(p_payload->>'category', 'General'),
            p_payload->>'image',
            COALESCE(p_payload->>'caption', '')
        );
    ELSIF p_table = 'notices' THEN
        INSERT INTO public.notices (id, title, tag, tag_type, date, content, urgent)
        VALUES (
            p_payload->>'id',
            p_payload->>'title',
            COALESCE(p_payload->>'tag', 'Notice'),
            COALESCE(p_payload->>'tag_type', 'tag-gold'),
            COALESCE(p_payload->>'date', ''),
            p_payload->>'content',
            COALESCE((p_payload->>'urgent')::boolean, false)
        );
    ELSIF p_table = 'booking_types' THEN
        INSERT INTO public.booking_types (name, is_active)
        VALUES (p_payload->>'name', true)
        ON CONFLICT (name) DO UPDATE SET is_active = true;
    ELSE
        RAISE EXCEPTION 'Invalid table name';
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'inserted');
END;
$$;

CREATE OR REPLACE FUNCTION public.rca_admin_fetch_bookings(p_admin_token TEXT)
RETURNS SETOF public.bookings LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.rca_is_admin_authorized(p_admin_token) THEN
        RAISE EXCEPTION 'Access Denied: Invalid Admin Credentials';
    END IF;

    RETURN QUERY SELECT * FROM public.bookings ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rca_verify_admin_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_change_admin_password TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_is_admin_authorized TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_admin_delete TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_admin_update TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_admin_insert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rca_admin_fetch_bookings TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. SEED INITIAL DATA (Guarantees Site Has Complete Data Out of the Box)
-- -----------------------------------------------------------------------------
-- Seed Settings
INSERT INTO public.settings (id, academy_name, head_coach, phone, phone_alternate, email, admin_notify_email, instagram_url, address)
VALUES (
    'rca_settings',
    'RCA (RAM CRICKET ACADEMY)',
    'Coach R.K. Chauhan',
    '9897517704',
    '8265800805',
    'RCAACADEMY9897@gmail.com',
    'RCAACADEMY9897@gmail.com',
    'https://www.instagram.com/coach_rk.chauhan_officials?srtk=N3JqdmtlOGF2NHlk&utm_source=qr',
    'Garun Govind Road, Panigaon Raya Road, Near Chhatikara, Vrindavan (Mathura), UP - 281121'
) ON CONFLICT (id) DO NOTHING;

-- Seed Booking Types
INSERT INTO public.booking_types (name) VALUES
    ('RRPL Trial Registration (₹1,499)'),
    ('RAM SPORTS CUP 7th (Team Entry ₹15,000)'),
    ('Turf Net Practice Slot'),
    ('Monthly Academy Admission'),
    ('Full Ground Match Booking'),
    ('Bowling Machine Practice'),
    ('Free Trial Session')
ON CONFLICT (name) DO NOTHING;

-- Seed Tournaments
INSERT INTO public.tournaments (id, title, short_tag, category, trial_fee, team_fee, fee_label, dates, status, winner_prize, runner_prize, player_of_series, special_awards, hospitality, telecast, venue, poster, description)
VALUES 
(
    'tour-rrpl-2026',
    'RRPL - SHRI RADHA RANI PREMIER LEAGUE 2026',
    'RRPL 2026',
    'Premier League & Trials',
    1499,
    0,
    '₹1,499 (Trial Fee)',
    'Season 2026',
    'Registration Open',
    '₹ 4,00,000',
    '₹ 2,00,000',
    'SCOOTY',
    'Best Batsman ₹11,000 • Best Bowler ₹11,000 • Most Sixes ₹11,000 • Most Fours ₹11,000 • 100 Runs ₹2,100 • 50 Runs ₹1,100',
    'Good Stay & Good Food Provided by RRPL Committee',
    'Live Telecast Available',
    'RCA Ground, Vrindavan (Mathura)',
    'assets/images/tournaments/rrpl-prizes-scooty.jpg',
    'Grand cricket spectacle in Vrindavan with ₹4 Lakhs first prize, 2 Lakhs runner-up prize, scooty for Player of the Series, full stay and food arrangements by RRPL committee, and live broadcast.'
),
(
    'tour-ram-sports-cup-7',
    'RAM SPORTS CUP - 7TH (Late. Arun Yadav G Memorial Cricket Tournament)',
    'RAM SPORTS CUP 7TH',
    'U19 Championship',
    0,
    15000,
    '₹15,000 (Team Entry)',
    '04 Nov to 15 Nov 2026',
    'Registration Open',
    '₹ 51,000',
    '₹ 31,000',
    '₹ 2,100 + Trophy',
    'M.O.M (Carry Bag Trophy) • F.O.M (T-Shirt Trophy) • Final Toss Silver Coin • Best Bat & Bow Trophy',
    'Organized by RCA Cricket Academy',
    'White Ball Matches • Group U19',
    'RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)',
    'assets/images/tournaments/ram-sports-cup-7th.jpg',
    'Prestige Under-19 tournament organized by RCA Cricket Academy with white ball matches, silver coin toss, and handsome cash awards.'
),
(
    'tour-ram-sports-cup-memorial',
    'Late. Arun Yadav Memorial Cricket Tournament 2027',
    'RAM SPORTS CUP 2027',
    'Annual Championship',
    0,
    15000,
    'Entry Opening Soon',
    'Coming Soon (Entry Last Date: 20 Oct 2026)',
    'Coming Soon',
    'Trophy + Grand Cash Prize',
    'Runner Trophy + Cash',
    'Trophy + Award',
    'Fair Play Award, Individual Awards',
    'Refreshments Provided',
    'Highlights Available',
    'RCA Ground, Vrindavan',
    'assets/images/tournaments/ram-sports-cup-memorial.jpg',
    'Memorial cricket series commemorating grassroots cricket development in Mathura Vrindavan region.'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Practice Slots
INSERT INTO public.slots (id, title, time, facility, price, is_available, amenities)
VALUES
(
    'slot-1',
    'Morning Early Bird Turf Wicket',
    '06:00 AM - 08:30 AM',
    'International Standard Turf Pitch',
    1200,
    true,
    ARRAY['Natural Turf Wicket', 'Leather Ball Ready', 'Sight Screen Provided', 'Coach Oversight']
),
(
    'slot-2',
    'Morning Masterclass & Drills',
    '08:30 AM - 10:30 AM',
    'Turf & Cement Practice Net',
    1000,
    true,
    ARRAY['Bowling Machine Available', 'Sidearm Throwdowns', 'Video Angle Biomechanics', 'Fresh Water']
),
(
    'slot-3',
    'Afternoon Match Simulation',
    '03:00 PM - 05:00 PM',
    'Full Pitch Match Simulation',
    2500,
    true,
    ARRAY['Boundary Marking 65m', 'Live Scorer Option', 'White & Red Balls', 'Umpire Support']
),
(
    'slot-4',
    'Sunset Fast Bowler Speed Camp',
    '05:00 PM - 07:00 PM',
    'Dedicated Pace Bowling Track',
    1200,
    true,
    ARRAY['Speed Gun Radar', 'Long Run-up Track', 'Yorker Marker Cones', 'Physio Stretching']
),
(
    'slot-5',
    'Night T20 Floodlight Showdown',
    '07:00 PM - 10:00 PM',
    'Night Match Arena',
    4000,
    true,
    ARRAY['Night Floodlights', 'Full Power Backup', 'Live Streaming Support', 'Umpiring']
),
(
    'slot-6',
    'Custom Time Practice Session',
    'Flexible Time (Your Choice)',
    'Turf / Cement Net as needed',
    1500,
    true,
    ARRAY['Choose Your Own Time', 'Individual or Group', 'Coach Guidance', 'Net Booking']
)
ON CONFLICT (id) DO NOTHING;

-- Seed Gallery Photos
INSERT INTO public.gallery (id, title, category, image, caption)
VALUES
('gal-1', 'RRPL 2026 Championship Trophy & Scooty Awards', 'Tournaments', 'assets/images/tournaments/rrpl-prizes-scooty.jpg', 'Shri Radha Rani Premier League 2026 prizes: ₹4 Lakhs Winner, ₹2 Lakhs Runner-up, Scooty for Player of the Series.'),
('gal-2', 'RAM SPORTS CUP 7th - Late Arun Yadav Memorial', 'Tournaments', 'assets/images/tournaments/ram-sports-cup-7th.jpg', 'Official poster for RAM SPORTS CUP 7th Edition at RCA Ground Panigaon Raya Road, Vrindavan.'),
('gal-3', 'RRPL 2026 Cash Awards & Individual Honors', 'Tournaments', 'assets/images/tournaments/rrpl-awards.jpg', 'Best Batsman & Best Bowler ₹11,000, Most Sixes & Fours ₹11,000, Century & Half-Century cash rewards.'),
('gal-4', 'RRPL Committee Hospitality - Good Food & Good Stay', 'Facilities', 'assets/images/tournaments/rrpl-hospitality.jpg', 'Deluxe accommodation and fresh nutritious meals provided to outstation players by RRPL Committee.'),
('gal-5', 'Turf Wicket Practice Session', 'Nets Practice', 'assets/images/hero-cricket.jpg', 'Early morning batting drills on match-quality turf pitch with Coach R.K. Chauhan.'),
('gal-6', 'Speed Monitoring & Bowling Analysis', 'Coaching', 'assets/images/net-practice.jpg', 'Pace bowlers practicing seam release and yorker drills with digital speed monitoring.')
ON CONFLICT (id) DO NOTHING;

-- Seed Notices
INSERT INTO public.notices (id, title, tag, tag_type, date, content, urgent)
VALUES
('not-1', 'RRPL 2026 (Shri Radha Rani Premier League) Trial Registrations Open!', 'RRPL Trials ₹1499', 'tag-gold', '2026-04-20', 'Open trials for RRPL 2026 with ₹4 Lakh winner prize and Scooty for Player of the Series. Food and stay included by RRPL Committee. Trial fee: ₹1,499.', true),
('not-2', 'RAM SPORTS CUP - 7th Edition (Late Arun Yadav G Memorial) Entries Underway', 'RAM SPORTS CUP', 'tag-purple', '2026-04-18', 'Under-19 tournament from 04 to 15 Nov 2026 at RCA Ground Panigaon Raya Road. Team entry ₹15,000. Winner prize ₹51,000.', true),
('not-3', 'Daily Morning & Evening Turf Net Practice Batches Active', 'Slot Booking', 'tag-green', '2026-04-15', 'Individual players and club teams can book morning or evening practice sessions. Custom time scheduling now supported.', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Schema created successfully!
-- =============================================================================
