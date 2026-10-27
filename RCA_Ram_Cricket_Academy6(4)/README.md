# RCA (RAM CRICKET ACADEMY) - Official Website & Admin System

A modern, high-performance web platform and admin management portal for **RAM CRICKET ACADEMY (RCA)** located in **Vrindavan, Uttar Pradesh**, established in 2018 under **Head Coach R.K. Chauhan**.

- **Official Domain**: `ramcricketacademy.com`
- **Head Coach**: Coach R.K. Chauhan
- **Phones**: +91 9897517704, 8265800805
- **Official Email**: `RCAACADEMY9897@gmail.com`
- **Official Instagram**: [@coach_rk.chauhan_officials](https://www.instagram.com/coach_rk.chauhan_officials?srtk=N3JqdmtlOGF2NHlk&utm_source=qr)
- **Academy Grounds**: Panigaon Raya Road & Garun Govind Road, Near Chhatikara, Vrindavan (Mathura) - 281121
- **Design Theme**: Royal Deep Purple (`#24083c`, `#37105a`) & Metallic Gold (`#d4af37`, `#f5d85d`) matching the official 3D RCA crest.

---

## 🌟 Key Features

### 1. Public Academy Portal (`index.html`)
- **SEO #1 & AI Chatbot Optimized**: Rich Schema.org JSON-LD metadata for `SportsActivityLocation`, `CricketAcademy`, and `FAQPage` to maximize rankings on Google Search and AI engines (ChatGPT, Perplexity, Gemini).
- **Tournaments & Championships**:
  - **RAM SPORTS CUP (7th Edition)**: Late Arun Yadav G Memorial Cricket Tournament (U19, Team Entry ₹15,000, 04–15 Nov 2026, Winner ₹51,000, Runner ₹31,000, Silver Coin Toss, M.O.M & F.O.M awards).
  - **RRPL 2026 (Shri Radha Rani Premier League)**: Dedicated trial registration section with **₹1,499 Trial Fee** (Winner ₹4,00,000, Runner ₹2,00,000, Scooty for Player of the Series, full Good Food & Good Stay provided by RRPL Committee, Live Telecast, ₹11,000 individual awards).
  - High-resolution tournament posters embedded with lightbox zoom.
- **Flexible Practice Slot Booking**:
  - **Custom Time Selection**: Users can choose any custom time window (e.g. `06:30 AM - 08:30 AM`) rather than rigid fixed slots.
  - **Total Persons / Players Selector**: 1 Player (Individual), 2 Players, 3–5 Net Group, Full Team (11–15 Players), or Match Hire (22+ Players).
  - **Live Slot Availability**: Real-time display showing **AVAILABLE** (green) or **SOLD OUT** (red badge, booking button disabled).
  - **Instant Registration Pass Generation**: Generates pass with Ref ID (`RCA-2026-XXXX`).
  - **1-Click WhatsApp Trigger**: Automatically opens WhatsApp with Coach R.K. Chauhan (+91 9897517704) with pre-filled details.
  - **Instant Email Trigger**: Prepares email to `RCAACADEMY9897@gmail.com`.
  - All wording strictly conforms to **"Confirm Booking"** / **"Confirm Registration"** (all "Pay & Confirm" removed).
- **Dynamic Photo Showcase**: Filterable gallery (Nets Practice, Tournaments, Coaching, Facilities) with lightbox viewer.
- **Announcements & Notice Board**: Real-time alerts regarding trials, camps, and schedules.
- **100% Fully Responsive**: Pixel-perfect layout across Mobile, Tablet, and Desktop/Laptop screens.

---

### 2. Admin Management Portal (`admin.html`)
- **Secure Authentication**: Protected dashboard with login screen.
  - **Official Admin Email**: `RCAACADEMY9897@gmail.com`
  - **Password**: Secure management password (stored as cryptographic SHA-256 hash).
- **Slot Bookings & Registrations Manager**:
  - Displays Player Name, Age, **Total Persons**, Phone, Program Type, Slot Date & Time, and Status.
  - Status management (`New`, `Contacted`, `Confirmed`, `Cancelled`).
  - **1-Click Direct WhatsApp Button**: Connect directly with player on WhatsApp with a prefilled message.
  - **1-Click Call & Email Buttons**.
  - **Search & Filter**: Find bookings instantly by name, phone, city, or ID.
  - **Export to CSV / Excel**: Download complete spreadsheet with 1 click.
- **Tournaments & Cups Manager**:
  - Add new tournaments with poster image (local file upload or URL), dates, entry/trial fee, cash prizes, and description.
  - Delete any tournament with immediate live site reflection.
- **Slot Availability Manager (Sold Out / Available)**:
  - Table of all daily slots with 1-click toggle buttons: **"Mark Sold Out"** ↔ **"Mark Available"**.
  - Add custom slots (time window, facility, fee, amenities) or delete slots.
- **Google Sheets Data Integration (Auto-Backup & Sync)**:
  - Input field for **Google Apps Script Webhook URL**.
  - **1-Click "Sync All Data to Google Sheet"** button.
  - Includes ready-to-copy Google Apps Script code for 2-minute setup!
- **Photo Gallery & Notice Board Manager**:
  - Upload photos (auto Base64 converted) or enter URLs.
  - Post urgent or standard announcements.
- **Academy Settings & Security**:
  - Update contact numbers (+91 9897517704, 8265800805), coach name, admin notification email, Instagram URL, and ground addresses.
  - Change Admin Password.
  - Download JSON database backup or reset to demo defaults.

---

## 🚀 How to Run the Demo for Clients

### Option 1: Direct Double-Click (Zero Install)
- Double-click **`start_demo.bat`** (or open **`index.html`** in any web browser: Chrome, Edge, Safari, Firefox).
- The website and admin panel work immediately!

### Option 2: Local Web Server (Recommended for Client Presentation)
- Double-click **`start_server.bat`**.
- It starts a fast, lightweight native web server at `http://localhost:8080/` and automatically opens your browser.

---

## 📋 Google Sheets Integration Setup (2 Minutes)

1. Open [Google Sheets](https://sheets.google.com) and create a new blank sheet.
2. Go to **Extensions → Apps Script**.
3. Replace any code with this snippet:
   ```javascript
   function doPost(e) {
     try {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
       var data = JSON.parse(e.postData.contents);
       if (sheet.getLastRow() === 0) {
         sheet.appendRow(["Booking ID", "Player Name", "Total Persons", "Phone", "Booking Type", "Date", "Time", "City", "Role", "Created At"]);
       }
       sheet.appendRow([data.id, data.name, data.totalPersons || "1", data.phone, data.bookingType, data.slotDate, data.timeSlot, data.city, data.role, data.createdAt]);
       return ContentService.createTextOutput(JSON.stringify({result: "success"})).setMimeType(ContentService.MimeType.JSON);
     } catch(err) {
       return ContentService.createTextOutput(JSON.stringify({result: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
4. Click **Deploy → New deployment**.
5. Select type **Web app**, set *Execute as* to **Me**, and set *Who has access* to **Anyone**.
6. Copy the generated Web App URL, paste it into the **Admin Portal → Settings → Google Sheets Webhook URL** field, and click **Save Webhook**!

---

## ⚡ Supabase Cloud Database & Storage Setup
1. Create a free account at [supabase.com](https://supabase.com) using `RCAACADEMY9897@gmail.com`.
2. Create project `ram-cricket-academy`.
3. Open **SQL Editor** in Supabase and run `supabase_schema.sql` (included in project).
4. Copy **Project URL** and **Anon Public Key** from Supabase Settings → API.
5. Open `admin.html` → **Settings** → Paste credentials and click **Save Supabase Cloud Settings**.
6. Full step-by-step documentation with screenshots is available in **`SUPABASE_SETUP_GUIDE.md`**!

---

## 🔑 Admin Credentials
- **Dashboard URL**: `admin.html` (or click "Admin Portal" in website footer)
- **Official Admin Email**: `RCAACADEMY9897@gmail.com`
- **Password**: Your private administrator password

---

## 📁 Directory Structure
```
RCA Academy/
├── index.html              # Main public landing page (SEO & Schema.org optimized)
├── admin.html              # Admin management dashboard (Tournaments, Slots, Sheets, Supabase, CRM)
├── contact-us.html         # Standalone contact & inquiry page
├── robots.txt              # Search engine & AI crawler instructions
├── sitemap.xml             # Standard XML Sitemap for https://ramcricketacademy.com
├── supabase_schema.sql     # PostgreSQL database schema & storage bucket for Supabase
├── SUPABASE_SETUP_GUIDE.md # 5-step visual setup guide for RCAACADEMY9897@gmail.com
├── css/
│   ├── style.css           # Public website design & animations (Royal Purple & Metallic Gold)
│   └── admin.css           # Admin dashboard UI & tables
├── js/
│   ├── supabase-config.js  # Supabase Cloud Database & Storage client
│   ├── data.js             # Central data management layer (Supabase sync, LocalStorage, Sheets, Alerts)
│   ├── main.js             # Public site logic (dynamic tournaments, slots, RRPL form, modals)
│   └── admin.js            # Admin portal CRUD & toggle controller
├── assets/
│   └── images/
│       ├── logo.png        # Official 3D RCA gold & purple crest
│       ├── logo.jpg        # High-res crest
│       ├── hero-cricket.jpg# Stadium action
│       ├── turf-ground.jpg # Pitch & outfield
│       ├── net-practice.jpg# Bowling session
│       ├── trophy.jpg      # Championship celebration
│       └── tournaments/    # High-resolution tournament posters
│           ├── ram-sports-cup-7th.jpg
│           ├── ram-sports-cup-memorial.jpg
│           ├── rrpl-prizes-scooty.jpg
│           ├── rrpl-awards.jpg
│           └── rrpl-hospitality.jpg
├── server.ps1              # Native PowerShell HTTP server (zero dependencies)
├── start_server.bat        # 1-Click web server launcher
├── start_demo.bat          # 1-Click browser launcher
└── README.md               # Complete documentation
```
