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
    address: "RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)",
    grounds: [
        "RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)",
        "Hazarimal Somani Cricket Ground, Vrindavan",
        "Garun Govind Road Ground, Near Chhatikara, Vrindavan"
    ],
    city: "Vrindavan",
    timings: "Morning: 6:00 AM - 10:00 AM | Evening: 4:00 PM - 8:00 PM",
    googleSheetWebhookUrl: "", // Google Apps Script Webhook URL for auto-saving bookings
    slotUtrRequired: true,     // Admin policy toggle: UTR mandatory vs optional for slot bookings (Default: true)
    admissionFee: 1499,        // Official New Joiny Academy Admission Fee (Editable by Admin)
    upiId: "ramsports6072@ybl", // Official UPI ID for Academy & Slot Payments
    aboutBio: "With dedicated grassroots coaching and match mentorship since 2018, Coach R.K. Chauhan established Ram Cricket Academy (RCA) with a mission: to provide international-standard cricket infrastructure, floodlit turf grounds, and major tournaments like RRPL 2026 and the RAM SPORTS CUP in Vrindavan.",
    aboutQuote: "Cricket demands commitment, technique, and a warrior mindset. Every child who enters RCA receives individual attention to unlock their true potential.",
    aboutYearsExp: "8+",
    aboutTitle: "Founder, Senior Mentor & Biomechanics Specialist"
};

// Default Booking / Inquiry Categories (Admin can add/edit price/delete from admin panel)
const DEFAULT_BOOKING_TYPES = [
    { name: "RRPL Trial Registration", price: 1499, label: "Official Trial Fee" },
    { name: "RAM SPORTS CUP 7th (Team Entry)", price: 15000, label: "Team Registration" },
    { name: "Turf Net Practice Slot", price: 2500, label: "2-Hour Slot" },
    { name: "Monthly Academy Admission", price: 1499, label: "Monthly Training" },
    { name: "Full Ground Match Booking", price: 6500, label: "Per Match" },
    { name: "Bowling Machine Practice", price: 1200, label: "Per Hour" },
    { name: "Free Trial Session", price: 0, label: "Complimentary" }
];

// Helper to normalize any booking type (string or object) into structured object
function normalizeBookingType(item) {
    if (!item) return { name: "Other Inquiry", price: 0, label: "" };
    if (typeof item === 'object' && item.name) {
        return {
            name: String(item.name).trim(),
            price: parseInt(item.price) || 0,
            label: item.label ? String(item.label).trim() : ""
        };
    }
    const str = String(item).trim();
    const match = str.match(/₹\s*([0-9,]+)/);
    let price = 0;
    if (match) {
        price = parseInt(match[1].replace(/,/g, '')) || 0;
    } else if (str.toLowerCase().includes('rrpl') || str.toLowerCase().includes('trial registration')) {
        price = 1499;
    } else if (str.toLowerCase().includes('ram sports cup')) {
        price = 15000;
    } else if (str.toLowerCase().includes('turf net')) {
        price = 2500;
    } else if (str.toLowerCase().includes('monthly academy')) {
        price = 1499;
    } else if (str.toLowerCase().includes('full ground')) {
        price = 6500;
    } else if (str.toLowerCase().includes('bowling machine')) {
        price = 1200;
    }
    return {
        name: str,
        price: price,
        label: ""
    };
}

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
        hospitality: "Organized by RRPL Committee",
        telecast: "Live Telecast Available",
        venue: "RCA Ground, Vrindavan (Mathura)",
        poster: "assets/images/tournaments/rrpl-prizes-scooty.jpg",
        description: "Grand cricket spectacle in Vrindavan with ₹4 Lakhs first prize, 2 Lakhs runner-up prize, scooty for Player of the Series, and live broadcast."
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

// Default Total Persons / Group Sizes (Admin can Add / Delete)
const DEFAULT_PERSON_TIERS = [
    "1 Player (Individual Practice)",
    "2 Players",
    "3-5 Players (Net Group)",
    "6-10 Players",
    "Full Team (11-15 Players)",
    "Both Teams (22+ Players)"
];

// Helper to generate dynamic UPI QR image URL for any slot's rate & group size
function generateSlotDynamicQrUrl(price, title, tierName = '') {
    const fixedRate = parseInt(price) || 1500;
    const note = tierName ? `${title || 'RCA Slot'} (${tierName})` : (title || 'RCA Slot Booking');
    const upiData = `upi://pay?pa=ramsports6072@ybl&pn=Ram%20Sports%20Academy&am=${fixedRate}.00&cu=INR&tn=${encodeURIComponent(note)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiData)}`;
}

const DEFAULT_SLOTS = [
    {
        id: "slot-1",
        title: "Morning Early Bird Turf Wicket",
        time: "06:00 AM - 08:30 AM",
        facility: "International Standard Turf Pitch",
        price: 1200,
        isAvailable: true,
        amenities: ["Natural Turf Wicket", "Leather Ball Ready", "Sight Screen Provided", "Coach Oversight"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 500,
            "2 Players": 800,
            "3-5 Players (Net Group)": 1200,
            "6-10 Players": 1800,
            "Full Team (11-15 Players)": 2400,
            "Both Teams (22+ Players)": 4000
        }
    },
    {
        id: "slot-2",
        title: "Morning Masterclass & Drills",
        time: "08:30 AM - 10:30 AM",
        facility: "Turf & Cement Practice Net",
        price: 1500,
        isAvailable: true,
        amenities: ["Turf Practice Net", "Bowling Machine", "Video Camera Analysis", "Senior Coach Guidance"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 700,
            "2 Players": 1000,
            "3-5 Players (Net Group)": 1500,
            "6-10 Players": 2200,
            "Full Team (11-15 Players)": 3000,
            "Both Teams (22+ Players)": 5000
        }
    },
    {
        id: "slot-3",
        title: "Afternoon Match Simulation",
        time: "12:00 PM - 03:00 PM",
        facility: "Match Standard Turf Pitch",
        price: 2500,
        isAvailable: true,
        amenities: ["Full Pitch Match Simulation", "White & Red Ball Setup", "Digital Scoring Display", "Umpire Support"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 800,
            "2 Players": 1200,
            "3-5 Players (Net Group)": 1800,
            "6-10 Players": 2500,
            "Full Team (11-15 Players)": 3500,
            "Both Teams (22+ Players)": 6000
        }
    },
    {
        id: "slot-4",
        title: "Sunset Fast Bowler Speed Camp",
        time: "04:00 PM - 06:30 PM",
        facility: "Fast Bowling Turf Net",
        price: 1800,
        isAvailable: true,
        amenities: ["Speed Gun Radar", "Turf Run-up & Crease", "Target Bowling Stumps", "Fitness Supervision"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 600,
            "2 Players": 1000,
            "3-5 Players (Net Group)": 1500,
            "6-10 Players": 1800,
            "Full Team (11-15 Players)": 2800,
            "Both Teams (22+ Players)": 4800
        }
    },
    {
        id: "slot-5",
        title: "Night T20 Floodlight Showdown",
        time: "07:00 PM - 10:00 PM",
        facility: "Floodlit Night Match Arena",
        price: 4000,
        isAvailable: true,
        amenities: ["High-Mast LED Floodlights", "Generator Backup", "Full Match Ground", "Leather Ball Match Ready"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 1000,
            "2 Players": 1800,
            "3-5 Players (Net Group)": 2800,
            "6-10 Players": 3500,
            "Full Team (11-15 Players)": 4000,
            "Both Teams (22+ Players)": 7500
        }
    },
    {
        id: "slot-6",
        title: "Custom Time Practice Session",
        time: "Flexible Time (Your Choice)",
        facility: "Turf / Cement Net as needed",
        price: 1500,
        isAvailable: true,
        amenities: ["Choose Your Own Time", "Individual or Group", "Coach Guidance", "Net Booking"],
        qrImage: "",
        personPrices: {
            "1 Player (Individual Practice)": 600,
            "2 Players": 900,
            "3-5 Players (Net Group)": 1500,
            "6-10 Players": 2000,
            "Full Team (11-15 Players)": 3000,
            "Both Teams (22+ Players)": 5000
        }
    }
];

const DEFAULT_NOTICES = [
    {
        id: "not-1",
        title: "RRPL 2026 (Shri Radha Rani Premier League) Trial Registrations Open!",
        date: "2026-04-20",
        tag: "RRPL Trials ₹1499",
        tagType: "tag-gold",
        content: "Open trials for RRPL 2026 with ₹4 Lakh winner prize, ₹2 Lakh runner-up, and Scooty for Player of the Series. Trial fee: ₹1,499.",
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
        title: "RRPL Match Facilities & Ground Preparation",
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

// Default Committee Members (President, Owner, CEO, Coaches - Admin Editable)
const DEFAULT_COMMITTEE = [
    {
        id: "comm-1",
        name: "Shri R.K. Chauhan",
        designation: "Founder, Head Coach & Director",
        photo: "assets/images/logo.png",
        bio: "Senior Cricket Mentor & Certified Biomechanics Specialist leading RCA grassroots & high-performance programs since 2018.",
        order: 1
    },
    {
        id: "comm-2",
        name: "Shri Ramveer Singh Chauhan",
        designation: "President - RCA Management Board",
        photo: "assets/images/logo.png",
        bio: "Chief Patron and President governing academy administration, infrastructure development, and player welfare.",
        order: 2
    },
    {
        id: "comm-3",
        name: "Mr. Gaurav Sharma",
        designation: "Chief Executive Officer (CEO) & Operations Head",
        photo: "assets/images/logo.png",
        bio: "Overseeing state tournament operations, RRPL 2026 execution, athlete logistics, and facility management.",
        order: 3
    },
    {
        id: "comm-4",
        name: "Coach Amit Verma",
        designation: "Senior Batting & Fielding Coach",
        photo: "assets/images/logo.png",
        bio: "Former State Ranji Trophy player specializing in stroke play, match technique, and junior talent development.",
        order: 4
    }
];

// Default Sponsors & Partners (Admin Editable)
const DEFAULT_SPONSORS = [
    {
        id: "spon-1",
        name: "Ram Sports & Cricket Gear",
        designation: "Official Kit & Equipment Partner",
        city: "Mathura / Vrindavan",
        shortInfo: "Providing international-standard English willow bats, match leather balls, and protective gear for all RCA tournaments and trials.",
        logo: "assets/images/logo.png",
        order: 1
    },
    {
        id: "spon-2",
        name: "Vrindavan Royal Sports Hospitality",
        designation: "Official Accommodation & Food Partner",
        city: "Vrindavan",
        shortInfo: "Delivering hygienic sports nutrition, boarding, and athlete stay for visiting district and state tournament players.",
        logo: "assets/images/tournaments/rrpl-hospitality.jpg",
        order: 2
    },
    {
        id: "spon-3",
        name: "Radha Rani Premier League (RRPL)",
        designation: "Title Championship Partner",
        city: "Braj Region, UP",
        shortInfo: "Braj's grandest floodlit cricket league offering ₹1,00,000 cash prizes, live match broadcasting, and state selection trials.",
        logo: "assets/images/tournaments/ram-sports-cup-7th.jpg",
        order: 3
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
        formType: "slot_booking",
        category: "",
        feeAmount: "1500",
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
                personTiers: DEFAULT_PERSON_TIERS,
                tournaments: DEFAULT_TOURNAMENTS,
                slots: DEFAULT_SLOTS,
                notices: DEFAULT_NOTICES,
                gallery: DEFAULT_GALLERY,
                committee: DEFAULT_COMMITTEE,
                sponsors: DEFAULT_SPONSORS,
                bookings: DEFAULT_BOOKINGS,
                lastUpdated: new Date().toISOString()
            };
            this.saveRawData(initialData);
        } else {
            // Migration check: ensure tournaments, slots, booking types, person tiers, committee, and sponsors exist
            const data = this.getRawData();
            if (data) {
                let changed = false;
                if (!data.committee || data.committee.length === 0) {
                    data.committee = [...DEFAULT_COMMITTEE];
                    changed = true;
                }
                if (!data.sponsors || data.sponsors.length === 0) {
                    data.sponsors = [...DEFAULT_SPONSORS];
                    changed = true;
                }
                if (!data.personTiers || data.personTiers.length === 0) {
                    data.personTiers = [...DEFAULT_PERSON_TIERS];
                    changed = true;
                }
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
                } else {
                    // Ensure every slot has personPrices map populated
                    data.slots.forEach(slot => {
                        if (!slot.personPrices || Object.keys(slot.personPrices).length === 0) {
                            const def = DEFAULT_SLOTS.find(ds => ds.id === slot.id || ds.title === slot.title);
                            if (def && def.personPrices) {
                                slot.personPrices = { ...def.personPrices };
                            } else {
                                const base = slot.price || 1500;
                                slot.personPrices = {
                                    "1 Player (Individual Practice)": Math.round(base * 0.4),
                                    "2 Players": Math.round(base * 0.6),
                                    "3-5 Players (Net Group)": Math.round(base * 0.8),
                                    "Full Team (11-15 Players)": base,
                                    "Both Teams (22+ Players)": Math.round(base * 1.8)
                                };
                            }
                            changed = true;
                        }
                    });
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
                window.rcaSupabase.fetchSettings(),
                window.rcaSupabase.fetchCommittee ? window.rcaSupabase.fetchCommittee() : Promise.resolve(null),
                window.rcaSupabase.fetchSponsors ? window.rcaSupabase.fetchSponsors() : Promise.resolve(null)
            ];

            const [supabaseTournaments, supabaseSlots, supabaseGallery, supabaseNotices, supabaseBookingTypes, supabaseBookings, supabaseSettings, supabaseCommittee, supabaseSponsors] = await Promise.all(promises);

            const data = this.getRawData() || {};
            let updated = false;

            if (supabaseTournaments && supabaseTournaments.length > 0) {
                data.tournaments = supabaseTournaments;
                updated = true;
            }
            if (supabaseSlots && supabaseSlots.length > 0) {
                // SAFE MERGE: Preserves locally added slots, merges cloud updates
                const existingSlots = data.slots || [];
                const slotMap = new Map();
                existingSlots.forEach(s => slotMap.set(s.id, s));
                supabaseSlots.forEach(s => {
                    const prev = slotMap.get(s.id) || {};
                    const mergedPrices = { ...(prev.personPrices || {}), ...(s.personPrices || {}) };
                    slotMap.set(s.id, { ...prev, ...s, personPrices: mergedPrices });
                });
                data.slots = Array.from(slotMap.values());
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
                // SAFE MERGE: Supports dynamic price & preserves categories
                const existingTypes = (data.bookingTypes || []).map(normalizeBookingType);
                const typeMap = new Map();
                existingTypes.forEach(t => typeMap.set(t.name.toLowerCase().trim(), t));
                supabaseBookingTypes.forEach(raw => {
                    const norm = normalizeBookingType(raw);
                    const key = norm.name.toLowerCase().trim();
                    const prev = typeMap.get(key) || {};
                    typeMap.set(key, { ...prev, ...norm });
                });
                data.bookingTypes = Array.from(typeMap.values());
                updated = true;
            }
            if (supabaseBookings && Array.isArray(supabaseBookings)) {
                if (supabaseBookings.length > 0) {
                    const existingBookings = data.bookings || [];
                    const map = new Map();
                    supabaseBookings.forEach(b => map.set(b.id, b));
                    existingBookings.forEach(b => {
                        if (!map.has(b.id)) map.set(b.id, b);
                    });
                    data.bookings = Array.from(map.values());
                    updated = true;
                }
            }
            if (supabaseSettings && Object.keys(supabaseSettings).length > 0) {
                data.settings = { ...data.settings, ...supabaseSettings };
                updated = true;
            }
            if (supabaseCommittee && supabaseCommittee.length > 0) {
                data.committee = supabaseCommittee;
                updated = true;
            }
            if (supabaseSponsors && supabaseSponsors.length > 0) {
                data.sponsors = supabaseSponsors;
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

    getAdmissionFee() {
        const settings = this.getSettings();
        return parseInt(settings && settings.admissionFee) || 1499;
    }

    updateAdmissionFee(newFee) {
        const data = this.getRawData();
        if (!data) return false;
        if (!data.settings) data.settings = {};
        const fee = parseInt(newFee) || 1499;
        data.settings.admissionFee = fee;
        this.saveRawData(data);
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSettings({ admissionFee: fee }).catch(e => console.warn(e));
        }
        return true;
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

    // Booking Categories / Types Management (Admin Can Add/Edit Price/Delete)
    getBookingTypes() {
        const data = this.getRawData();
        const rawList = (data && data.bookingTypes && data.bookingTypes.length > 0)
            ? data.bookingTypes 
            : DEFAULT_BOOKING_TYPES;
        return rawList.map(normalizeBookingType);
    }

    addBookingType(typeName, price = 0, label = '') {
        if (!typeName || !typeName.trim()) return false;
        const data = this.getRawData();
        if (!data) return false;
        if (!data.bookingTypes) data.bookingTypes = DEFAULT_BOOKING_TYPES.map(normalizeBookingType);
        
        const trimmed = typeName.trim();
        const numPrice = parseInt(price) || 0;
        const trimmedLabel = (label || '').trim();

        const normList = data.bookingTypes.map(normalizeBookingType);
        const existing = normList.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
        
        if (existing) {
            existing.price = numPrice;
            existing.label = trimmedLabel;
            data.bookingTypes = normList;
        } else {
            data.bookingTypes = [...normList, { name: trimmed, price: numPrice, label: trimmedLabel }];
        }
        
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertBookingType(trimmed, numPrice, trimmedLabel).catch(e => console.warn(e));
        }
        return true;
    }

    updateBookingTypePrice(typeName, newPrice, newLabel) {
        const data = this.getRawData();
        if (!data || !data.bookingTypes) return false;
        const normTypes = data.bookingTypes.map(normalizeBookingType);
        const match = normTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());
        if (match) {
            match.price = parseInt(newPrice) || 0;
            if (newLabel !== undefined) match.label = newLabel;
            data.bookingTypes = normTypes;
            this.saveRawData(data);
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateBookingTypePrice(match.name, match.price, match.label).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    deleteBookingType(typeName) {
        const data = this.getRawData();
        if (!data || !data.bookingTypes) return false;
        data.bookingTypes = data.bookingTypes.filter(t => {
            const name = typeof t === 'string' ? t : t.name;
            return name.toLowerCase() !== typeName.toLowerCase();
        });
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

    updateTournamentFees(tourId, trialFee, teamFee, feeLabel) {
        const data = this.getRawData();
        if (!data || !data.tournaments) return false;
        const tour = data.tournaments.find(t => t.id === tourId);
        if (tour) {
            if (trialFee !== undefined) tour.trialFee = parseInt(trialFee) || 0;
            if (teamFee !== undefined) tour.teamFee = parseInt(teamFee) || 0;
            if (feeLabel !== undefined) tour.feeLabel = feeLabel;
            this.saveRawData(data);
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateTournamentFees(tourId, {
                    trialFee: tour.trialFee,
                    teamFee: tour.teamFee,
                    feeLabel: tour.feeLabel
                }).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
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

    updateSlotPrice(slotId, newPrice) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        const slot = data.slots.find(s => s.id === slotId);
        if (slot) {
            slot.price = parseInt(newPrice) || 0;
            this.saveRawData(data);
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateSlotPrice(slotId, slot.price).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    // Get QR image for a slot: custom uploaded QR or dynamic UPI QR with exact fixed/tier rate
    getSlotQrUrl(slot, tierPrice = null, tierName = '') {
        if (!slot) return "assets/images/rca_open_qr.png";
        const price = tierPrice !== null && !isNaN(parseInt(tierPrice)) && parseInt(tierPrice) > 0 
            ? parseInt(tierPrice) 
            : (parseInt(slot.price) || 1500);

        // If custom QR image uploaded and no tierPrice override, use uploaded image
        if (slot.qrImage && String(slot.qrImage).trim().length > 0 && (!tierPrice || parseInt(tierPrice) === parseInt(slot.price))) {
            return slot.qrImage;
        }
        return generateSlotDynamicQrUrl(price, slot.title, tierName);
    }

    // Dynamic Tier Pricing: Get price for a specific slot & group size (1 Player, 2 Players, Full Team, etc.)
    getSlotPriceForTier(slotOrTitle, tierName) {
        if (!slotOrTitle) return 1500;
        let slot = null;
        if (typeof slotOrTitle === 'object' && slotOrTitle.title) {
            slot = slotOrTitle;
        } else {
            const slots = this.getSlots();
            const searchTitle = String(slotOrTitle).toLowerCase().trim();
            slot = slots.find(s => s.title && s.title.toLowerCase().trim() === searchTitle)
                || slots.find(s => s.title && s.title.toLowerCase().includes(searchTitle));
        }
        if (!slot) return 1500;

        const prices = slot.personPrices || {};
        if (tierName && prices[tierName] !== undefined && !isNaN(parseInt(prices[tierName])) && parseInt(prices[tierName]) > 0) {
            return parseInt(prices[tierName]);
        }

        // Fuzzy match in case string whitespace differs slightly
        if (tierName) {
            const tLower = tierName.toLowerCase();
            for (const [k, v] of Object.entries(prices)) {
                if (k.toLowerCase() === tLower || tLower.includes(k.toLowerCase()) || k.toLowerCase().includes(tLower)) {
                    if (!isNaN(parseInt(v)) && parseInt(v) > 0) return parseInt(v);
                }
            }
        }

        return parseInt(slot.price) || 1500;
    }

    // Update single tier price for a specific slot
    updateSlotTierPrice(slotId, tierName, price) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        const slot = data.slots.find(s => s.id === slotId);
        if (!slot) return false;

        if (!slot.personPrices) slot.personPrices = {};
        slot.personPrices[tierName] = parseInt(price) || 0;
        this.saveRawData(data);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'slot_tier_price' } }));
        }

        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSlotPersonPrices(slotId, slot.personPrices).catch(e => console.warn(e));
        }
        return true;
    }

    // Update all tier prices at once for a slot
    updateSlotAllTierPrices(slotId, tierPricesMap) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        const slot = data.slots.find(s => s.id === slotId);
        if (!slot) return false;

        slot.personPrices = { ...(slot.personPrices || {}), ...tierPricesMap };
        this.saveRawData(data);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'slot_tier_price' } }));
        }

        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSlotPersonPrices(slotId, slot.personPrices).catch(e => console.warn(e));
        }
        return true;
    }

    // Total Persons / Group Sizes Manager (User Requested)
    getPersonTiers() {
        const data = this.getRawData();
        if (data && data.personTiers && Array.isArray(data.personTiers) && data.personTiers.length > 0) {
            return data.personTiers;
        }
        return DEFAULT_PERSON_TIERS;
    }

    addPersonTier(tierName) {
        if (!tierName || !tierName.trim()) return false;
        const data = this.getRawData();
        if (!data) return false;
        if (!data.personTiers) data.personTiers = [...DEFAULT_PERSON_TIERS];

        const trimmed = tierName.trim();
        if (!data.personTiers.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
            data.personTiers.push(trimmed);
            this.saveRawData(data);

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'person_tiers' } }));
            }

            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateSettings({ personTiers: data.personTiers }).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    deletePersonTier(tierName) {
        const data = this.getRawData();
        if (!data) return false;
        if (!data.personTiers) data.personTiers = [...DEFAULT_PERSON_TIERS];

        data.personTiers = data.personTiers.filter(t => t.toLowerCase() !== tierName.toLowerCase());
        this.saveRawData(data);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'person_tiers' } }));
        }

        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSettings({ personTiers: data.personTiers }).catch(e => console.warn(e));
        }
        return true;
    }

    // Update custom QR code image for a specific slot
    updateSlotQr(slotId, newQrImage) {
        const data = this.getRawData();
        if (!data || !data.slots) return false;
        const slot = data.slots.find(s => s.id === slotId);
        if (slot) {
            slot.qrImage = newQrImage || "";
            this.saveRawData(data);
            if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
                window.rcaSupabase.updateSlotAvailability(slotId, slot.isAvailable).catch(e => console.warn(e));
            }
            return true;
        }
        return false;
    }

    // Admin Policy: Toggle whether UTR is mandatory or optional for practice slots
    updateSlotUtrPolicy(isMandatory) {
        const data = this.getRawData();
        if (!data) return false;
        if (!data.settings) data.settings = {};
        data.settings.slotUtrRequired = Boolean(isMandatory);
        this.saveRawData(data);
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSettings(data.settings).catch(e => console.warn(e));
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'slot_utr_policy' } }));
        }
        return true;
    }

    isSlotUtrRequired() {
        const settings = this.getSettings();
        return Boolean(settings && settings.slotUtrRequired);
    }

    addCustomSlot(slot) {
        const data = this.getRawData();
        if (!data) return null;
        if (!data.slots) data.slots = [];

        const amenitiesList = Array.isArray(slot.amenities)
            ? slot.amenities
            : (slot.amenities ? String(slot.amenities).split(',').map(a => a.trim()).filter(Boolean) : ["Turf Pitch", "Coach Supervision"]);

        const baseRate = parseInt(slot.price) || 1500;
        const defaultTierPrices = {};
        const activeTiers = this.getPersonTiers();
        activeTiers.forEach((tier, idx) => {
            if (tier.includes('1 Player')) defaultTierPrices[tier] = Math.round(baseRate * 0.4);
            else if (tier.includes('2 Players')) defaultTierPrices[tier] = Math.round(baseRate * 0.6);
            else if (tier.includes('3-5') || tier.includes('3 - 5')) defaultTierPrices[tier] = Math.round(baseRate * 0.8);
            else if (tier.includes('Full Team') || tier.includes('Team')) defaultTierPrices[tier] = baseRate;
            else if (tier.includes('Both Teams') || tier.includes('22')) defaultTierPrices[tier] = Math.round(baseRate * 1.8);
            else defaultTierPrices[tier] = Math.round(baseRate * (1 + idx * 0.2));
        });

        const newSlot = {
            id: `slot-${Date.now()}`,
            title: slot.title || "Custom Practice Slot",
            time: slot.time || "Flexible",
            facility: slot.facility || "Turf Net",
            price: baseRate,
            isAvailable: true,
            amenities: amenitiesList,
            qrImage: slot.qrImage || "",
            personPrices: slot.personPrices || defaultTierPrices
        };
        data.slots.push(newSlot);

        // Also register in bookingTypes with its price so it is universally known
        if (data.bookingTypes) {
            const norm = data.bookingTypes.map(normalizeBookingType);
            const found = norm.find(t => t.name.toLowerCase() === newSlot.title.toLowerCase());
            if (!found) {
                data.bookingTypes.push({ name: newSlot.title, price: newSlot.price, label: "Ground Slot" });
            }
        }

        this.saveRawData(data);

        // Dispatch live update event so public website & admin instantly show the new slot card
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'local', entity: 'slots' } }));
        }

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

        const ft = (bookingInput.formType || '').toLowerCase();
        const bt = (bookingInput.bookingType || '').toLowerCase();
        const cat = (bookingInput.category || '').toLowerCase();

        // 1. TOURNAMENT CLASSIFICATION (RRPL 2026, RAM SPORTS CUP, & All Cups/Leagues)
        const isTournament = (
            ft === 'tournament_registration' ||
            ft === 'rrpl_trials' ||
            bt.includes('rrpl') ||
            bt.includes('cup') ||
            bt.includes('tournament') ||
            bt.includes('league') ||
            bt.includes('championship') ||
            bt.includes('late arun yadav') ||
            bt.includes('ram sports cup')
        );

        // 2. STRICT SLOT CHECK: Net practice, turf pitch, and match slots (including custom slots created by Admin)
        const allSlotsList = data.slots || [];
        const isKnownSlot = allSlotsList.some(s => s.title && (
            s.title.toLowerCase().trim() === bt ||
            bt.includes(s.title.toLowerCase().trim()) ||
            s.title.toLowerCase().trim().includes(bt)
        ));

        const isExplicitSlot = !isTournament && (
            ft.includes('slot') ||
            ft.includes('ground') ||
            isKnownSlot ||
            bt.includes('net practice') ||
            bt.includes('match slot') ||
            bt.includes('practice slot') ||
            bt.includes('turf slot') ||
            bt.includes('bowling machine') ||
            bt.includes('floodlight') ||
            bt.includes('simulation') ||
            bt.includes('wicket') ||
            bt.includes('speed camp') ||
            bt.includes('masterclass')
        );

        // 3. NEW JOINY / ADMISSION CHECK (Under-14, Under-16, Under-19 Academy Admissions)
        const isNewJoiny = !isTournament && !isExplicitSlot && (
            ft === 'academy_admission' ||
            bt.includes('admission') ||
            cat.includes('under-14') || cat.includes('under-16') || cat.includes('under-19') || cat.includes('u-14') || cat.includes('u-16') || cat.includes('u-19')
        );

        // Dynamic Form Field Extraction: capture any extra fields into formData JSON
        const standardKeys = new Set([
            'id', 'name', 'fatherName', 'age', 'phone', 'email', 'city', 'role',
            'category', 'dob', 'utrNumber', 'feeAmount', 'paymentStatus', 'battingStyle', 'bowlingStyle',
            'totalPersons', 'bookingType', 'slotDate', 'timeSlot', 'facilityType',
            'formType', 'status', 'createdAt', 'remarks', 'formData'
        ]);
        const customFormData = { ...(bookingInput.formData || {}) };
        for (const [k, v] of Object.entries(bookingInput)) {
            if (!standardKeys.has(k) && v !== undefined && v !== null && v !== '') {
                customFormData[k] = v;
            }
        }

        // 100% Unique Collision-Free Registration ID across any device worldwide
        const timeKey = Date.now().toString(36).toUpperCase();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        
        let autoIdPrefix = 'RCA-SLOT';
        if (isTournament) {
            autoIdPrefix = bt.includes('rrpl') ? 'RCA-RRPL' : 'RCA-TRN';
        } else if (isNewJoiny) {
            autoIdPrefix = 'RCA-ADM';
        }
        const autoId = `${autoIdPrefix}-${timeKey}-${randNum}`;

        // If it is a slot booking, category MUST BE empty! Never assign Under-16 to slot bookings!
        const categoryVal = isExplicitSlot 
            ? "" 
            : (bookingInput.category || customFormData.category || (isNewJoiny ? "Under-16" : (isTournament ? (bookingInput.totalPersons || "Open") : "")));
            
        const dobVal = bookingInput.dob || customFormData.dob || "";
        const utrVal = bookingInput.utrNumber || customFormData.utrNumber || "";
        const currentAdmFee = String(this.getAdmissionFee ? this.getAdmissionFee() : 1499);
        const feeVal = isExplicitSlot 
            ? (bookingInput.feeAmount || customFormData.feeAmount || "") 
            : (bookingInput.feeAmount || customFormData.feeAmount || (isNewJoiny ? currentAdmFee : (isTournament && bt.includes('rrpl') ? currentAdmFee : "")));
        const battingVal = bookingInput.battingStyle || customFormData.battingStyle || "";
        const bowlingVal = bookingInput.bowlingStyle || customFormData.bowlingStyle || "";

        let finalFormType = bookingInput.formType;
        if (!finalFormType) {
            if (isTournament) finalFormType = bt.includes('rrpl') ? 'rrpl_trials' : 'tournament_registration';
            else if (isNewJoiny) finalFormType = 'academy_admission';
            else finalFormType = 'slot_booking';
        }

        const newBooking = {
            id: bookingInput.id || autoId,
            name: bookingInput.name || "Anonymous",
            fatherName: bookingInput.fatherName || customFormData.fatherName || "-",
            age: bookingInput.age ? (parseInt(bookingInput.age) || bookingInput.age) : "-",
            category: categoryVal,
            dob: dobVal,
            utrNumber: utrVal,
            feeAmount: feeVal,
            paymentStatus: bookingInput.paymentStatus || (utrVal ? "Pending Verification" : "New"),
            battingStyle: battingVal,
            bowlingStyle: bowlingVal,
            phone: bookingInput.phone || "",
            email: bookingInput.email || "",
            city: bookingInput.city || "Vrindavan",
            role: bookingInput.role || (isExplicitSlot ? "Player / Team" : "All-Rounder"),
            totalPersons: bookingInput.totalPersons || (categoryVal ? categoryVal : "1 Player"),
            bookingType: bookingInput.bookingType || (isNewJoiny ? `RCA Admission (${categoryVal})` : "Practice Slot"),
            formType: finalFormType,
            slotDate: bookingInput.slotDate || new Date().toISOString().split('T')[0],
            timeSlot: bookingInput.timeSlot || (isNewJoiny ? "Morning Batch (06:30 AM - 08:30 AM)" : "Flexible Time"),
            facilityType: bookingInput.facilityType || (isNewJoiny ? "Match Turf Pitch (RCA Vrindavan)" : "Turf Grounds"),
            status: bookingInput.status || (utrVal ? "Pending Verification" : "New"),
            createdAt: bookingInput.createdAt || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            remarks: bookingInput.remarks || "",
            formData: {
                ...customFormData,
                category: categoryVal,
                dob: dobVal,
                utrNumber: utrVal,
                feeAmount: feeVal,
                fatherName: bookingInput.fatherName || "-",
                battingStyle: battingVal,
                bowlingStyle: bowlingVal
            }
        };

        data.bookings.unshift(newBooking);
        this.saveRawData(data);

        // Sync to Supabase Cloud Database immediately
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertBooking(newBooking).then(res => {
                if (res) console.log("✅ [RCA Cloud] Booking saved to Supabase:", newBooking.id);
            }).catch(e => console.warn("[RCA Cloud] Notice:", e));
        }

        // Auto Sync with Google Sheets if Webhook is configured (creates separate tab)
        this.syncToGoogleSheet(newBooking);

        // Directly send background email alert to RCA admin (rcaacademy9897@gmail.com)
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

    // Google Sheets Auto-Sync (Separates New Joiny vs Tournament Registrations vs Slot Bookings into 3 distinct tabs)
    syncToGoogleSheet(booking) {
        const settings = this.getSettings();
        if (!settings.googleSheetWebhookUrl) return;

        try {
            const ft = (booking.formType || '').toLowerCase();
            const bt = (booking.bookingType || '').toLowerCase();
            const cat = (booking.category || '').toLowerCase();

            const isTournament = (
                ft === 'tournament_registration' ||
                ft === 'rrpl_trials' ||
                bt.includes('rrpl') ||
                bt.includes('cup') ||
                bt.includes('tournament') ||
                bt.includes('league') ||
                bt.includes('championship') ||
                bt.includes('late arun yadav') ||
                bt.includes('ram sports cup')
            );

            const allSlots = (this.getRawData() || {}).slots || [];
            const isKnownSlot = allSlots.some(s => s.title && (
                s.title.toLowerCase().trim() === bt ||
                bt.includes(s.title.toLowerCase().trim()) ||
                s.title.toLowerCase().trim().includes(bt)
            ));

            const isExplicitSlot = !isTournament && (
                ft.includes('slot') ||
                ft.includes('ground') ||
                isKnownSlot ||
                bt.includes('net practice') ||
                bt.includes('match slot') ||
                bt.includes('practice slot') ||
                bt.includes('turf slot') ||
                bt.includes('bowling machine') ||
                bt.includes('floodlight') ||
                bt.includes('simulation') ||
                bt.includes('wicket') ||
                bt.includes('speed camp') ||
                bt.includes('masterclass')
            );

            const isNewJoiny = !isTournament && !isExplicitSlot && (
                ft === 'academy_admission' ||
                bt.includes('admission') ||
                cat.includes('under-14') || cat.includes('under-16') || cat.includes('under-19') || cat.includes('u-14') || cat.includes('u-16') || cat.includes('u-19')
            );

            let targetTab = "Slot Bookings";
            if (isTournament) {
                targetTab = "Tournament Registrations";
            } else if (isNewJoiny) {
                targetTab = "New Joiny Admissions";
            }

            const payload = {
                sheetTab: targetTab,
                isTournament: isTournament,
                isNewJoiny: isNewJoiny,
                isSlot: isExplicitSlot,
                bookingId: booking.id,
                id: booking.id,
                timestamp: booking.createdAt,
                name: booking.name,
                phone: booking.phone,
                email: booking.email || "",
                category: booking.category || (booking.formData && booking.formData.category) || (isNewJoiny ? "Under-16" : (isTournament ? "Tournament Entry" : "")),
                dob: booking.dob || (booking.formData && booking.formData.dob) || "",
                age: booking.age || (booking.formData && booking.formData.age) || "-",
                fatherName: booking.fatherName || (booking.formData && booking.formData.fatherName) || "-",
                role: booking.role || "All-Rounder",
                battingStyle: booking.battingStyle || (booking.formData && booking.formData.battingStyle) || "-",
                bowlingStyle: booking.bowlingStyle || (booking.formData && booking.formData.bowlingStyle) || "-",
                feeAmount: booking.feeAmount || (booking.formData && booking.formData.feeAmount) || (isNewJoiny || (isTournament && bt.includes('rrpl')) ? "1499" : ""),
                utrNumber: booking.utrNumber || (booking.formData && booking.formData.utrNumber) || "",
                city: booking.city || "Vrindavan",
                bookingType: booking.bookingType,
                formType: booking.formType || (isTournament ? 'tournament_registration' : (isNewJoiny ? 'academy_admission' : 'slot_booking')),
                slotDate: booking.slotDate || "-",
                timeSlot: booking.timeSlot || "-",
                facilityType: booking.facilityType || "Turf Pitch",
                totalPersons: booking.totalPersons || "1",
                status: booking.status || "Pending Verification",
                remarks: booking.remarks || "",
                customFields: JSON.stringify(booking.formData || {})
            };

            // Flatten custom form data into top-level properties
            if (booking.formData && typeof booking.formData === 'object') {
                for (const [key, val] of Object.entries(booking.formData)) {
                    if (val !== undefined && val !== null && val !== '') {
                        payload[`custom_${key}`] = val;
                    }
                }
            }

            fetch(settings.googleSheetWebhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then(() => {
                console.log("✅ [Google Sheet] Row synced to:", payload.sheetTab);
            }).catch(e => console.warn("Google Sheet sync notice:", e));
        } catch (err) {
            console.warn("Google Sheet sync error:", err);
        }
    }

    // Direct background email dispatch to RCA admin (rcaacademy9897@gmail.com)
    sendAdminEmailAlert(booking) {
        const settings = this.getSettings();
        const adminEmail = (settings.adminNotifyEmail || "rcaacademy9897@gmail.com").toLowerCase().trim();
        try {
            const ft = (booking.formType || '').toLowerCase();
            const bt = (booking.bookingType || '').toLowerCase();
            const cat = (booking.category || '').toLowerCase();

            const isTournament = (
                ft === 'tournament_registration' ||
                ft === 'rrpl_trials' ||
                bt.includes('rrpl') ||
                bt.includes('cup') ||
                bt.includes('tournament') ||
                bt.includes('league') ||
                bt.includes('championship') ||
                bt.includes('late arun yadav') ||
                bt.includes('ram sports cup')
            );

            const allSlots = (this.getRawData() || {}).slots || [];
            const isKnownSlot = allSlots.some(s => s.title && (
                s.title.toLowerCase().trim() === bt ||
                bt.includes(s.title.toLowerCase().trim()) ||
                s.title.toLowerCase().trim().includes(bt)
            ));

            const isExplicitSlot = !isTournament && (
                ft.includes('slot') ||
                ft.includes('ground') ||
                isKnownSlot ||
                bt.includes('net practice') ||
                bt.includes('match slot') ||
                bt.includes('practice slot') ||
                bt.includes('turf slot') ||
                bt.includes('bowling machine') ||
                bt.includes('floodlight') ||
                bt.includes('simulation') ||
                bt.includes('wicket') ||
                bt.includes('speed camp') ||
                bt.includes('masterclass')
            );

            const isNewJoiny = !isTournament && !isExplicitSlot && (
                ft === 'academy_admission' ||
                bt.includes('admission') ||
                cat.includes('under-14') || cat.includes('under-16') || cat.includes('under-19') || cat.includes('u-14') || cat.includes('u-16') || cat.includes('u-19')
            );

            let subject = `📅 [New RCA Slot Booking] ${booking.name} - ${booking.slotDate} (${booking.timeSlot})`;
            let submissionType = "TURF / GROUND SLOT BOOKING";

            if (isTournament) {
                subject = `🏆 [New RCA Tournament Entry] ${booking.bookingType || 'Tournament'} - ${booking.name} (UTR: ${booking.utrNumber || 'Pending'})`;
                submissionType = "TOURNAMENT / LEAGUE ENTRY";
            } else if (isNewJoiny) {
                subject = `🏏 [New RCA Admission] ${booking.category || 'Admission'} - ${booking.name} (UTR: ${booking.utrNumber || 'Pending'})`;
                submissionType = "NEW PLAYER ADMISSION (ACADEMY)";
            }

            const emailPayload = {
                _subject: subject,
                _template: "table",
                _captcha: "false",
                Type: submissionType,
                Registration_ID: booking.id,
                Category: booking.category || (isNewJoiny ? "Under-16" : (isTournament ? (booking.totalPersons || "Tournament Entry") : "-")),
                Player_Name: booking.name,
                Age: String(booking.age || "-"),
                Date_Of_Birth: booking.dob || "-",
                Father_Name: booking.fatherName || "-",
                Phone_Number: booking.phone,
                City: booking.city || "Vrindavan",
                Tournament_Or_Program: booking.bookingType,
                Playing_Role: booking.role || "All-Rounder",
                Batting_Style: booking.battingStyle || (booking.formData && booking.formData.battingStyle) || "-",
                Bowling_Style: booking.bowlingStyle || (booking.formData && booking.formData.bowlingStyle) || "-",
                Registration_Fee: booking.feeAmount ? `₹${booking.feeAmount}` : (isNewJoiny || (isTournament && bt.includes('rrpl')) ? "₹1,499" : "Slot Rate"),
                UPI_UTR_Number: booking.utrNumber || "Pending / Not Provided",
                Status: booking.status || "Pending Verification",
                Preferred_Date: booking.slotDate || "-",
                Preferred_Time: booking.timeSlot || "-",
                Turf_Facility: booking.facilityType || "Turf Grounds",
                Total_Persons: booking.totalPersons || "1",
                Academy_Ground: "RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)",
                Head_Coach: "Coach R.K. Chauhan (+91 9897517704)",
                Submitted_At: booking.createdAt
            };

            // Direct fetch to FormSubmit
            fetch(`https://formsubmit.co/ajax/${adminEmail}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(emailPayload)
            }).then(r => r.json()).then(res => {
                console.log("[RCA Alert] FormSubmit email sent:", res);
            }).catch(e => console.warn("[RCA Alert] FormSubmit notice:", e));

            // Note: Google Apps Script Webhook automatically sends 100% guaranteed email via MailApp.sendEmail!
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

    // -------------------------------------------------------------------------
    // COMMITTEE MEMBERS (President, Owner, CEO, Coaches, Advisory)
    // -------------------------------------------------------------------------
    getCommittee() {
        const data = this.getRawData();
        const list = (data && data.committee && data.committee.length > 0) ? data.committee : DEFAULT_COMMITTEE;
        return [...list].sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
    }

    getCommitteeMember(id) {
        const list = this.getCommittee();
        return list.find(m => m.id === id) || null;
    }

    addCommitteeMember(member) {
        const data = this.getRawData();
        if (!data) return null;
        if (!data.committee) data.committee = [];

        const newMember = {
            id: member.id || `comm-${Date.now()}`,
            name: member.name || "Committee Member",
            designation: member.designation || "Executive Member",
            photo: member.photo || "assets/images/logo.png",
            bio: member.bio || "",
            order: parseInt(member.order) || (data.committee.length + 1)
        };

        data.committee.push(newMember);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertCommitteeMember(newMember).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'committee_add' } }));
        return newMember;
    }

    updateCommitteeMember(id, updatedFields) {
        const data = this.getRawData();
        if (!data || !data.committee) return null;

        const idx = data.committee.findIndex(m => m.id === id);
        if (idx === -1) return null;

        data.committee[idx] = {
            ...data.committee[idx],
            ...updatedFields,
            order: updatedFields.order !== undefined ? parseInt(updatedFields.order) : data.committee[idx].order
        };

        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateCommitteeMember(id, data.committee[idx]).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'committee_update' } }));
        return data.committee[idx];
    }

    deleteCommitteeMember(id) {
        const data = this.getRawData();
        if (!data || !data.committee) return false;

        data.committee = data.committee.filter(m => m.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteCommitteeMember(id).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'committee_delete' } }));
        return true;
    }

    // -------------------------------------------------------------------------
    // SPONSORSHIPS & PARTNERS
    // -------------------------------------------------------------------------
    getSponsors() {
        const data = this.getRawData();
        const list = (data && data.sponsors && data.sponsors.length > 0) ? data.sponsors : DEFAULT_SPONSORS;
        return [...list].sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
    }

    getSponsor(id) {
        const list = this.getSponsors();
        return list.find(s => s.id === id) || null;
    }

    addSponsor(sponsor) {
        const data = this.getRawData();
        if (!data) return null;
        if (!data.sponsors) data.sponsors = [];

        const newSponsor = {
            id: sponsor.id || `spon-${Date.now()}`,
            name: sponsor.name || "Official Partner",
            designation: sponsor.designation || "Official Sponsor",
            city: sponsor.city || "Vrindavan / Mathura",
            shortInfo: sponsor.shortInfo || "",
            logo: sponsor.logo || "assets/images/logo.png",
            order: parseInt(sponsor.order) || (data.sponsors.length + 1)
        };

        data.sponsors.push(newSponsor);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.insertSponsor(newSponsor).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'sponsor_add' } }));
        return newSponsor;
    }

    updateSponsor(id, updatedFields) {
        const data = this.getRawData();
        if (!data || !data.sponsors) return null;

        const idx = data.sponsors.findIndex(s => s.id === id);
        if (idx === -1) return null;

        data.sponsors[idx] = {
            ...data.sponsors[idx],
            ...updatedFields,
            order: updatedFields.order !== undefined ? parseInt(updatedFields.order) : data.sponsors[idx].order
        };

        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSponsor(id, data.sponsors[idx]).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'sponsor_update' } }));
        return data.sponsors[idx];
    }

    deleteSponsor(id) {
        const data = this.getRawData();
        if (!data || !data.sponsors) return false;

        data.sponsors = data.sponsors.filter(s => s.id !== id);
        this.saveRawData(data);

        // Sync to Supabase
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.deleteSponsor(id).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'sponsor_delete' } }));
        return true;
    }

    // -------------------------------------------------------------------------
    // ABOUT COACH R.K. CHAUHAN PROFILE
    // -------------------------------------------------------------------------
    getAboutProfile() {
        const settings = this.getSettings();
        return {
            headCoach: settings.headCoach || "Coach R.K. Chauhan",
            title: settings.aboutTitle || "Founder, Senior Mentor & Biomechanics Specialist",
            bio: settings.aboutBio || DEFAULT_SETTINGS.aboutBio,
            quote: settings.aboutQuote || DEFAULT_SETTINGS.aboutQuote,
            yearsExp: settings.aboutYearsExp || "8+",
            phone: settings.phone || "9897517704",
            instagramUrl: settings.instagramUrl || DEFAULT_SETTINGS.instagramUrl
        };
    }

    updateAboutProfile(profile) {
        const data = this.getRawData();
        if (!data) return false;
        if (!data.settings) data.settings = {};

        if (profile.headCoach) data.settings.headCoach = profile.headCoach;
        if (profile.title) data.settings.aboutTitle = profile.title;
        if (profile.bio) data.settings.aboutBio = profile.bio;
        if (profile.quote) data.settings.aboutQuote = profile.quote;
        if (profile.yearsExp) data.settings.aboutYearsExp = profile.yearsExp;
        if (profile.phone) data.settings.phone = profile.phone;
        if (profile.instagramUrl) data.settings.instagramUrl = profile.instagramUrl;

        this.saveRawData(data);

        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            window.rcaSupabase.updateSettings({
                headCoach: data.settings.headCoach,
                aboutTitle: data.settings.aboutTitle,
                aboutBio: data.settings.aboutBio,
                aboutQuote: data.settings.aboutQuote,
                aboutYearsExp: data.settings.aboutYearsExp,
                phone: data.settings.phone,
                instagramUrl: data.settings.instagramUrl
            }).catch(e => console.warn(e));
        }

        window.dispatchEvent(new CustomEvent('rcaDataUpdated', { detail: { source: 'about_profile_update' } }));
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
            `Ground Venue: RCA Ground, Panigaon Raya Road, Vrindavan (Mathura).\n` +
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
    exportNewJoinyToCsv() {
        const bookings = this.getBookings().filter(b => 
            b.formType === 'academy_admission' ||
            b.formType === 'rrpl_trials' ||
            Boolean(b.category) ||
            (b.bookingType && (b.bookingType.includes('RRPL') || b.bookingType.includes('Under') || b.bookingType.includes('Admission')))
        );
        if (!bookings.length) return null;

        const headers = ["Reg ID", "Category", "Player Name", "DOB", "Age", "Father Name", "Phone", "City", "Playing Role", "Batting Style", "Bowling Style", "Fee (INR)", "Payment UTR", "Status", "Registered At", "Remarks"];
        const rows = bookings.map(b => [
            b.id,
            `"${b.category || 'Under-16'}"`,
            `"${(b.name || '').replace(/"/g, '""')}"`,
            `"${b.dob || '-'}"`,
            `"${b.age || '-'}"`,
            `"${(b.fatherName || '-').replace(/"/g, '""')}"`,
            `"${b.phone}"`,
            `"${b.city || 'Vrindavan'}"`,
            `"${b.role || 'All-Rounder'}"`,
            `"${b.battingStyle || (b.formData && b.formData.battingStyle) || '-'}"`,
            `"${b.bowlingStyle || (b.formData && b.formData.bowlingStyle) || '-'}"`,
            `"${b.feeAmount || 1499}"`,
            `"${b.utrNumber || '-'}"`,
            b.status,
            `"${b.createdAt}"`,
            `"${(b.remarks || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    exportSlotBookingsToCsv() {
        const bookings = this.getBookings().filter(b => 
            !(b.formType === 'academy_admission' ||
              b.formType === 'rrpl_trials' ||
              Boolean(b.category) ||
              (b.bookingType && (b.bookingType.includes('RRPL') || b.bookingType.includes('Under') || b.bookingType.includes('Admission'))))
        );
        if (!bookings.length) return null;

        const headers = ["Booking ID", "Customer Name", "Phone", "Email", "City", "Facility", "Date", "Slot Time", "Total Persons", "Status", "Registered At", "Remarks"];
        const rows = bookings.map(b => [
            b.id,
            `"${(b.name || '').replace(/"/g, '""')}"`,
            `"${b.phone}"`,
            `"${b.email || '-'}"`,
            `"${b.city || 'Vrindavan'}"`,
            `"${b.facilityType || 'Turf Pitch'}"`,
            b.slotDate,
            `"${b.timeSlot}"`,
            `"${b.totalPersons || '1 Player'}"`,
            b.status,
            `"${b.createdAt}"`,
            `"${(b.remarks || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

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
