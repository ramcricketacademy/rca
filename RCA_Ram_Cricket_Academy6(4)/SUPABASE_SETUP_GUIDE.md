# RCA (RAM CRICKET ACADEMY) - Supabase Cloud Database & Storage Setup Guide
**Official Website:** [https://ramcricketacademy.com](https://ramcricketacademy.com)  
**Registered Email:** `RCAACADEMY9897@gmail.com`  
**Head Coach:** Coach R.K. Chauhan (+91 9897517704)

---

## 📌 Overview
This website comes equipped with a hybrid architecture:
1. **Supabase Cloud Database & Storage (Recommended)**: Permanent PostgreSQL database, real-time sync across all devices, and high-speed cloud image hosting for tournament posters and gallery photos.
2. **Offline LocalStorage Fallback**: The website and admin panel run smoothly even if Supabase is unconfigured or temporarily offline.
3. **Google Sheets Auto-Backup**: Keeps a secondary live safety sheet of every booking.
4. **Direct Admin Email Alert**: Every slot booking and trial registration triggers an automatic email alert to `RCAACADEMY9897@gmail.com`.
5. **Extensible Dynamic Form Architecture**: You can add/delete fields in forms or add new forms in the future without breaking any database schemas!

---

## 🚀 Step 1: Create Free Supabase Account
1. Open [https://supabase.com](https://supabase.com) in your browser.
2. Click **Start your project** (or **Sign In**).
3. Sign in or register using your academy email: `RCAACADEMY9897@gmail.com`.
4. Click **New Project**:
   - **Name**: `ram-cricket-academy`
   - **Database Password**: Set a strong password (e.g. `RcaVrindavan@2026!#`) and save it safely.
   - **Region**: Choose `Mumbai (ap-south-1)` or `Singapore` (fastest for India).
   - **Pricing Plan**: **Free Tier** ($0/month - forever free).
5. Click **Create new project** and wait ~1 minute for Supabase to provision your database.

---

## 🗄️ Step 2: Run the SQL Schema (1-Click Database Creation)
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar (icon with `>_`).
2. Click **New query** (or the `+` button).
3. Open the file `supabase_schema.sql` located inside this project folder:
   - Copy all contents of `supabase_schema.sql`.
4. Paste it into the Supabase SQL Editor.
5. Click the green **Run** button (or press `Ctrl + Enter`).
6. You will see **"Success. No rows returned"**.  
   *What this just created automatically:*
   - `bookings` table (with dynamic JSONB `form_data` for all future form fields)
   - `tournaments` table (RRPL 2026, RAM SPORTS CUP 7th & Memorial pre-seeded)
   - `slots` table (all daily practice slots with sold-out toggles pre-seeded)
   - `gallery` table (championship trophies, awards, practice action pre-seeded)
   - `notices` table (RRPL trial announcement, tournament entries pre-seeded)
   - `booking_types` table (dynamic categories for form dropdowns)
   - `settings` table (academy contacts and phone numbers)
   - `rca-media` public storage bucket for images and posters
   - Full Row Level Security (RLS) policies allowing public registration and safe admin management.

---

## 🔑 Step 3: Connect Supabase to RCA Admin Panel
1. In your Supabase Dashboard, click on **Project Settings** (gear icon at bottom left) → **API**.
2. Find the two values under **Project API Keys & URLs**:
   - **Project URL**: e.g., `https://xyzabcdefghijklmno.supabase.co`
   - **Project API Keys (anon public)**: e.g., `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
3. Open your RCA Admin Panel:
   - Visit `admin.html` in your browser.
   - Login with official email (`RCAACADEMY9897@gmail.com`) and your administrator password.
   - Click **Academy Settings** in the left sidebar menu.
4. Locate the green **Supabase Cloud Integration** card at the top:
   - Paste your **Supabase Project URL** into the Project URL field.
   - Paste your **Supabase Anon Public API Key** into the Anon Key field.
   - Click **Save Supabase Cloud Settings**.
5. Click **Test Connection & Sync**:
   - The status badge will change to **"Supabase Cloud Active & Connected"** with a green cloud icon!
   - All live data from Supabase will automatically sync into your dashboard.

---

## 📸 Step 4: Uploading Tournament Posters & Gallery Images
- Once Supabase is connected, any poster or photo you upload in the admin dashboard (**Tournaments & Leagues** or **Photo Showcase**):
  1. Uploads directly to your Supabase `rca-media` Storage Bucket.
  2. Generates a lightning-fast, permanent public CDN link.
  3. Displays instantly on the website across all desktop and mobile devices.

---

## 📝 Step 5: How Future Form Extensibility Works (Add/Delete Fields)
Client requirement: *"may be in future we have need to delete or add column in form or may be need to add 1 more type of form . pls do accordingly"*

### Why this is already 100% future-proof:
1. **Dynamic JSONB Column (`form_data`)**:
   - The Supabase `bookings` table has a PostgreSQL `JSONB` column named `form_data`.
   - Whatever fields you add to any form (`tshirtSize`, `bowlingSpeed`, `aadharNumber`, `battingStyle`, etc.) are automatically captured as key-value pairs without needing to alter database columns!
2. **Automatic Admin Registration Dossier**:
   - When the admin clicks **View Pass** (eye icon) on any registration in `admin.html`, the system automatically scans for any custom or new fields and displays them neatly formatted in the Player Registration Dossier!
3. **Automatic Admin Email Dispatch**:
   - Any extra fields added to any form are dynamically bundled into the email notification dispatched to `RCAACADEMY9897@gmail.com`.
4. **Google Sheets Extensibility**:
   - Extra fields are also flattened into the Google Sheets payload as `custom_{fieldName}`.
5. **How to add a new field to a form in HTML**:
   Simply add an `<input>`, `<select>`, or `<textarea>` with any `id` or `name` inside any form in `index.html` or any future form:
   ```html
   <div class="form-group">
       <label>T-Shirt Size</label>
       <select id="tshirtSize" class="input-field">
           <option value="M">M (Medium)</option>
           <option value="L">L (Large)</option>
           <option value="XL">XL (Extra Large)</option>
       </select>
   </div>
   ```
   **That's it!** You do NOT need to write any new JavaScript or change the database. The system automatically reads `tshirtSize`, stores it into Supabase `form_data`, sends it in the admin email alert, and shows it on the admin dossier!

---

## 🏆 Step 6: SEO #1 Ranking & AI Engine Integration Checklist
**Domain:** `ramcricketacademy.com`

### What is already built-in:
1. **40+ High-Intent Keywords**:
   - `Best Cricket Academy in Vrindavan`, `Ram Cricket Academy`, `RCA Vrindavan`, `Coach RK Chauhan`, `RRPL 2026 Trials`, `RAM SPORTS CUP 7th Edition`, `Garun Govind Road Cricket`, `Panigaon Raya Road Cricket Ground`, `Turf Pitch Booking Vrindavan`, `Under-19 Cricket Tournament Vrindavan Mathura`.
2. **Full Schema.org JSON-LD Structured Data**:
   - `SportsActivityLocation` with geo-coordinates `(27.5833, 77.6750)`.
   - `SportsEvent` for **RRPL 2026** and **RAM SPORTS CUP (7th Edition)** for Google Events Carousel.
   - `FAQPage` rich snippet to claim Google's "People Also Ask" questions.
3. **Robots.txt & Sitemap.xml**:
   - `robots.txt`: Allows Googlebot, Bingbot, ChatGPT, Perplexity, and Claude to index the site.
   - `sitemap.xml`: Formatted according to sitemaps.org standards targeting `https://ramcricketacademy.com/`.

### Deployment Checklist for Domain `ramcricketacademy.com`:
1. **DNS Setup**:
   - Point your domain's `A` records to your web host (e.g., Hostinger, GoDaddy, Vercel, Netlify, or GitHub Pages).
   - Enable SSL certificate (HTTPS) — free on Cloudflare/Let's Encrypt.
2. **Google Search Console**:
   - Go to [https://search.google.com/search-console](https://search.google.com/search-console).
   - Add property `https://ramcricketacademy.com`.
   - Submit sitemap: `https://ramcricketacademy.com/sitemap.xml`.
3. **Google Business Profile (Essential for #1 Local Map Pack Ranking)**:
   - Create/Claim **Ram Cricket Academy (RCA)** on Google Maps at *Panigaon Raya Road / Garun Govind Road, Vrindavan*.
   - Add Phone: `+91 9897517704`.
   - Add Website link: `https://ramcricketacademy.com`.
   - Add Category: *Cricket Academy* / *Sports Club*.

---
*Maintained by Ram Cricket Academy Technical Team. For support, contact Coach R.K. Chauhan at +91 9897517704.*
