/**
 * RCA (RAM CRICKET ACADEMY) - Central Data Management Layer
 * Handles LocalStorage persistence, Tournaments, Slots with Sold Out toggles,
 * Google Sheets sync, Email alerts, and WhatsApp message generation.
 */

const RCA_STORAGE_KEY = 'RCA_ACADEMY_DATABASE_V2';

const DEFAULT_SETTINGS = {
    academyName: "RCA (RAM CRICKET ACADEMY)",
    shortName: "RCA",
    established: "2018",
    tagline: "Shaping Champions from Grassroots to Glory Since 2018",
    domain: "ramcricketacademy.com",
    phone: "9897517704",
    phoneAlternate: "8265800805",
    phoneFormatted: "+91 9897517704",
    email: "RCAACADEMY9897@gmail.com",
    adminNotifyEmail: "RCAACADEMY9897@gmail.com",
    headCoach: "Coach R.K. Chauhan",
    instagramUrl: "https://www.instagram.com/coach_rk.chauhan_officials?srtk=N3JqdmtlOGF2NHlk&utm_source=qr",
    instagramHandle: "@coach_rk.chauhan_officials",
    address: "Garun Govind Road, Panigaon Raya Road, Near Chhatikara, Vrindavan (Mathura), UP - 281121",
    grounds: [
        "RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)",
        "Hazarimal Somani Cricket Ground, Vrindavan",
        "Garun Govind Road Ground, Near Chhatikara, Vrindavan"
    ],
    city: "Vrindavan",
    timings: "Morning: 6:00 AM - 10:00 AM | Evening: 4:00 PM - 8:00 PM",
    googleSheetWebhookUrl: "" // Google Apps Script Webhook URL for auto-saving bookings
};

// Default Booking / Inquiry Categories (Admin can add/delete from admin panel)
const DEFAULT_BOOKING_TYPES = [
    "RRPL Trial Registration (₹1,499)",
    "RAM SPORTS CUP 7th (Team Entry ₹15,000)",
    "Turf Net Practice Slot",
    "Monthly Academy Admission",
    "Full Ground Match Booking",
    "Bowling Machine Practice",
    "Free Trial Session"
];

// Default Tournaments / Leagues with User Uploaded Posters
const DEFAULT_TOURNAMENTS = [
    {
        id: "tour-rrpl-2026",
        title: "RRPL - SHRI RADHA RANI PREMIER LEAGUE 2026",
        shortTag: "RRPL 2026",
        category: "Premier League & Trials",
        trialFee: 1499,
        teamFee: 0,
        feeLabel: "₹1,499 (Trial Fee)",
        dates: "Season 2026",
        status: "Registration Open",
        winnerPrize: "₹ 4,00,000",
        runnerPrize: "₹ 2,00,000",
        playerOfSeries: "SCOOTY",
        specialAwards: "Best Batsman ₹11,000 • Best Bowler ₹11,000 • Most Sixes ₹11,000 • Most Fours ₹11,000 • 100 Runs ₹2,100 • 50 Runs ₹1,100",
        hospitality: "Good Stay & Good Food Provided by RRPL Committee",
        telecast: "Live Telecast Available",
        venue: "RCA Ground, Vrindavan (Mathura)",
        poster: "assets/images/tournaments/rrpl-prizes-scooty.jpg",
        description: "Grand cricket spectacle in Vrindavan with ₹4 Lakhs first prize, 2 Lakhs runner-up prize, scooty for Player of the Series, full stay and food arrangements by RRPL committee, and live broadcast."
    },
    {
        id: "tour-ram-sports-cup-7",
        title: "RAM SPORTS CUP - 7TH (Late. Arun Yadav G Memorial Cricket Tournament)",
        shortTag: "RAM SPORTS CUP 7TH",
        category: "U19 Championship",
        trialFee: 0,
        teamFee: 15000,
        feeLabel: "₹15,000 (Team Entry)",
        dates: "04 Nov to 15 Nov 2026",
        status: "Registration Open",
        winnerPrize: "₹ 51,000",
        runnerPrize: "₹ 31,000",
        playerOfSeries: "₹ 2,100 + Trophy",
        specialAwards: "M.O.M (Carry Bag Trophy) • F.O.M (T-Shirt Trophy) • Final Toss Silver Coin • Best Bat & Bow Trophy",
        hospitality: "Organized by RCA Cricket Academy",
        telecast: "White Ball Matches • Group U19",
        venue: "RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)",
        poster: "assets/images/tournaments/ram-sports-cup-7th.jpg",
        description: "Prestige Under-19 tournament organized by RCA Cricket Academy with white ball matches, silver coin toss, and handsome cash awards."
    },
    {
        id: "tour-ram-sports-cup-memorial",
        title: "Late. Arun Yadav Memorial Cricket Tournament 2027",
        shortTag: "RAM SPORTS CUP 2027",
        category: "Annual Championship",
        trialFee: 0,
        teamFee: 15000,
        feeLabel: "Entry Opening Soon",
        dates: "Coming Soon (Entry Last Date: 20 Oct 2026)",
        status: "Coming Soon",
        winnerPrize: "Trophy + Grand Cash Prize",
        runnerPrize: "Runner Trophy + Cash",
        playerOfSeries: "Special Honors",
        specialAwards: "Play Cricket Live Passion",
        hospitality: "Ram Sports & RCA",
        telecast: "Live Match Updates",
        venue: "Hazarimal Somani Cricket Ground, Vrindavan",
        poster: "assets/images/tournaments/ram-sports-cup-memorial.jpg",
        description: "Annual memorial cricket tournament at the scenic Hazarimal Somani Cricket Ground in Vrindavan."
    }
];

// Ground & Net Practice Slots with Sold Out / Availability status
const DEFAULT_SLOTS = [
    {
        id: "slot-1",
        title: "Morning Turf Match Slot (Early)",
        time: "06:00 AM - 09:00 AM",
        facility: "Turf Wicket & Ground",
        price: 2500,
        isAvailable: true,
        amenities: ["Match Turf Pitch", "Certified Umpire", "Ball Box", "Pavilion Access"]
    },
    {
        id: "slot-2",
        title: "Morning Turf Practice Slot (Mid)",
        time: "09:00 AM - 12:00 PM",
        facility: "Turf Wicket & Digital Scoreboard",
        price: 2500,
        isAvailable: true,
        amenities: ["Match Pitch", "Digital Scoring", "Sightscreens", "Drinking Water"]
    },
    {
        id: "slot-3",
        title: "Afternoon Net Practice & Bowling Machine",
        time: "12:00 PM - 03:00 PM",
        facility: "Turf & Cement Nets",
        price: 2000,
        isAvailable: true,
        amenities: ["Turf Nets", "Bowling Machine", "Net Bowlers", "Coach Assessment"]
    },
    {
        id: "slot-4",
        title: "Evening Floodlight Match Slot",
        time: "04:00 PM - 07:00 PM",
        facility: "Floodlit Turf Ground",
        price: 3500,
        isAvailable: true,
        amenities: ["LED Floodlights", "Generator Backup", "Full Ground", "Leather Ball Match"]
    },
    {
        id: "slot-5",
        title: "Night T20 Floodlight Showdown",
        time: "07:00 PM - 10:00 PM",
        facility: "Night Match Arena",
        price: 4000,
        isAvailable: true,
        amenities: ["Night Floodlights", "Full Power Backup", "Live Streaming Support", "Umpiring"]
    },
    {
        id: "slot-6",
        title: "Custom Time Practice Session",
        time: "Flexible Time (Your Choice)",
        facility: "Turf / Cement Net as needed",
        price: 1500,
        isAvailable: true,
        amenities: ["Choose Your Own Time", "Individual or Group", "Coach Guidance", "Net Booking"]
    }
];

const DEFAULT_NOTICES = [
    {
        id: "not-1",
        title: "RRPL 2026 (Shri Radha Rani Premier League) Trial Registrations Open!",
        date: "2026-04-20",
        tag: "RRPL Trials ₹1499",
        tagType: "tag-gold",
        content: "Open trials for RRPL 2026 with ₹4 Lakh winner prize and Scooty for Player of the Series. Food and stay included by RRPL Committee. Trial fee: ₹1,499.",
        urgent: true
    },
    {
        id: "not-2",
        title: "RAM SPORTS CUP - 7th Edition (Late Arun Yadav G Memorial) Entries Underway",
        date: "2026-04-18",
        tag: "RAM SPORTS CUP",
        tagType: "tag-purple",
        content: "Under-19 tournament from 04 to 15 Nov 2026 at RCA Ground Panigaon Raya Road. Team entry ₹15,000. Winner prize ₹51,000.",
        urgent: true
    },
    {
        id: "not-3",
        title: "Daily Morning & Evening Turf Net Practice Batches Active",
        date: "2026-04-15",
        tag: "Slot Booking",
        tagType: "tag-green",
        content: "Individual players and club teams can book morning or evening practice sessions. Custom time scheduling now supported.",
        urgent: false
    }
];

const DEFAULT_GALLERY = [
    {
        id: "gal-1",
        title: "RRPL 2026 Championship Trophy & Scooty Awards",
        category: "Tournaments",
        image: "assets/images/tournaments/rrpl-prizes-scooty.jpg",
        caption: "Shri Radha Rani Premier League 2026 prizes: ₹4 Lakhs Winner, ₹2 Lakhs Runner-up, Scooty for Player of the Series."
    },
    {
        id: "gal-2",
        title: "RAM SPORTS CUP 7th - Late Arun Yadav Memorial",
        category: "Tournaments",
        image: "assets/images/tournaments/ram-sports-cup-7th.jpg",
        caption: "Official poster for RAM SPORTS CUP 7th Edition at RCA Ground Panigaon Raya Road, Vrindavan."
    },
    {
        id: "gal-3",
        title: "RRPL 2026 Cash Awards & Individual Honors",
        category: "Tournaments",
        image: "assets/images/tournaments/rrpl-awards.jpg",
        caption: "Best Batsman & Best Bowler ₹11,000, Most Sixes & Fours ₹11,000, Century & Half-Century cash rewards."
    },
    {
        id: "gal-4",
        title: "RRPL Committee Hospitality - Good Food & Good Stay",
        category: "Facilities",
        image: "assets/images/tournaments/rrpl-hospitality.jpg",
        caption: "Deluxe accommodation and fresh nutritious meals provided to outstation players by RRPL Committee."
    },
    {
        id: "gal-5",
        title: "Turf Wicket Practice Session",
        category: "Nets Practice",
        image: "assets/images/hero-cricket.jpg",
        caption: "Early morning batting drills on match-quality turf pitch with Coach R.K. Chauhan."
    },
    {
        id: "gal-6",
        title: "Speed Monitoring & Bowling Analysis",
        category: "Coaching",
        image: "assets/images/net-practice.jpg",
        caption: "Pace bowlers practicing seam release and yorker drills with digital speed monitoring."
    }
];

const DEFAULT_BOOKINGS = [
    {
        id: "RCA-2026-1001",
        name: "Aarav Sharma",
        fatherName: "Rajesh Sharma",
        age: 15,
        phone: "9876543210",
        email: "aarav.cricket@gmail.com",
        city: "Vrindavan",
        role: "Batsman (Top Order)",
        totalPersons: "1 Player",
        bookingType: "RRPL Trial Registration (₹1,499)",
        slotDate: "2026-04-25",
        timeSlot: "Morning: 07:00 AM",
        status: "New",
        createdAt: "2026-04-20 09:15 AM",
        remarks: "Wants trial for RRPL 2026 U-19 draft."
    },
    {
        id: "RCA-2026-1002",
        name: "Vikramaditya Singh",
        fatherName: "K.P. Singh",
        age: 18,
        phone: "9123456789",
        email: "vikram.singh22@gmail.com",
        city: "Mathura",
        role: "Fast Bowler",
        totalPersons: "Full Team (15 Players)",
        bookingType: "RAM SPORTS CUP 7th (Team Entry ₹15,000)",
        slotDate: "2026-11-04",
        timeSlot: "Match Day Morning",
        status: "Contacted",
        createdAt: "2026-04-19 04:20 PM",
        remarks: "Mathura Strikers team entry for U-19 tournament."
    },
    {
        id: "RCA-2026-1003",
        name: "Prateek Agarwal",
        fatherName: "Manoj Agarwal",
        age: 24,
        phone: "9988776655",
        email: "prateek.agarwal@corp.com",
        city: "Vrindavan",
        role: "All-Rounder",
        totalPersons: "4 Players",
        bookingType: "Custom Turf Slot",
        slotDate: "2026-04-27",
        timeSlot: "06:30 AM - 08:30 AM",
        status: "Confirmed",
        createdAt: "2026-04-18 11:45 AM",
        remarks: "Custom time net booking for 4 players."
    }
];

class RcaDataManager {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem(RCA_STORAGE_KEY)) {
            const initialData = {
                settings: DEFAULT_SETTINGS,
                bookingTypes: DEFAULT_BOOKING_TYPES,
                tournaments: DEFAULT_TOURNAMENTS,
                slots: DEFAULT_SLOTS,
                notices: DEFAULT_NOTICES,
                gallery: DEFAULT_GALLERY,
                bookings: DEFAULT_BOOKINGS,
                lastUpdated: new Date().toISOString()
            };
            this.saveRawData(initialData);
        } else {
            // Migration check: ensure tournaments, slots, and booking types exist
            const data = this.getRawData();
            if (data) {
                let changed = false;
                if (!data.bookingTypes || data.bookingTypes.length === 0) {
                    data.bookingTypes = DEFAULT_BOOKING_TYPES;
                    changed = true;
                }
                if (!data.tournaments || data.tournaments.length === 0) {
                    data.tournaments = DEFAULT_TOURNAMENTS;
                    changed = true;
                }
                if (!data.slots || data.slots.length === 0) {
                    data.slots = DEFAULT_SLOTS;
                    changed = true;
                }
                if (data.settings && data.settings.email !== "RCAACADEMY9897@gmail.com") {
                    data.settings.email = "RCAACADEMY9897@gmail.com";
                    data.settings.adminNotifyEmail = "RCAACADEMY9897@gmail.com";
                    data.settings.domain = "ramcricketacademy.com";
                    data.settings.phoneAlternate = "8265800805";
                    changed = true;
                }
                if (changed) this.saveRawData(data);
            }
        }
        // Trigger background cloud sync with Supabase
        this.syncFromSupabase();
    }

    // -------------------------------------------------------------------------
    // SUPABASE CLOUD SYNC: Merges live Supabase Cloud Data into local store
    // -------------------------------------------------------------------------
    async syncFromSupabase() {
        if (!window.rcaSupabase || !window.rcaSupabase.isConfigured()) return false;
        try {
            console.log("⚡ [RCA Sync] Fetching latest live data from Supabase Cloud...");
            const isAdmin = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('rca_admin_logged_in') === 'true');
            const adminToken = window.rcaSupabase.getAdminToken();

            // Fetch public tables; fetch bookings if authenticated admin
            const promises = [
                window.rcaSupabase.fetchTournaments(),
                window.rcaSupabase.fetchSlots(),
                window.rcaSupabase.fetchGallery(),
                window.rcaSupabase.fetchNotices(),
                window.rcaSupabase.fetchBookingTypes(),
                (isAdmin || adminToken) ? window.rcaSupabase.fetchBookings(adminToken) : Promise.resolve(null),
                window.rcaSupabase.fetchSettings()
            ];

            const [supabaseTournaments, supabaseSlots, supabaseGallery, supabaseNotices, supabaseBookingTypes, supabaseBookings, supabaseSettings] = await Promise.all(promises);

            const data = this.getRawData() || {};
            let updated = false;

            if (supabaseTournaments && supabaseTournaments.length > 0) {
                data.tournaments = supabaseTournaments;
                updated = true;
            }
            if (supabaseSlots && supabaseSlots.length > 0) {
                data.slots = supabaseSlots;
                updated = true;
            }
            if (supabaseGallery && supabaseGallery.length > 0) {
                data.gallery = supabaseGallery;
                updated = true;
            }
            if (supabaseNotices && supabaseNotices.length > 0) {
                data.notices = supabaseNotices;
                updated = true;
            }
            if (supabaseBookingTypes && supabaseBookingTypes.length > 0) {
                data.bookingTypes = supabaseBookingTypes;
                updated = true;
            }
            if (supabaseBookings && Array.isArray(supabaseBookings)) {
                data.bookings = supabaseBookings;
                updated = true;
            }
            if (supabaseSettings && Object.keys(supabaseSettings).length > 0) {
                data.settings = { ...data.settings, ...supabaseSettings };
                updated = true;
            }

            if (updated) {
                this.saveRawData(data);
                console.log("✅ [RCA Sync] Supabase Cloud data successfully merged into local database!");
            }
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'supabase' } }));
            return true;
        } catch (e) {
            console.warn("❌ [RCA Supabase Sync Warning]:", e);
            return false;
        }
    }

    getRawData() {
        try {
            const dataStr = localStorage.getItem(RCA_STORAGE_KEY);
            return dataStr ? JSON.parse(dataStr) : null;
        } catch (e) {
            console.error("Error reading RCA data:", e);
            return null;
        }
    }

    saveRawData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem(RCA_STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("Error saving RCA data:", e);
            return false;
        }
    }

    // Settings
    getSettings() {
        const data = this.getRawData();
        return data ? data.settings : DEFAULT_SETTINGS;
    }

    updateSettings(newSettings) {
        const data = this.getRawData();
        if (data) {
            data.settings = { ...data.settings, ...newSettings };
            this.saveRawData(data);

            // Sync to Supabase
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateSettings(data.settings).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    // Booking Categories / Types Management (Admin Can Add/Delete)
    getBookingTypes() {
        const data = this.getRawData();
        return data && data.bookingTypes && data.bookingTypes.length > 0 
            ? data.bookingTypes 
            : DEFAULT_BOOKING_TYPES;
    }

    addBookingType(typeName) {
        if (!typeName || !typeName.trim()) return false;
        const data = this.getRawData();
        if (!data) return false;
        if (!data.bookingTypes) data.bookingTypes = [...DEFAULT_BOOKING_TYPES];
        const trimmed = typeName.trim();
        if (!data.bookingTypes.includes(trimmed)) {
            data.bookingTypes.push(trimmed);
            this.saveRawData(data);

            // Sync to Supabase
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.insertBookingType(trimmed).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    deleteBookingType(typeName) {
        const data = this.getRawData();
        if (!data || !data.bookingTypes) return false;
        data.bookingTypes = data.bookingTypes.filter(t => t !== typeName);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteBookingType(typeName).catch(e => console.warn(e));
        }
        return true;
    }

    // Tournaments Management
    getTournaments() {
        const data = this.getRawData();
        return data && data.tournaments ? data.tournaments : DEFAULT_TOURNAMENTS;
    }

    addTournament(t) {
        const data = this.getRawData();
        if (!data) return null;
        if (!data.tournaments) data.tournaments = [];
        const newTour = {
            id: `tour-${Date.now()}`,
            title: t.title || "New Tournament",
            shortTag: t.shortTag || "TOURNAMENT",
            category: t.category || "Cricket Cup",
            trialFee: parseInt(t.trialFee) || 0,
            teamFee: parseInt(t.teamFee) || 0,
            feeLabel: t.feeLabel || (t.trialFee ? `₹${t.trialFee}` : (t.teamFee ? `₹${t.teamFee}` : "TBD")),
            dates: t.dates || "Upcoming",
            status: t.status || "Registration Open",
            winnerPrize: t.winnerPrize || "Trophy",
            runnerPrize: t.runnerPrize || "Runner Trophy",
            playerOfSeries: t.playerOfSeries || "Trophy",
            specialAwards: t.specialAwards || "",
            hospitality: t.hospitality || "RCA Vrindavan",
            telecast: t.telecast || "Live Match",
            venue: t.venue || "RCA Ground, Vrindavan",
            poster: t.poster || "assets/images/tournaments/ram-sports-cup-7th.jpg",
            description: t.description || ""
        };
        data.tournaments.unshift(newTour);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertTournament(newTour).catch(e => console.warn(e));
        }

        return newTour;
    }

    deleteTournament(id) {
        const data = this.getRawData();
        if (!data || !data.tournaments) return false;
        data.tournaments = data.tournaments.filter(t => t.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteTournament(id).catch(e => console.warn(e));
        }
        return true;
    }

    // Slots Management (Available vs Sold Out)
    getSlots() {
        const data = this.getRawData();
        return data && data.slots ? data.slots : DEFAULT_SLOTS;
    }

    toggleSlotAvailability(slotId, isAvailable) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        const slot = data.slots.find(s => s.id === slotId);
        if (slot) {
            slot.isAvailable = (isAvailable !== undefined) ? isAvailable : !slot.isAvailable;
            this.saveRawData(data);

            // Sync to Supabase
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateSlotAvailability(slotId, slot.isAvailable).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    addCustomSlot(slot) {
        const data = this.getRawData();
        if (!data) return null;
        if (!data.slots) data.slots = [];
        const newSlot = {
            id: `slot-${Date.now()}`,
            title: slot.title || "Custom Practice Slot",
            time: slot.time || "Flexible",
            facility: slot.facility || "Turf Net",
            price: parseInt(slot.price) || 1500,
            isAvailable: true,
            amenities: slot.amenities || ["Turf Pitch", "Equipment Support"]
        };
        data.slots.push(newSlot);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertSlot(newSlot).catch(e => console.warn(e));
        }

        return newSlot;
    }

    deleteSlot(slotId) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        data.slots = data.slots.filter(s => s.id !== slotId);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteSlot(slotId).catch(e => console.warn(e));
        }
        return true;
    }

    // Bookings / Registrations (Dynamic & Extensible Schema)
    getBookings() {
        const data = this.getRawData();
        return data ? data.bookings : [];
    }

    addBooking(bookingInput) {
        const data = this.getRawData();
        if (!data) return null;

        const nextNum = 1000 + data.bookings.length + 1;

        // Dynamic Form Field Extraction: capture any extra fields into formData JSON
        const standardKeys = new Set([
            'id', 'name', 'fatherName', 'age', 'phone', 'email', 'city', 'role',
            'totalPersons', 'bookingType', 'slotDate', 'timeSlot', 'facilityType',
            'formType', 'status', 'createdAt', 'remarks', 'formData'
        ]);
        const customFormData = { ...(bookingInput.formData || {}) };
        for (const [k, v] of Object.entries(bookingInput)) {
            if (!standardKeys.has(k) && v !== undefined && v !== null && v !== '') {
                customFormData[k] = v;
            }
        }

        const newBooking = {
            id: bookingInput.id || `RCA-2026-${nextNum}`,
            name: bookingInput.name || "Anonymous",
            fatherName: bookingInput.fatherName || "-",
            age: bookingInput.age ? (parseInt(bookingInput.age) || bookingInput.age) : "-",
            phone: bookingInput.phone || "",
            email: bookingInput.email || "",
            city: bookingInput.city || "Vrindavan",
            role: bookingInput.role || "All-Rounder",
            totalPersons: bookingInput.totalPersons || "1 Player",
            bookingType: bookingInput.bookingType || "Free Trial Session",
            formType: bookingInput.formType || "slot_booking",
            slotDate: bookingInput.slotDate || new Date().toISOString().split('T')[0],
            timeSlot: bookingInput.timeSlot || "Flexible Time",
            facilityType: bookingInput.facilityType || "Turf Grounds",
            status: bookingInput.status || "New",
            createdAt: bookingInput.createdAt || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            remarks: bookingInput.remarks || "",
            formData: customFormData
        };

        data.bookings.unshift(newBooking);
        this.saveRawData(data);

        // Sync to Supabase Cloud Database
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertBooking(newBooking).catch(e => console.warn(e));
        }

        // Auto Sync with Google Sheets if Webhook is configured
        this.syncToGoogleSheet(newBooking);

        // Directly send background email alert to RCA admin (RCAACADEMY9897@gmail.com)
        this.sendAdminEmailAlert(newBooking);

        return newBooking;
    }

    updateBookingStatus(id, newStatus) {
        const data = this.getRawData();
        if (!data) return false;
        const booking = data.bookings.find(b => b.id === id);
        if (booking) {
            booking.status = newStatus;
            this.saveRawData(data);

            // Sync to Supabase
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateBookingStatus(id, newStatus).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    deleteBooking(id) {
        const data = this.getRawData();
        if (!data) return false;
        data.bookings = data.bookings.filter(b => b.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteBooking(id).catch(e => console.warn(e));
        }
        return true;
    }

    // Google Sheets Auto-Sync (Supports Dynamic Form Fields)
    syncToGoogleSheet(booking) {
        const settings = this.getSettings();
        if (!settings.googleSheetWebhookUrl) return;

        try {
            const payload = {
                bookingId: booking.id,
                timestamp: booking.createdAt,
                name: booking.name,
                phone: booking.phone,
                email: booking.email,
                totalPersons: booking.totalPersons,
                bookingType: booking.bookingType,
                formType: booking.formType || "slot_booking",
                slotDate: booking.slotDate,
                timeSlot: booking.timeSlot,
                city: booking.city,
                status: booking.status,
                remarks: booking.remarks,
                customFields: JSON.stringify(booking.formData || {})
            };

            // Also flatten extra custom fields directly into the sheet payload
            if (booking.formData && typeof booking.formData === 'object') {
                for (const [key, val] of Object.entries(booking.formData)) {
                    payload[`custom_${key}`] = val;
                }
            }

            fetch(settings.googleSheetWebhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).catch(e => console.warn("Google Sheet sync notice:", e));
        } catch (err) {
            console.warn("Google Sheet sync error:", err);
        }
    }

    // Direct background email dispatch to RCA admin (Includes Dynamic Form Fields)
    sendAdminEmailAlert(booking) {
        const settings = this.getSettings();
        const adminEmail = settings.adminNotifyEmail || "RCAACADEMY9897@gmail.com";
        try {
            const emailPayload = {
                _subject: `[New RCA Booking] ${booking.id} - ${booking.name} (${booking.bookingType})`,
                _template: "table",
                _captcha: "false",
                Booking_ID: booking.id,
                Form_Type: booking.formType || "slot_booking",
                Player_Name: booking.name,
                Phone_Number: booking.phone,
                Total_Persons: booking.totalPersons || "1 Player",
                Player_Age: booking.age,
                Father_Name: booking.fatherName || "-",
                Player_Role: booking.role || "All-Rounder",
                Booking_Category: booking.bookingType,
                Preferred_Date: booking.slotDate,
                Preferred_Time: booking.timeSlot,
                City: booking.city,
                Remarks: booking.remarks || "None",
                Academy_Ground: "Panigaon Raya Road & Garun Govind Road, Vrindavan",
                Head_Coach: "Coach R.K. Chauhan (+91 9897517704)",
                Registration_Time: booking.createdAt
            };

            // Dynamically include any custom / future form fields in the email table!
            if (booking.formData && typeof booking.formData === 'object') {
                for (const [k, v] of Object.entries(booking.formData)) {
                    if (v !== undefined && v !== null && v !== '') {
                        const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        emailPayload[`Field_${formattedKey}`] = v;
                    }
                }
            }

            fetch(`https://formsubmit.co/ajax/${adminEmail}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(emailPayload)
            }).catch(e => console.warn("Admin email alert dispatch notice:", e));
        } catch (err) {
            console.warn("Background email notification error:", err);
        }
    }

    // Sync all existing bookings to Google Sheets
    async syncAllToGoogleSheet() {
        const settings = this.getSettings();
        if (!settings.googleSheetWebhookUrl) {
            return { success: false, message: "Please configure your Google Sheet Webhook URL in settings first." };
        }
        const bookings = this.getBookings();
        let count = 0;
        for (const b of bookings) {
            this.syncToGoogleSheet(b);
            count++;
        }
        return { success: true, count };
    }

    // Gallery
    getGallery() {
        const data = this.getRawData();
        return data ? data.gallery : [];
    }

    addGalleryItem(item) {
        const data = this.getRawData();
        if (!data) return null;
        const newItem = {
            id: `gal-${Date.now()}`,
            title: item.title || "Academy Action",
            category: item.category || "General",
            image: item.image || "assets/images/hero-cricket.jpg",
            caption: item.caption || ""
        };
        data.gallery.unshift(newItem);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertGallery(newItem).catch(e => console.warn(e));
        }

        return newItem;
    }

    deleteGalleryItem(id) {
        const data = this.getRawData();
        if (!data) return false;
        data.gallery = data.gallery.filter(g => g.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteGallery(id).catch(e => console.warn(e));
        }

        return true;
    }

    // Notices
    getNotices() {
        const data = this.getRawData();
        return data ? data.notices : [];
    }

    addNotice(notice) {
        const data = this.getRawData();
        if (!data) return null;
        const newNotice = {
            id: `not-${Date.now()}`,
            title: notice.title || "Announcement",
            date: notice.date || new Date().toISOString().split('T')[0],
            tag: notice.tag || "Update",
            tagType: notice.tagType || "tag-purple",
            content: notice.content || "",
            urgent: !!notice.urgent
        };
        data.notices.unshift(newNotice);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertNotice(newNotice).catch(e => console.warn(e));
        }

        return newNotice;
    }

    deleteNotice(id) {
        const data = this.getRawData();
        if (!data) return false;
        data.notices = data.notices.filter(n => n.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteNotice(id).catch(e => console.warn(e));
        }

        return true;
    }

    // WhatsApp Message Generators
    getCoachWhatsAppUrl(booking) {
        const settings = this.getSettings();
        const coachPhone = settings.phone.replace(/[^0-9]/g, '');
        const text = encodeURIComponent(
            `*New Registration / Slot Booking - RCA Vrindavan*\n` +
            `-----------------------------------\n` +
            `*Booking ID:* ${booking.id}\n` +
            `*Player Name:* ${booking.name}\n` +
            `*Contact Phone:* ${booking.phone}\n` +
            `*Total Persons:* ${booking.totalPersons || '1 Player'}\n` +
            `*Program / Slot:* ${booking.bookingType}\n` +
            `*Date:* ${booking.slotDate}\n` +
            `*Time:* ${booking.timeSlot}\n` +
            `*City:* ${booking.city}\n` +
            `*Remarks:* ${booking.remarks || 'None'}\n` +
            `-----------------------------------\n` +
            `Hello Coach R.K. Chauhan sir, I have registered via ramcricketacademy.com. Please confirm my booking!`
        );
        return `https://wa.me/91${coachPhone}?text=${text}`;
    }

    getPlayerWhatsAppUrl(booking) {
        const cleanPhone = booking.phone.replace(/[^0-9]/g, '');
        const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const text = encodeURIComponent(
            `Hello ${booking.name}! Greetings from *RAM CRICKET ACADEMY (RCA), Vrindavan*.\n\n` +
            `We have received your registration (*Ref: ${booking.id}*) for *${booking.bookingType}* (${booking.totalPersons || '1 Player'}).\n` +
            `*Preferred Date & Time:* ${booking.slotDate} (${booking.timeSlot})\n\n` +
            `Coach R.K. Chauhan and our management will coordinate with you directly.\n\n` +
            `Ground Venue: Garun Govind Road / Panigaon Raya Road, Vrindavan.\n` +
            `Official Helpdesk: +91 9897517704, 8265800805 | Email: RCAACADEMY9897@gmail.com`
        );
        return `https://wa.me/${targetPhone}?text=${text}`;
    }

    // Admin Mailto Hook
    getAdminMailtoUrl(booking) {
        const settings = this.getSettings();
        const subject = encodeURIComponent(`[RCA Booking] ${booking.id} - ${booking.name} (${booking.bookingType})`);
        const body = encodeURIComponent(
            `New Booking & Registration details for Ram Cricket Academy (ramcricketacademy.com):\n\n` +
            `Booking ID: ${booking.id}\n` +
            `Player Name: ${booking.name}\n` +
            `Total Persons: ${booking.totalPersons || '1 Player'}\n` +
            `Contact Phone: ${booking.phone}\n` +
            `Email: ${booking.email}\n` +
            `Booking Type: ${booking.bookingType}\n` +
            `Preferred Date: ${booking.slotDate}\n` +
            `Time: ${booking.timeSlot}\n` +
            `City: ${booking.city}\n` +
            `Remarks: ${booking.remarks}\n\n` +
            `Submitted on: ${booking.createdAt}`
        );
        return `mailto:${settings.adminNotifyEmail}?subject=${subject}&body=${body}`;
    }

    // Export to CSV for Excel / Google Sheets
    exportToCsv() {
        const bookings = this.getBookings();
        if (!bookings.length) return null;

        const headers = ["Booking ID", "Name", "Total Persons", "Phone", "Email", "City", "Role", "Booking Type", "Date", "Slot Time", "Status", "Registered At", "Remarks"];
        const rows = bookings.map(b => [
            b.id,
            `"${(b.name || '').replace(/"/g, '""')}"`,
            `"${b.totalPersons || '1 Player'}"`,
            `"${b.phone}"`,
            `"${b.email}"`,
            `"${b.city}"`,
            `"${b.role}"`,
            `"${b.bookingType}"`,
            b.slotDate,
            `"${b.timeSlot}"`,
            b.status,
            `"${b.createdAt}"`,
            `"${(b.remarks || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    // Reset Data
    resetToDefault() {
        localStorage.removeItem(RCA_STORAGE_KEY);
        this.init();
    }
}

// Global singleton instance
window.rcaDB = new RcaDataManager();
