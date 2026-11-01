/**
 * RCA (RAM CRICKET ACADEMY) - Admin Dashboard Controller
 * Handles Admin authentication, real-time table rendering, tournament management (add/delete posters & details),
 * slot availability (Available ↔ Sold Out toggles), Google Sheets Webhook sync,
 * announcements, gallery, settings updates, and CSV/Excel export.
 */

let currentFilter = 'All';
let currentSearch = '';

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();

    // Re-render when Supabase Cloud sync finishes
    window.addEventListener('rcaDataUpdated', () => {
        if (sessionStorage.getItem('rca_admin_logged_in') === 'true') {
            updateMetrics();
            renderNewJoinyTable();
            renderTournamentRegsTable();
            renderBookingsTable();
            renderAdminTournaments();
            renderAdminPersonTiers();
            renderAdminSlots();
            renderAdminGallery();
            renderAdminNotices();
            renderAdminBookingTypes();
            renderAdminCommittee();
            renderAdminSponsors();
            renderAdminAboutProfile();
            loadSettingsIntoForm();
            loadSupabaseSettings();
        }
    });

    // Attach real-time 10-digit mobile number validation to walk-in modal
    attachPhoneInputValidator('manPhone', 'manPhoneError');
});

// Admin Security & Cryptographic SHA-256 Authentication
// Strictly locked to the official Academy Administrator Email: RCAACADEMY9897@gmail.com
const OFFICIAL_ADMIN_EMAIL = "rcaacademy9897@gmail.com";

async function computeSha256(str) {
    if (window.crypto && crypto.subtle) {
        const buffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

// Admin Authentication Check
function checkAdminAuth() {
    const isAuth = sessionStorage.getItem('rca_admin_logged_in');
    const authScreen = document.getElementById('authScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');

    if (isAuth === 'true') {
        authScreen.style.display = 'none';
        dashboardScreen.style.display = 'flex';
        initDashboard();
    } else {
        authScreen.style.display = 'flex';
        dashboardScreen.style.display = 'none';
    }
}

// Handle Admin Login (Strictly verifies against Supabase database credentials)
async function handleAdminLogin(event) {
    event.preventDefault();
    const statusMsg = document.getElementById('loginStatusMsg');
    const submitBtn = document.getElementById('adminLoginBtn') || (event.target ? event.target.querySelector('button[type="submit"]') : null);

    function showStatus(type, title, message) {
        if (!statusMsg) return;
        statusMsg.style.display = 'block';
        if (type === 'loading') {
            statusMsg.style.background = 'rgba(245, 158, 11, 0.15)';
            statusMsg.style.border = '1px solid #f59e0b';
            statusMsg.style.color = '#fde68a';
            statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <strong>${title}:</strong> ${message}`;
        } else if (type === 'error') {
            statusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
            statusMsg.style.border = '1px solid #ef4444';
            statusMsg.style.color = '#fca5a5';
            statusMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>${title}:</strong> ${message}`;
        } else if (type === 'success') {
            statusMsg.style.background = 'rgba(16, 185, 129, 0.15)';
            statusMsg.style.border = '1px solid #10b981';
            statusMsg.style.color = '#6ee7b7';
            statusMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>${title}:</strong> ${message}`;
        }
    }

    const rawUser = (document.getElementById('adminUser').value || '').trim();
    const pass = (document.getElementById('adminPass').value || '');
    const email = rawUser.toLowerCase();

    // 1. Strict Email Verification: Only official RCA administrator email allowed
    if (email !== OFFICIAL_ADMIN_EMAIL && email !== 'rcaacademy9897') {
        const errText = "Only the official RCA Administrator Email (" + OFFICIAL_ADMIN_EMAIL + ") is authorized to log in.";
        showStatus('error', 'Access Denied', errText);
        alert("Access Denied!\n\n" + errText);
        return;
    }

    if (!pass || pass.trim().length === 0) {
        const errText = "Please enter your admin password.";
        showStatus('error', 'Required Field', errText);
        alert(errText);
        return;
    }

    // Set Loading State
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying Credentials...';
    }
    showStatus('loading', 'Connecting', 'Verifying credentials with Supabase Cloud...');

    try {
        // Attempt to ensure Supabase client is initialized
        if (!window.rcaSupabase || !window.rcaSupabase.isConfigured()) {
            if (window.rcaSupabase && typeof window.rcaSupabase.initClient === 'function') {
                window.rcaSupabase.initClient();
            }
        }

        // 2. Authenticate directly against Supabase Cloud Database (Native Auth or Database RPC)
        if (window.rcaSupabase && window.rcaSupabase.isConfigured() && window.rcaSupabase.client) {
            // A. Check Supabase Native Auth
            if (window.rcaSupabase.client.auth) {
                const { data: authData, error: authErr } = await window.rcaSupabase.client.auth.signInWithPassword({
                    email: OFFICIAL_ADMIN_EMAIL,
                    password: pass
                });

                if (!authErr && authData && authData.user) {
                    showStatus('success', 'Authenticated', 'Login successful! Opening dashboard...');
                    sessionStorage.setItem('rca_admin_logged_in', 'true');
                    sessionStorage.setItem('rca_admin_token', authData.session.access_token);
                    sessionStorage.setItem('rca_admin_email', OFFICIAL_ADMIN_EMAIL);
                    localStorage.removeItem('RCA_ADMIN_HASH');
                    setTimeout(() => {
                        checkAdminAuth();
                        if (window.rcaDB) window.rcaDB.syncFromSupabase();
                    }, 400);
                    return;
                }
            }

            // B. Check Supabase Database RPC
            const passHash = await computeSha256(pass);
            const { data: rpcRes, error: rpcErr } = await window.rcaSupabase.client.rpc('rca_verify_admin_login', {
                p_email: OFFICIAL_ADMIN_EMAIL,
                p_password_hash: passHash
            });

            if (!rpcErr && rpcRes && rpcRes.success) {
                showStatus('success', 'Authenticated', 'Login successful! Opening dashboard...');
                sessionStorage.setItem('rca_admin_logged_in', 'true');
                sessionStorage.setItem('rca_admin_token', passHash);
                sessionStorage.setItem('rca_admin_email', OFFICIAL_ADMIN_EMAIL);
                localStorage.removeItem('RCA_ADMIN_HASH');
                setTimeout(() => {
                    checkAdminAuth();
                    if (window.rcaDB) window.rcaDB.syncFromSupabase();
                }, 400);
                return;
            } else if (rpcRes && rpcRes.success === false) {
                showStatus('error', 'Invalid Password', rpcRes.message || "Invalid Password! Access restricted to authorized database administrator.");
                alert(rpcRes.message || "Invalid Password! Access restricted to authorized database administrator.");
                return;
            }
        }

        // Strictly Denied: Invalid credentials
        const detailMsg = "Aapka enter kiya gaya password Supabase database se match nahi hua.<br><span style='font-size:0.8rem; opacity:0.9; display:block; margin-top:6px;'>Supabase Dashboard me jakar <strong>Authentication → Users</strong> me 'rcaacademy9897@gmail.com' ko aapke password ke sath add karein.</span>";
        showStatus('error', 'Invalid Credentials', detailMsg);
        alert("Invalid Email or Password!\n\nPlease enter the correct administrator password created for your Supabase database.");
    } catch (err) {
        console.error("Login process note:", err);
        showStatus('error', 'Connection Error', "Supabase server connection failed: " + (err.message || "Please check internet"));
        alert("Error connecting to Supabase: " + (err.message || "Please check internet"));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login to Dashboard';
        }
    }
}

// Handle Admin Logout
function handleAdminLogout() {
    if (window.rcaSupabase && window.rcaSupabase.client && window.rcaSupabase.client.auth) {
        try { window.rcaSupabase.client.auth.signOut(); } catch (e) {}
    }
    sessionStorage.removeItem('rca_admin_logged_in');
    sessionStorage.removeItem('rca_admin_token');
    sessionStorage.removeItem('rca_admin_email');
    localStorage.removeItem('RCA_ADMIN_HASH');
    checkAdminAuth();
}

// Initialize Dashboard Views & Data
function initDashboard() {
    // Ensure all search inputs start clean without autofill artifacts
    ['bookingSearchInput', 'newJoinySearchInput', 'tournamentSearchInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentSearch = '';
    currentNewJoinySearch = '';
    currentTournamentSearch = '';

    updateMetrics();
    renderNewJoinyTable();
    renderBookingsTable();
    renderTournamentRegsTable();
    renderAdminTournaments();
    renderAdminPersonTiers();
    renderAdminSlots();
    renderAdminGallery();
    renderAdminNotices();
    renderAdminBookingTypes();
    renderAdminCommittee();
    renderAdminSponsors();
    renderAdminAboutProfile();
    loadSettingsIntoForm();
    loadSupabaseSettings();

    // Default dates for modals & notices
    const today = new Date().toISOString().split('T')[0];
    const manDate = document.getElementById('manDate');
    const noticeDate = document.getElementById('noticeDate');
    if (manDate) manDate.value = today;
    if (noticeDate) noticeDate.value = today;

    // Trigger immediate background sync with Supabase Cloud
    if (window.rcaDB) {
        window.rcaDB.syncFromSupabase();
    }

    // Auto-poll new bookings every 15 seconds
    if (!window.rcaAdminSyncTimer) {
        window.rcaAdminSyncTimer = setInterval(() => {
            if (sessionStorage.getItem('rca_admin_logged_in') === 'true' && window.rcaDB) {
                window.rcaDB.syncFromSupabase();
            }
        }, 15000);
    }
}

// Manual Cloud Sync Trigger for Admin
async function manualAdminSync() {
    const syncBtn = document.getElementById('topbarSyncBtn');
    if (syncBtn) {
        syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
    }
    if (window.rcaDB) {
        await window.rcaDB.syncFromSupabase();
    }
    if (syncBtn) {
        syncBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Cloud';
    }
}

// Mobile Sidebar Drawer Control
function toggleAdminSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) {
        sidebar.classList.toggle('show-mobile');
    }
    if (backdrop) {
        backdrop.classList.toggle('show');
    }
}

function closeAdminSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) {
        sidebar.classList.remove('show-mobile');
    }
    if (backdrop) {
        backdrop.classList.remove('show');
    }
}

// Switch Sidebar & Bottom Nav View
function switchView(viewId, element) {
    document.querySelectorAll('.admin-view-panel').forEach(panel => {
        panel.classList.remove('active-view');
    });

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.bnav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active-view');
    }

    // Synchronize both desktop sidebar menu item and mobile bottom nav item
    document.querySelectorAll(`.menu-item[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));
    document.querySelectorAll(`.bnav-item[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));

    if (element && !element.getAttribute('data-view')) {
        element.classList.add('active');
    }

    const titleMap = {
        newJoinyView: "New Joiny & Academy Admissions 2026",
        tournamentRegsView: "Tournament & Cup Registrations",
        bookingsView: "Slot & Ground Bookings",
        tournamentsView: "Tournaments & Leagues Manager",
        slotsView: "Slots & Sold Out Availability",
        galleryView: "Photo Showcase Manager",
        noticesView: "Announcements & Notices",
        aboutView: "About, Management Committee & Sponsorships",
        settingsView: "Settings & Google Sheet"
    };

    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle && titleMap[viewId]) {
        topbarTitle.textContent = titleMap[viewId];
    }

    // Clear search boxes & state so autofill never corrupts table views
    ['bookingSearchInput', 'newJoinySearchInput', 'tournamentSearchInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentSearch = '';
    currentNewJoinySearch = '';
    currentTournamentSearch = '';

    // View-specific data rendering
    if (viewId === 'newJoinyView') {
        renderNewJoinyTable();
    } else if (viewId === 'tournamentRegsView') {
        renderTournamentRegsTable();
    } else if (viewId === 'bookingsView') {
        renderBookingsTable();
    } else if (viewId === 'tournamentsView') {
        renderAdminTournaments();
    } else if (viewId === 'slotsView') {
        renderAdminPersonTiers();
        renderAdminSlots();
    } else if (viewId === 'aboutView') {
        renderAdminCommittee();
        renderAdminSponsors();
        renderAdminAboutProfile();
    }

    // Close mobile drawer on navigation
    closeAdminSidebar();

    // Scroll to top of main view smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -----------------------------------------------------------------------------
// THREE-WAY REGISTRATION CLASSIFIERS (MUTUALLY EXCLUSIVE & CLEAN)
// -----------------------------------------------------------------------------

// 1. Tournament Bookings (RRPL 2026, RAM SPORTS CUP, & Cup Entries)
function isTournamentBooking(b) {
    if (!b) return false;
    const ft = (b.formType || '').toLowerCase();
    const bt = (b.bookingType || '').toLowerCase();

    if (ft === 'tournament_registration' || ft === 'rrpl_trials') return true;

    if (
        bt.includes('rrpl') ||
        bt.includes('cup') ||
        bt.includes('tournament') ||
        bt.includes('league') ||
        bt.includes('championship') ||
        bt.includes('late arun yadav') ||
        bt.includes('ram sports cup')
    ) {
        return true;
    }

    return false;
}

// 2. New Joiny / Academy Admissions (Under-14, Under-16, Under-19 Trainees)
function isNewJoinyBooking(b) {
    if (!b) return false;
    if (isTournamentBooking(b)) return false;

    const ft = (b.formType || '').toLowerCase();
    const bt = (b.bookingType || '').toLowerCase();
    const cat = (b.category || '').toLowerCase();

    const allSlots = window.rcaDB ? window.rcaDB.getSlots() : [];
    const isKnownSlot = allSlots.some(s => s.title && (
        s.title.toLowerCase().trim() === bt ||
        bt.includes(s.title.toLowerCase().trim()) ||
        s.title.toLowerCase().trim().includes(bt)
    ));

    // Explicit slot bookings are NEVER New Joiny
    if (
        ft.includes('slot') ||
        ft.includes('ground') ||
        isKnownSlot ||
        bt.includes('net practice') ||
        bt.includes('match slot') ||
        bt.includes('practice slot') ||
        bt.includes('turf slot') ||
        bt.includes('bowling machine') ||
        bt.includes('floodlight') ||
        bt.includes('custom turf') ||
        bt.includes('simulation') ||
        bt.includes('wicket') ||
        bt.includes('speed camp') ||
        bt.includes('masterclass')
    ) {
        return false;
    }

    if (ft === 'academy_admission' || bt.includes('admission')) {
        return true;
    }

    if (cat.includes('under-14') || cat.includes('under-16') || cat.includes('under-19') || cat.includes('u-14') || cat.includes('u-16') || cat.includes('u-19')) {
        return true;
    }

    return false;
}

// 3. Slot & Ground Bookings (Net practice, match slots, turf slots)
function isSlotBooking(b) {
    if (!b) return false;
    return !isTournamentBooking(b) && !isNewJoinyBooking(b);
}

// Clear Search Input helper for Admin inputs
function clearSearchInput(inputId, type) {
    const input = document.getElementById(inputId);
    if (input) input.value = '';
    if (type === 'slot') {
        currentSearch = '';
        renderBookingsTable();
    } else if (type === 'newJoiny') {
        currentNewJoinySearch = '';
        renderNewJoinyTable();
    } else if (type === 'tournament') {
        currentTournamentSearch = '';
        renderTournamentRegsTable();
    }
}

function updateMetrics() {
    const allBookings = window.rcaDB.getBookings();
    const tournaments = window.rcaDB.getTournaments();

    const joinies = allBookings.filter(isNewJoinyBooking);
    const tourneyRegs = allBookings.filter(isTournamentBooking);
    const slots = allBookings.filter(isSlotBooking);

    const totalJoiny = joinies.length;
    const totalTourneyRegs = tourneyRegs.length;
    const totalSlots = slots.length;

    const u14Count = joinies.filter(b => (b.category && b.category.includes('14')) || (b.bookingType && b.bookingType.includes('14'))).length;
    const u16Count = joinies.filter(b => (b.category && b.category.includes('16')) || (b.bookingType && b.bookingType.includes('16'))).length;
    const u19Count = joinies.filter(b => (b.category && b.category.includes('19')) || (b.bookingType && b.bookingType.includes('19'))).length;
    const pendingUtr = joinies.filter(b => b.status === 'Pending Verification' || b.status === 'New' || !b.utrNumber).length;
    const confirmedCount = allBookings.filter(b => b.status === 'Confirmed').length;

    // Revenue calculation
    let revenue = 0;
    allBookings.forEach(b => {
        const fee = parseInt(b.feeAmount) || (isNewJoinyBooking(b) ? 1499 : (isTournamentBooking(b) && (b.bookingType || '').includes('RRPL') ? 1499 : 0));
        revenue += fee;
    });

    // Update Top Overview Cards
    const statNewJoiny = document.getElementById('statNewJoiny');
    if (statNewJoiny) statNewJoiny.textContent = totalJoiny;

    const statTournamentRegs = document.getElementById('statTournamentRegs');
    if (statTournamentRegs) statTournamentRegs.textContent = totalTourneyRegs;

    const statSlotsCount = document.getElementById('statSlotsCount');
    if (statSlotsCount) statSlotsCount.textContent = totalSlots;

    const statConfirmed = document.getElementById('statConfirmed');
    if (statConfirmed) statConfirmed.textContent = confirmedCount;

    const statRevenue = document.getElementById('statAdmissionRevenue');
    if (statRevenue) statRevenue.textContent = `₹${revenue.toLocaleString('en-IN')}`;

    // Update Mini stats in New Joiny view
    const elTotal = document.getElementById('statNewJoinyTotal');
    if (elTotal) elTotal.textContent = totalJoiny;
    const elU14 = document.getElementById('statNewJoinyU14');
    if (elU14) elU14.textContent = u14Count;
    const elU16 = document.getElementById('statNewJoinyU16');
    if (elU16) elU16.textContent = u16Count;
    const elU19 = document.getElementById('statNewJoinyU19');
    if (elU19) elU19.textContent = u19Count;
    const elPending = document.getElementById('statNewJoinyPending');
    if (elPending) elPending.textContent = pendingUtr;

    // Badges
    const newJoinyBadge = document.getElementById('sidebarNewJoinyBadge');
    if (newJoinyBadge) newJoinyBadge.textContent = totalJoiny;

    const tournamentRegsBadge = document.getElementById('sidebarTournamentRegsBadge');
    if (tournamentRegsBadge) tournamentRegsBadge.textContent = totalTourneyRegs;

    const slotBadge = document.getElementById('sidebarBookingBadge');
    if (slotBadge) slotBadge.textContent = totalSlots;

    const tourBadge = document.getElementById('sidebarTournamentsBadge');
    if (tourBadge) tourBadge.textContent = tournaments.length;
}

// -----------------------------------------------------------------------------
// VIEW 1: NEW JOINY & ACADEMY ADMISSIONS MANAGER
// -----------------------------------------------------------------------------
let currentNewJoinyCategoryFilter = 'All';
let currentNewJoinySearch = '';

function handleNewJoinySearch() {
    const input = document.getElementById('newJoinySearchInput');
    if (input) {
        let val = input.value.trim();
        if (val.includes('@') || /rcaacademy/i.test(val)) {
            val = '';
            input.value = '';
        }
        currentNewJoinySearch = val;
        renderNewJoinyTable();
    }
}

function filterNewJoinyTable(filterCategory, element) {
    currentNewJoinyCategoryFilter = filterCategory;
    document.querySelectorAll('#newJoinyView .filter-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    renderNewJoinyTable();
}

function renderNewJoinyTable() {
    const tbody = document.getElementById('newJoinyTableBody');
    if (!tbody) return;

    const isJoiny = b => isNewJoinyBooking(b);

    let list = window.rcaDB.getBookings().filter(isJoiny);

    // Apply Category Filter
    if (currentNewJoinyCategoryFilter !== 'All') {
        if (currentNewJoinyCategoryFilter === 'Confirmed') {
            list = list.filter(b => b.status === 'Confirmed');
        } else if (currentNewJoinyCategoryFilter === 'Pending') {
            list = list.filter(b => b.status === 'Pending Verification' || b.status === 'New' || !b.utrNumber);
        } else {
            list = list.filter(b => (b.category && b.category.includes(currentNewJoinyCategoryFilter)) || (b.bookingType && b.bookingType.includes(currentNewJoinyCategoryFilter)));
        }
    }

    // Apply Search
    if (currentNewJoinySearch.trim() !== '') {
        const q = currentNewJoinySearch.toLowerCase();
        list = list.filter(b => 
            (b.name && b.name.toLowerCase().includes(q)) ||
            (b.phone && b.phone.includes(q)) ||
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.fatherName && b.fatherName.toLowerCase().includes(q)) ||
            (b.city && b.city.toLowerCase().includes(q)) ||
            (b.utrNumber && b.utrNumber.toLowerCase().includes(q)) ||
            (b.category && b.category.toLowerCase().includes(q))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 36px; color: var(--admin-text-dim);">
                    <i class="fa-solid fa-graduation-cap" style="font-size: 2.2rem; color: var(--admin-gold); margin-bottom: 8px; display: block;"></i>
                    No New Joiny or Academy Admissions found matching the current filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(b => {
        const cat = b.category || 'Under-16';
        let catBadgeStyle = 'background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; color: #60a5fa;';
        if (cat.includes('14')) {
            catBadgeStyle = 'background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #4ade80;';
        } else if (cat.includes('19')) {
            catBadgeStyle = 'background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #c084fc;';
        }

        const cleanPhone = (b.phone || '').replace(/\D/g, '');
        const waMsg = encodeURIComponent(
            `Namaste ${b.name} ji! 🏏\n` +
            `Ram Cricket Academy (Vrindavan) me aapka ${cat} admission registration receive ho gaya hai.\n\n` +
            `Registration ID: ${b.id}\n` +
            `Player: ${b.name} (Age: ${b.age || '-'})` + (b.fatherName && b.fatherName !== '-' ? ` S/o ${b.fatherName}\n` : '\n') +
            `Category: ${cat}\n` +
            `UPI UTR: ${b.utrNumber || 'Pending'}\n` +
            `Status: ${b.status}\n\n` +
            `Ground: RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)\n` +
            `Coach Chauhan: +91 9897517704`
        );
        const waLink = `https://wa.me/91${cleanPhone}?text=${waMsg}`;

        return `
            <tr>
                <td>
                    <strong style="color: var(--admin-gold); font-size: 0.88rem; font-family: monospace;">${b.id}</strong>
                    <div style="font-size: 0.72rem; color: var(--admin-text-dim); margin-top: 3px;">${b.createdAt}</div>
                </td>
                <td>
                    <span style="${catBadgeStyle} font-weight: 800; padding: 4px 10px; border-radius: 8px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-shield-halved"></i> ${escapeHtml(cat)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${(b.photo || (b.formData && b.formData.playerPhoto)) ? `
                            <img src="${b.photo || b.formData.playerPhoto}" alt="Photo" onclick="openPlayerPhotoLightbox('${b.id}')" style="width: 38px; height: 46px; object-fit: cover; border-radius: 4px; border: 1.5px solid var(--admin-gold); flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.5); cursor: pointer;" title="Click to view full photo & download">
                        ` : `
                            <div style="width: 38px; height: 46px; background: rgba(212,175,55,0.1); border: 1px dashed rgba(212,175,55,0.4); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--admin-gold); flex-shrink: 0;">
                                <i class="fa-solid fa-user" style="font-size: 0.85rem;"></i>
                            </div>
                        `}
                        <div>
                            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${escapeHtml(b.name)}</div>
                            <div style="font-size: 0.8rem; color: #baa3d6; margin-top: 2px;">
                                <i class="fa-solid fa-user-clock"></i> Age: <strong style="color: #fde68a;">${b.age || '-'}</strong>
                            </div>
                            ${b.dob ? `<div style="font-size: 0.75rem; color: #a7f3d0; margin-top: 2px;"><i class="fa-solid fa-cake-candles"></i> DOB: ${b.dob}</div>` : ''}
                            ${(b.aadhaarNumber || (b.formData && b.formData.aadhaarNumber)) ? `<div style="font-size: 0.72rem; color: var(--admin-gold-light); margin-top: 2px;"><i class="fa-solid fa-id-card"></i> Aadhaar: ${escapeHtml((b.aadhaarNumber || b.formData.aadhaarNumber).replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'))}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #e2e8f0; font-size: 0.85rem;">
                        ${escapeHtml(b.fatherName || '-')}
                    </div>
                </td>
                <td>
                    <div><a href="tel:${b.phone}" style="color: var(--admin-gold-light); font-weight: 700;"><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${b.phone}</a></div>
                    <div style="font-size: 0.78rem; color: #baa3d6;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.city || 'Vrindavan')}</div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #fff; font-size: 0.85rem;">
                        <i class="fa-solid fa-baseball-bat-ball" style="color: var(--admin-gold); font-size: 0.75rem;"></i> ${escapeHtml(b.role || 'All-Rounder')}
                    </div>
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
                        Bat: ${escapeHtml(b.battingStyle || (b.formData && b.formData.battingStyle) || '-')}
                    </div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">
                        Bowl: ${escapeHtml(b.bowlingStyle || (b.formData && b.formData.bowlingStyle) || '-')}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 700; color: #4ade80; font-size: 0.88rem;">
                        ₹${b.feeAmount || '1,499'}
                    </div>
                    ${b.utrNumber ? `
                        <div style="margin-top: 4px; font-size: 0.76rem; color: #facc15; font-family: monospace; font-weight: 700; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 5px; border: 1px dashed rgba(245, 204, 21, 0.45); display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                            <span>UTR: ${escapeHtml(b.utrNumber)}</span>
                            <button onclick="navigator.clipboard.writeText('${b.utrNumber}'); alert('Copied UTR: ${b.utrNumber}');" style="background: none; border: none; color: #facc15; cursor: pointer; padding: 0;" title="Copy UTR">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    ` : `
                        <span style="font-size: 0.72rem; color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Pending UTR</span>
                    `}
                </td>
                <td>
                    <select onchange="updateStatus('${b.id}', this.value)" class="status-pill status-${b.status}" style="background: rgba(12, 2, 20, 0.95); border: 1px solid var(--admin-border); cursor: pointer; color: #fff; font-size: 0.78rem;">
                        <option value="Pending Verification" ${b.status === 'Pending Verification' || b.status === 'New' ? 'selected' : ''}>Pending Verification</option>
                        <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed / Admitted</option>
                        <option value="Contacted" ${b.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Rejected</option>
                    </select>
                </td>
                <td>
                    <div class="action-btn-group">
                        <a href="${waLink}" target="_blank" rel="noopener" class="act-btn act-whatsapp" title="WhatsApp Player">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                        <a href="tel:${b.phone}" class="act-btn act-call" title="Call Player">
                            <i class="fa-solid fa-phone"></i>
                        </a>
                        <button onclick="viewPlayerSlip('${b.id}')" class="act-btn" style="background: rgba(212, 175, 55, 0.15); color: var(--admin-gold);" title="View Registration Pass">
                            <i class="fa-solid fa-id-card"></i>
                        </button>
                        <button onclick="deleteBookingRow('${b.id}')" class="act-btn act-delete" title="Delete Entry">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function exportNewJoinyCSV() {
    const csvData = window.rcaDB.exportNewJoinyToCsv ? window.rcaDB.exportNewJoinyToCsv() : window.rcaDB.exportToCsv();
    if (!csvData) {
        alert("No New Joiny registrations available to export.");
        return;
    }
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RCA_New_Joiny_Admissions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// -----------------------------------------------------------------------------
// VIEW 1B: TOURNAMENT & CUP REGISTRATIONS MANAGER (NEW DEDICATED VIEW)
// -----------------------------------------------------------------------------
let currentTournamentFilter = 'All';
let currentTournamentSearch = '';

function filterTournamentsTable(filterTag, element) {
    currentTournamentFilter = filterTag;
    document.querySelectorAll('#tournamentRegsView .filter-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    renderTournamentRegsTable();
}

function handleTournamentSearch() {
    const input = document.getElementById('tournamentSearchInput');
    if (input) {
        let val = input.value.trim();
        if (val.includes('@') || /rcaacademy/i.test(val)) {
            val = '';
            input.value = '';
        }
        currentTournamentSearch = val;
        renderTournamentRegsTable();
    }
}

function renderTournamentRegsTable() {
    const tbody = document.getElementById('tournamentRegsTableBody');
    if (!tbody) return;

    let regs = window.rcaDB.getBookings().filter(isTournamentBooking);

    // Apply Filter
    if (currentTournamentFilter === 'RRPL') {
        regs = regs.filter(b => (b.bookingType && b.bookingType.toLowerCase().includes('rrpl')) || (b.formType === 'rrpl_trials'));
    } else if (currentTournamentFilter === 'RAM SPORTS') {
        regs = regs.filter(b => (b.bookingType && b.bookingType.toLowerCase().includes('ram sports')) || (b.bookingType && b.bookingType.toLowerCase().includes('cup')));
    } else if (currentTournamentFilter === 'Pending UTR') {
        regs = regs.filter(b => !b.utrNumber || b.status === 'Pending Verification' || b.status === 'New');
    } else if (currentTournamentFilter === 'Confirmed') {
        regs = regs.filter(b => b.status === 'Confirmed');
    }

    // Apply Search with Anti-Autofill Safety
    const searchInput = document.getElementById('tournamentSearchInput');
    let q = (currentTournamentSearch || '').trim().toLowerCase();
    if (q.includes('@') || q.includes('rcaacademy')) {
        q = '';
        currentTournamentSearch = '';
        if (searchInput) searchInput.value = '';
    }

    if (q !== '') {
        regs = regs.filter(b => 
            (b.name && b.name.toLowerCase().includes(q)) ||
            (b.phone && b.phone.includes(q)) ||
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.city && b.city.toLowerCase().includes(q)) ||
            (b.bookingType && b.bookingType.toLowerCase().includes(q)) ||
            (b.utrNumber && b.utrNumber.toLowerCase().includes(q))
        );
    }

    if (regs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 34px; color: var(--admin-text-dim);">
                    <i class="fa-solid fa-trophy" style="font-size: 2rem; color: var(--admin-gold); margin-bottom: 8px; display: block;"></i>
                    No tournament registrations found matching the current filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = regs.map(b => {
        const cleanPhone = (b.phone || '').replace(/[^0-9]/g, '');
        const waMsg = encodeURIComponent(`Namaste ${b.name}! Ram Cricket Academy se Coach Chauhan here regarding your registration for ${b.bookingType} (ID: ${b.id}).`);
        const feeVal = b.feeAmount || (b.bookingType.includes('RRPL') ? '1,499' : 'Team Fee');

        return `
            <tr>
                <td><strong class="gold-id" style="color: var(--admin-gold); font-weight: 700;">${escapeHtml(b.id)}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${(b.photo || (b.formData && b.formData.playerPhoto)) ? `
                            <img src="${b.photo || b.formData.playerPhoto}" alt="Photo" onclick="openPlayerPhotoLightbox('${b.id}')" style="width: 38px; height: 46px; object-fit: cover; border-radius: 4px; border: 1.5px solid var(--admin-gold); flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.5); cursor: pointer;" title="Click to view full photo & download">
                        ` : ''}
                        <div>
                            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${escapeHtml(b.name)}</div>
                            <div style="font-size: 0.8rem; color: var(--admin-text-dim);">Father: ${escapeHtml(b.fatherName || '-')}</div>
                            <div style="font-size: 0.78rem; color: var(--admin-gold-light);">Age: ${escapeHtml(String(b.age || '-'))} | DOB: ${escapeHtml(b.dob || '-')}</div>
                            ${(b.aadhaarNumber || (b.formData && b.formData.aadhaarNumber)) ? `<div style="font-size: 0.72rem; color: var(--admin-gold-light); margin-top: 2px;"><i class="fa-solid fa-id-card"></i> Aadhaar: ${escapeHtml((b.aadhaarNumber || b.formData.aadhaarNumber).replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'))}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-pill status-Confirmed" style="font-size: 0.8rem; background: rgba(234, 179, 8, 0.15); color: #fbbf24; border: 1px solid rgba(234, 179, 8, 0.4);">
                        <i class="fa-solid fa-trophy"></i> ${escapeHtml(b.bookingType || 'Tournament Entry')}
                    </span>
                    <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px;">Category: ${escapeHtml(b.category || b.totalPersons || 'Open')}</div>
                </td>
                <td>
                    <div style="color: #fff; font-weight: 600;">${escapeHtml(b.phone)}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-dim);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.city || 'Vrindavan')}</div>
                </td>
                <td>
                    <div style="color: #fff; font-size: 0.85rem;">${escapeHtml(b.role || 'Player / Team')}</div>
                    <div style="font-size: 0.78rem; color: var(--admin-text-dim);">${escapeHtml(b.battingStyle || '-')} • ${escapeHtml(b.bowlingStyle || '-')}</div>
                </td>
                <td>
                    <div style="font-weight: 700; color: #4ade80; font-size: 0.95rem;">₹${escapeHtml(feeVal)}</div>
                    <div style="font-size: 0.75rem; font-family: monospace; color: ${b.utrNumber ? '#fbbf24' : '#f87171'}; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px;">
                        UTR: ${escapeHtml(b.utrNumber || 'Not Provided')}
                    </div>
                </td>
                <td style="font-size: 0.82rem; color: var(--admin-text-dim); white-space: nowrap;">
                    ${escapeHtml(b.createdAt || '-')}
                </td>
                <td>
                    <select class="status-select status-${(b.status || 'New').replace(/\s+/g, '')}" onchange="updateStatus('${b.id}', this.value)">
                        <option value="New" ${b.status === 'New' ? 'selected' : ''}>New</option>
                        <option value="Contacted" ${b.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Pending Verification" ${b.status === 'Pending Verification' ? 'selected' : ''}>Pending UTR</option>
                        <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <div class="action-buttons-wrap">
                        ${cleanPhone ? `
                            <a href="https://wa.me/91${cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone}?text=${waMsg}" target="_blank" class="action-btn action-btn-wa" title="Chat on WhatsApp">
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>
                        ` : ''}
                        <button class="action-btn action-btn-view" onclick="viewRegistrationDetails('${b.id}')" title="View Full Details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="action-btn action-btn-del" onclick="deleteBookingRow('${b.id}')" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function exportTournamentRegistrationsCSV() {
    const regs = window.rcaDB.getBookings().filter(isTournamentBooking);
    if (!regs || regs.length === 0) {
        alert("No tournament registrations available to export.");
        return;
    }

    const headers = ["ID", "Name", "Father Name", "Phone", "Age", "DOB", "City", "Tournament / Cup", "Category", "Role", "Fee", "UTR", "Status", "Date"];
    const rows = regs.map(b => [
        `"${b.id}"`,
        `"${(b.name || '').replace(/"/g, '""')}"`,
        `"${(b.fatherName || '').replace(/"/g, '""')}"`,
        `"'${b.phone || ''}"`,
        `"${b.age || ''}"`,
        `"${b.dob || ''}"`,
        `"${(b.city || '').replace(/"/g, '""')}"`,
        `"${(b.bookingType || '').replace(/"/g, '""')}"`,
        `"${(b.category || b.totalPersons || '').replace(/"/g, '""')}"`,
        `"${(b.role || '').replace(/"/g, '""')}"`,
        `"${b.feeAmount || ''}"`,
        `"'${b.utrNumber || ''}"`,
        `"${b.status || ''}"`,
        `"${b.createdAt || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RCA_Tournament_Registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// -----------------------------------------------------------------------------
// VIEW 1C: SLOT & GROUND BOOKINGS MANAGER
// -----------------------------------------------------------------------------
function renderBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    let bookings = window.rcaDB.getBookings().filter(isSlotBooking);

    // Apply Status Filter
    if (currentFilter !== 'All') {
        bookings = bookings.filter(b => b.status === currentFilter);
    }

    // Apply Search Query with Anti-Autofill Safety
    const searchInput = document.getElementById('bookingSearchInput');
    let rawVal = searchInput ? searchInput.value.trim() : '';
    if (rawVal.includes('@') || /rcaacademy/i.test(rawVal)) {
        if (searchInput) searchInput.value = '';
        rawVal = '';
        currentSearch = '';
    }

    let q = (currentSearch || rawVal).trim().toLowerCase();
    
    // SAFETY: If browser autofilled admin email, clear it!
    if (q.includes('@') || q.includes('rcaacademy')) {
        q = '';
        currentSearch = '';
        if (searchInput) searchInput.value = '';
    }

    if (q !== '') {
        bookings = bookings.filter(b => 
            (b.name && b.name.toLowerCase().includes(q)) ||
            (b.phone && b.phone.includes(q)) ||
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.city && b.city.toLowerCase().includes(q)) ||
            (b.bookingType && b.bookingType.toLowerCase().includes(q)) ||
            (b.utrNumber && b.utrNumber.toLowerCase().includes(q))
        );
    }

    if (bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 34px; color: var(--admin-text-dim);">
                    <i class="fa-solid fa-inbox" style="font-size: 2rem; color: var(--admin-gold); margin-bottom: 8px; display: block;"></i>
                    No registrations found matching the current filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bookings.map(b => {
        const waLink = window.rcaDB.getPlayerWhatsAppUrl(b);
        const mailLink = `mailto:${b.email || ''}?subject=${encodeURIComponent('Ram Cricket Academy Vrindavan - Registration Confirmation')}`;
        
        return `
            <tr>
                <td><strong style="color: var(--admin-gold); font-size: 0.88rem;">${b.id}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #fff;">${escapeHtml(b.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-dim);">
                        Age: ${b.age} ${b.fatherName && b.fatherName !== '-' ? '• S/o ' + escapeHtml(b.fatherName) : ''}
                    </div>
                    ${b.dob ? `<div style="font-size: 0.75rem; color: #a7f3d0; margin-top: 2px;"><i class="fa-solid fa-cake-candles"></i> DOB: ${b.dob}</div>` : ''}
                </td>
                <td>
                    ${b.category && (b.category.includes('Under') || b.category.includes('U-')) 
                        ? `<span style="background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #4ade80; font-weight: 800; padding: 4px 10px; border-radius: 8px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px;">
                               <i class="fa-solid fa-shield-halved"></i> ${escapeHtml(b.category)}
                           </span>`
                        : `<span style="background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.35); padding: 3px 8px; border-radius: 6px; font-size: 0.82rem; color: var(--admin-gold-light); font-weight: 700;">
                               <i class="fa-solid fa-users"></i> ${escapeHtml(b.totalPersons || '1 Player')}
                           </span>`
                    }
                </td>
                <td>
                    <div><a href="tel:${b.phone}" style="color: var(--admin-gold-light); font-weight: 600;"><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${b.phone}</a></div>
                    <div style="font-size: 0.78rem; color: #baa3d6;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.city)}</div>
                </td>
                <td>
                    <span style="font-size: 0.82rem; background: rgba(70, 20, 115, 0.4); border: 1px solid rgba(212, 175, 55, 0.3); padding: 4px 8px; border-radius: 4px; color: #fff; display: inline-block;">
                        ${escapeHtml(b.bookingType)}
                    </span>
                    ${b.utrNumber ? `
                        <div style="margin-top: 5px; font-size: 0.78rem; color: #facc15; font-family: monospace; font-weight: 700; background: rgba(0,0,0,0.5); padding: 3px 7px; border-radius: 5px; border: 1px dashed rgba(245, 204, 21, 0.45);">
                            <i class="fa-solid fa-receipt"></i> UTR: ${escapeHtml(b.utrNumber)} (₹${b.feeAmount || '1,499'})
                        </div>
                    ` : ''}
                </td>
                <td>
                    <div style="font-weight: 500; color: #fff;">${b.slotDate}</div>
                    <div style="font-size: 0.78rem; color: var(--admin-text-dim);"><i class="fa-solid fa-clock"></i> ${escapeHtml(b.timeSlot)}</div>
                </td>
                <td>
                    <select onchange="updateStatus('${b.id}', this.value)" class="status-pill status-${b.status}" style="background: rgba(12, 2, 20, 0.9); border: 1px solid var(--admin-border); cursor: pointer; color: #fff;">
                        <option value="New" ${b.status === 'New' ? 'selected' : ''}>New</option>
                        <option value="Contacted" ${b.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <div class="action-btn-group">
                        <a href="${waLink}" target="_blank" rel="noopener" class="act-btn act-whatsapp" title="Connect Directly on WhatsApp">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                        <a href="tel:${b.phone}" class="act-btn act-call" title="Call Player">
                            <i class="fa-solid fa-phone"></i>
                        </a>
                        ${b.email ? `<a href="${mailLink}" class="act-btn act-mail" title="Send Email"><i class="fa-solid fa-envelope"></i></a>` : ''}
                        <button onclick="viewPlayerSlip('${b.id}')" class="act-btn" style="background: rgba(212, 175, 55, 0.15); color: var(--admin-gold);" title="View Registration Pass">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button onclick="deleteBookingRow('${b.id}')" class="act-btn act-delete" title="Delete Entry">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterBookingsTable(status, buttonElement) {
    currentFilter = status;
    const buttons = document.querySelectorAll('.filter-group .filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');
    renderBookingsTable();
}

function handleBookingSearch() {
    const input = document.getElementById('bookingSearchInput');
    let val = input ? input.value.trim() : '';
    if (val.includes('@') || /rcaacademy/i.test(val)) {
        val = '';
        if (input) input.value = '';
    }
    currentSearch = val;
    renderBookingsTable();
}

function updateStatus(bookingId, newStatus) {
    window.rcaDB.updateBookingStatus(bookingId, newStatus);
    updateMetrics();
    renderNewJoinyTable();
    renderBookingsTable();
}

function deleteBookingRow(bookingId) {
    if (confirm(`Are you sure you want to delete registration ${bookingId}?`)) {
        window.rcaDB.deleteBooking(bookingId);
        updateMetrics();
        renderNewJoinyTable();
        renderBookingsTable();
    }
}

function viewPlayerSlip(bookingId) {
    const bookings = window.rcaDB.getBookings();
    const b = bookings.find(item => item.id === bookingId);
    if (!b) return;

    const playerPhoto = b.photo || (b.formData && b.formData.playerPhoto) || '';
    const aadhaarNo = b.aadhaarNumber || (b.formData && b.formData.aadhaarNumber) || '';

    const modalContent = document.getElementById('slipModalContent');
    modalContent.innerHTML = `
        <div class="success-pass" style="margin: 0;">
            <div class="success-pass-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 0.72rem; color: var(--admin-gold-light); font-weight: 700;">RAM CRICKET ACADEMY • OFFICIAL REGISTRATION</div>
                    <div class="pass-id">${b.id}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${playerPhoto ? `
                        <div style="text-align: center;">
                            <img src="${playerPhoto}" alt="Player Photo" onclick="openPlayerPhotoLightbox('${b.id}')" style="width: 52px; height: 64px; object-fit: cover; border-radius: 6px; border: 1.5px solid var(--admin-gold); cursor: pointer; display: block;" title="Click to view full photo & download">
                            <div style="font-size: 0.65rem; color: var(--admin-gold); margin-top: 2px; cursor: pointer;" onclick="openPlayerPhotoLightbox('${b.id}')"><i class="fa-solid fa-magnifying-glass-plus"></i> View</div>
                        </div>
                    ` : ''}
                    <img src="assets/images/logo.png" alt="RCA" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--admin-gold);">
                </div>
            </div>

            <div class="pass-grid">
                <div>
                    <span class="pass-label">Player Name:</span>
                    <div class="pass-value">${escapeHtml(b.name)}</div>
                </div>
                <div>
                    <span class="pass-label">Total Persons:</span>
                    <div class="pass-value" style="color: var(--admin-gold-light); font-weight: 700;">${b.totalPersons || '1 Player'}</div>
                </div>
                <div>
                    <span class="pass-label">Age & Guardian:</span>
                    <div class="pass-value">${b.age} yrs ${b.fatherName && b.fatherName !== '-' ? '• S/o ' + escapeHtml(b.fatherName) : ''}</div>
                </div>
                ${aadhaarNo ? `
                <div>
                    <span class="pass-label">Aadhaar Card No:</span>
                    <div class="pass-value" style="color: var(--admin-gold-light); font-weight: 700; letter-spacing: 1px;">
                        ${escapeHtml(aadhaarNo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'))}
                    </div>
                </div>
                ` : ''}
                <div>
                    <span class="pass-label">Phone (WhatsApp):</span>
                    <div class="pass-value">${b.phone}</div>
                </div>
                <div>
                    <span class="pass-label">Booking Category:</span>
                    <div class="pass-value">${b.bookingType}</div>
                </div>
                <div>
                    <span class="pass-label">Slot Date:</span>
                    <div class="pass-value">${b.slotDate}</div>
                </div>
                <div>
                    <span class="pass-label">Time Batch:</span>
                    <div class="pass-value">${escapeHtml(b.timeSlot)}</div>
                </div>
                <div>
                    <span class="pass-label">City:</span>
                    <div class="pass-value">${escapeHtml(b.city)}</div>
                </div>
                <div>
                    <span class="pass-label">Status:</span>
                    <div class="pass-value">${b.status}</div>
                </div>
            </div>

            ${b.remarks ? `
                <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.3); font-size: 0.85rem; color: #fff;">
                    <strong>Remarks / Background:</strong> ${escapeHtml(b.remarks)}
                </div>
            ` : ''}

            ${b.formData && Object.keys(b.formData).length > 0 ? `
                <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(62, 207, 142, 0.4);">
                    <div style="font-size: 0.76rem; font-weight: 700; color: #3ecf8e; margin-bottom: 8px; text-transform: uppercase;">
                        <i class="fa-solid fa-file-invoice"></i> Additional / Custom Form Details:
                    </div>
                    <div class="pass-grid">
                        ${Object.entries(b.formData).filter(([k]) => k !== 'playerPhoto' && k !== 'photo').map(([k, v]) => `
                            <div>
                                <span class="pass-label">${escapeHtml(k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))}:</span>
                                <div class="pass-value" style="color: #a7f3d0;">${escapeHtml(String(v))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${playerPhoto ? `
                <div style="margin-top: 14px; text-align: center; border-top: 1px dashed rgba(212, 175, 55, 0.3); padding-top: 12px;">
                    <button type="button" class="btn btn-gold btn-sm" onclick="openPlayerPhotoLightbox('${b.id}')" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-expand"></i> View Full Player Photo & Download
                    </button>
                </div>
            ` : ''}

            <div style="margin-top: 12px; font-size: 0.75rem; color: #baa3d6;">
                Recorded At: ${b.createdAt} • Ground: <a href="https://goo.gl/maps/JbRKLzuBDmZG7U68A" target="_blank" rel="noopener" style="color: #facc15; text-decoration: underline;">RCA Ground, Panigaon Raya Road, Vrindavan (Mathura)</a>
            </div>
        </div>
    `;

    showModal('viewSlipModal');
}

function viewRegistrationDetails(bookingId) {
    viewPlayerSlip(bookingId);
}

// -----------------------------------------------------------------------------
// PLAYER PHOTO FULL LIGHTBOX & LOCAL DOWNLOAD (User Requested)
// -----------------------------------------------------------------------------
function openPlayerPhotoLightbox(bookingId) {
    const bookings = window.rcaDB ? window.rcaDB.getBookings() : [];
    const b = bookings.find(item => item.id === bookingId);
    const photoSrc = b ? (b.photo || (b.formData && b.formData.playerPhoto)) : '';
    if (!b || !photoSrc) {
        alert("Is player ki photo available nahi hai.");
        return;
    }
    const nameEl = document.getElementById('photoModalPlayerName');
    const idEl = document.getElementById('photoModalRegId');
    const imgEl = document.getElementById('photoModalImg');
    const downloadBtn = document.getElementById('photoDownloadBtn');

    if (nameEl) nameEl.textContent = `${b.name || 'Player'} (${b.category || b.bookingType || 'Photo'})`;
    if (idEl) idEl.textContent = `Reg ID: ${b.id}${b.aadhaarNumber ? ' • Aadhaar: ' + b.aadhaarNumber : ''}`;
    if (imgEl) imgEl.src = photoSrc;

    if (downloadBtn) {
        downloadBtn.href = photoSrc;
        const cleanName = (b.name || 'Player').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanId = (b.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadBtn.setAttribute('download', `${cleanName}_${cleanId}_passport_photo.jpg`);
    }

    showModal('playerPhotoModal');
}

function handleManualBooking(event) {
    event.preventDefault();
    const name = document.getElementById('manName').value.trim();
    const phone = document.getElementById('manPhone').value.trim();
    const persons = document.getElementById('manPersons').value;
    const age = document.getElementById('manAge').value;
    const role = document.getElementById('manRole').value;
    const type = document.getElementById('manType').value;
    const date = document.getElementById('manDate').value;
    const remarks = document.getElementById('manRemarks').value.trim();

    if (!name || !phone || !date) {
        alert("Please fill in all required fields!");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById('manPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    const bookingInput = {
        name,
        phone,
        totalPersons: persons,
        age,
        role,
        bookingType: type,
        slotDate: date,
        timeSlot: "Morning: 06:30 AM - 08:30 AM",
        city: "Vrindavan",
        remarks
    };

    window.rcaDB.addBooking(bookingInput);
    closeModal('manualBookingModal');
    document.getElementById('manName').value = '';
    document.getElementById('manPhone').value = '';
    document.getElementById('manRemarks').value = '';
    const errEl = document.getElementById('manPhoneError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    
    updateMetrics();
    renderNewJoinyTable();
    renderBookingsTable();
    alert("Walk-in player registered successfully!");
}

// -----------------------------------------------------------------------------
// MOBILE NUMBER VALIDATION (10 DIGITS & NUMBERS ONLY)
// -----------------------------------------------------------------------------
function validatePhoneNumber(phoneValue, fieldName = "Mobile Number") {
    const trimmed = (phoneValue || '').trim();
    if (!trimmed) {
        return { valid: false, message: `${fieldName} is required!` };
    }
    if (/[^0-9]/.test(trimmed)) {
        return { valid: false, message: "Only numbers allowed! Kripya sirf numbers (digits) daalein." };
    }
    if (trimmed.length !== 10) {
        return { valid: false, message: `Mobile no. 10 digit required! (Aapne ${trimmed.length} digits daale hain. Kripya sahi 10-digit number bharein).` };
    }
    return { valid: true, message: "" };
}

function attachPhoneInputValidator(inputId, errorId) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input) return;

    input.addEventListener('input', function() {
        const raw = this.value;
        if (/[^0-9]/.test(raw)) {
            if (errorEl) {
                errorEl.textContent = "Only numbers allowed! (Sirf numbers daalein)";
                errorEl.style.display = "block";
                errorEl.style.color = "#ef4444";
            }
            this.value = raw.replace(/[^0-9]/g, '');
        } else if (this.value.length > 0 && this.value.length < 10) {
            if (errorEl) {
                errorEl.textContent = `Mobile no. 10 digit required (${this.value.length}/10)`;
                errorEl.style.display = "block";
                errorEl.style.color = "#f59e0b";
            }
        } else if (this.value.length === 10) {
            if (errorEl) {
                errorEl.textContent = "✓ Sahi 10-digit mobile number";
                errorEl.style.display = "block";
                errorEl.style.color = "#10b981";
            }
        } else if (this.value.length === 0) {
            if (errorEl) {
                errorEl.style.display = "none";
                errorEl.textContent = "";
            }
        }

        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
            if (errorEl) {
                errorEl.textContent = "✓ Sahi 10-digit mobile number";
                errorEl.style.display = "block";
                errorEl.style.color = "#10b981";
            }
        }
    });

    input.addEventListener('blur', function() {
        if (this.value.length > 0 && this.value.length < 10) {
            if (errorEl) {
                errorEl.textContent = `Mobile no. 10 digit required! (${this.value.length}/10)`;
                errorEl.style.display = "block";
                errorEl.style.color = "#ef4444";
            }
        }
    });
}

function exportBookingsCSV() {
    const csvData = window.rcaDB.exportToCsv();
    if (!csvData) {
        alert("No bookings available to export.");
        return;
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RCA_Registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// -----------------------------------------------------------------------------
// VIEW 2: TOURNAMENTS & CUPS MANAGER (ADD/DELETE POSTERS & PRIZES)
// -----------------------------------------------------------------------------
function renderAdminTournaments() {
    const container = document.getElementById('adminTournamentsContainer');
    if (!container) return;

    const tournaments = window.rcaDB.getTournaments();

    if (tournaments.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; color: var(--admin-text-dim); text-align: center;">No tournaments active. Add one using the form above.</div>`;
        return;
    }

    container.innerHTML = tournaments.map(t => `
        <div class="admin-tour-card">
            <img src="${t.poster}" alt="${escapeHtml(t.title)}" class="admin-tour-thumb" onerror="this.src='assets/images/tournaments/ram-sports-cup-7th.jpg'">
            <div class="admin-tour-info">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 0.72rem; color: var(--admin-gold); font-weight: 700; text-transform: uppercase;">${t.category}</span>
                        <span style="font-size: 0.75rem; background: var(--admin-gold); color: #000; padding: 2px 8px; border-radius: 12px; font-weight: 700;">${t.feeLabel || 'Free'}</span>
                    </div>
                    <h4 style="font-size: 1rem; color: #fff; margin-bottom: 6px;">${escapeHtml(t.title)}</h4>
                    <p style="font-size: 0.82rem; color: var(--admin-gold-light); margin-bottom: 4px;">
                        <i class="fa-solid fa-calendar-days"></i> ${escapeHtml(t.dates)}
                    </p>
                    <div style="font-size: 0.8rem; color: #baa3d6; margin-bottom: 8px;">
                        <strong>Prizes:</strong> Winner: ${t.winnerPrize || '-'} • Runner: ${t.runnerPrize || '-'}
                    </div>
                    <div style="font-size: 0.78rem; color: var(--admin-text-dim);">
                        <i class="fa-solid fa-location-dot"></i> ${escapeHtml(t.venue || 'RCA Ground')}
                    </div>
                </div>

                <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.25); display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="openEditTournamentFeeModal('${t.id}')" class="btn btn-gold btn-sm" style="width: 100%;">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Fees (${escapeHtml(t.feeLabel || 'Free')})
                    </button>
                    <button onclick="deleteAdminTournament('${t.id}')" class="btn btn-purple btn-sm" style="width: 100%; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fca5a5;">
                        <i class="fa-solid fa-trash-can"></i> Delete Tournament
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleTournamentSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('tourTitle').value.trim();
    const shortTag = document.getElementById('tourTag').value.trim();
    const category = document.getElementById('tourCategory').value;
    const dates = document.getElementById('tourDates').value.trim();
    const feeLabel = document.getElementById('tourFeeLabel').value.trim();
    const winnerPrize = document.getElementById('tourWinner').value.trim();
    const runnerPrize = document.getElementById('tourRunner').value.trim();
    const playerOfSeries = document.getElementById('tourMvp').value.trim();
    const specialAwards = document.getElementById('tourAwards').value.trim();
    const venue = document.getElementById('tourVenue').value.trim();
    const description = document.getElementById('tourDesc').value.trim();

    const fileInput = document.getElementById('tourFileInput');
    const urlInput = document.getElementById('tourUrlInput');

    const saveTourWithPoster = (posterSrc) => {
        window.rcaDB.addTournament({
            title,
            shortTag,
            category,
            dates,
            feeLabel,
            winnerPrize,
            runnerPrize,
            playerOfSeries,
            specialAwards,
            venue,
            description,
            poster: posterSrc || "assets/images/tournaments/ram-sports-cup-7th.jpg"
        });

        document.getElementById('addTournamentForm').reset();
        document.getElementById('tourVenue').value = 'RCA Ground, Panigaon Raya Road, Vrindavan';
        renderAdminTournaments();
        updateMetrics();
        alert("Tournament published successfully! It will now appear on the website.");
    };

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        // If Supabase Storage is configured, upload directly to cloud bucket 'rca-media'!
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            const submitBtn = document.querySelector('#addTournamentForm button[type="submit"]');
            const origText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading Poster to Supabase...';
            try {
                const cdnUrl = await window.rcaSupabase.uploadImage(file, 'tournaments');
                if (submitBtn) submitBtn.innerHTML = origText;
                if (cdnUrl) {
                    saveTourWithPoster(cdnUrl);
                    return;
                }
            } catch (err) {
                console.warn("Supabase upload fallback to local:", err);
                if (submitBtn) submitBtn.innerHTML = origText;
            }
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            saveTourWithPoster(e.target.result);
        };
        reader.readAsDataURL(file);
    } else if (urlInput.value.trim()) {
        saveTourWithPoster(urlInput.value.trim());
    } else {
        saveTourWithPoster("assets/images/tournaments/ram-sports-cup-7th.jpg");
    }
}

function deleteAdminTournament(id) {
    if (confirm("Are you sure you want to delete this tournament from the website?")) {
        window.rcaDB.deleteTournament(id);
        renderAdminTournaments();
        updateMetrics();
    }
}

// -----------------------------------------------------------------------------
// VIEW 3: SLOTS & AVAILABILITY MANAGER (SOLD OUT TOGGLE & PERSON TIER PRICING)
// -----------------------------------------------------------------------------
function renderAdminSlots() {
    const tbody = document.getElementById('adminSlotsTableBody');
    if (!tbody) return;

    const slots = window.rcaDB.getSlots();
    const activeTiers = window.rcaDB.getPersonTiers ? window.rcaDB.getPersonTiers() : [];

    tbody.innerHTML = slots.map(s => {
        const isAvail = s.isAvailable !== false;
        const statusBadge = isAvail
            ? `<span class="slot-badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
            : `<span class="slot-badge-sold-out"><i class="fa-solid fa-ban"></i> SOLD OUT</span>`;

        const toggleBtn = isAvail
            ? `<button class="slot-toggle-btn slot-toggle-sold" onclick="toggleSlotStatus('${s.id}', false)" title="Mark as Sold Out">
                    <i class="fa-solid fa-ban"></i> Mark Sold Out
               </button>`
            : `<button class="slot-toggle-btn slot-toggle-avail" onclick="toggleSlotStatus('${s.id}', true)" title="Re-enable Availability">
                    <i class="fa-solid fa-circle-check"></i> Mark Available
               </button>`;

        const qrUrl = window.rcaDB.getSlotQrUrl(s);
        const hasCustomQr = s.qrImage && s.qrImage.trim().length > 0;
        const tierPrices = s.personPrices || {};
        const tierOptionsHtml = activeTiers.map(t => {
            const p = (tierPrices[t] !== undefined && tierPrices[t] > 0) 
                ? tierPrices[t] 
                : (window.rcaDB.getSlotPriceForTier ? window.rcaDB.getSlotPriceForTier(s, t) : s.price);
            return `<option value="${escapeHtml(t)}">${escapeHtml(t)}: ₹${p.toLocaleString('en-IN')}</option>`;
        }).join('');

        return `
            <tr>
                <td><strong style="color: #fff;">${escapeHtml(s.title)}</strong></td>
                <td><span style="color: var(--admin-gold-light); font-weight: 500;"><i class="fa-regular fa-clock"></i> ${escapeHtml(s.time)}</span></td>
                <td><span style="color: var(--admin-text-dim);">${escapeHtml(s.facility)}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <strong style="color: #4ade80;">₹${s.price}/-</strong>
                        <button class="btn btn-outline btn-sm" onclick="openEditSlotPriceModal('${s.id}')" style="padding: 2px 6px; font-size: 0.7rem;" title="Edit Base Slot Rate">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <select class="auth-input" style="padding: 3px 6px; font-size: 0.75rem; min-width: 165px; background: rgba(15, 3, 25, 0.9); border: 1px solid var(--admin-gold); color: #fef08a;" onchange="openSlotPersonPricingModal('${s.id}')" title="Group Size Pricing for this slot">
                            ${tierOptionsHtml}
                        </select>
                        <button class="btn btn-outline btn-sm" onclick="openSlotPersonPricingModal('${s.id}')" style="padding: 3px 8px; font-size: 0.72rem; white-space: nowrap;" title="Edit fees for each group size">
                            <i class="fa-solid fa-pen-to-square"></i> Set Fees
                        </button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${qrUrl}" alt="QR" style="width: 40px; height: 40px; background: #fff; padding: 2px; border-radius: 4px; border: 1.5px solid var(--admin-gold); cursor: pointer;" onclick="openUpdateSlotQrModal('${s.id}')" title="Click to view/change QR">
                        <button class="btn btn-outline btn-sm" onclick="openUpdateSlotQrModal('${s.id}')" style="padding: 3px 8px; font-size: 0.72rem; white-space: nowrap;">
                            <i class="fa-solid fa-qrcode"></i> ${hasCustomQr ? 'Custom QR' : 'Auto QR'}
                        </button>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>${toggleBtn}</td>
                <td>
                    <button onclick="deleteAdminSlot('${s.id}')" class="act-btn act-delete" title="Delete Slot">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// -----------------------------------------------------------------------------
// TOTAL PERSONS / GROUP SIZES MANAGER CONTROLLER (User Requested)
// -----------------------------------------------------------------------------
function renderAdminPersonTiers() {
    const container = document.getElementById('adminPersonTiersList');
    if (!container || !window.rcaDB) return;

    const tiers = window.rcaDB.getPersonTiers ? window.rcaDB.getPersonTiers() : [];
    if (tiers.length === 0) {
        container.innerHTML = `<span style="color: var(--admin-text-dim); font-size: 0.85rem;">No group tiers configured. Default tiers will be used.</span>`;
        return;
    }

    container.innerHTML = tiers.map(t => `
        <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.35); padding: 6px 14px; border-radius: 20px; font-size: 0.82rem; color: #fff;">
            <span><i class="fa-solid fa-users" style="color: var(--admin-gold); font-size: 0.75rem;"></i> ${escapeHtml(t)}</span>
            <button type="button" onclick="deleteAdminPersonTier('${escapeHtml(t)}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; font-weight: bold; line-height: 1; padding: 0 2px;" title="Delete this group option">&times;</button>
        </div>
    `).join('');

    // Also update walk-in modal select
    const manPersons = document.getElementById('manPersons');
    if (manPersons) {
        const prev = manPersons.value;
        manPersons.innerHTML = tiers.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
        if (prev && tiers.includes(prev)) manPersons.value = prev;
    }
}

function handleAddPersonTier(event) {
    event.preventDefault();
    const input = document.getElementById('newPersonTierName');
    const name = input ? input.value.trim() : '';
    if (!name) return;

    const added = window.rcaDB.addPersonTier(name);
    if (added) {
        input.value = '';
        renderAdminPersonTiers();
        renderAdminSlots();
        alert(`New group size option "${name}" added successfully! It is now active across all booking forms and ground pricing.`);
    } else {
        alert(`Option "${name}" already exists or could not be added.`);
    }
}

function deleteAdminPersonTier(tierName) {
    if (confirm(`Are you sure you want to delete group size option "${tierName}"?`)) {
        window.rcaDB.deletePersonTier(tierName);
        renderAdminPersonTiers();
        renderAdminSlots();
    }
}

// -----------------------------------------------------------------------------
// SLOT PERSON / GROUP TIER PRICING MODAL CONTROLLER (User Requested)
// -----------------------------------------------------------------------------
function openSlotPersonPricingModal(slotId) {
    const slots = window.rcaDB ? window.rcaDB.getSlots() : [];
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    document.getElementById('slotPersonPricingSlotId').value = slot.id;
    document.getElementById('slotPersonModalTitle').textContent = slot.title;
    const timeBadge = document.getElementById('slotPersonModalTimeBadge');
    if (timeBadge) timeBadge.textContent = `${slot.time} • ${slot.facility}`;

    const container = document.getElementById('slotPersonPricingInputsContainer');
    if (!container) return;

    const tiers = window.rcaDB.getPersonTiers ? window.rcaDB.getPersonTiers() : [];
    const currentPrices = slot.personPrices || {};

    container.innerHTML = tiers.map((tier, idx) => {
        const currentVal = (currentPrices[tier] !== undefined && currentPrices[tier] > 0) 
            ? currentPrices[tier] 
            : (window.rcaDB.getSlotPriceForTier ? window.rcaDB.getSlotPriceForTier(slot, tier) : slot.price);

        return `
            <div style="background: rgba(15, 3, 25, 0.7); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 180px;">
                    <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                        <i class="fa-solid fa-users" style="color: var(--admin-gold); font-size: 0.8rem;"></i> ${escapeHtml(tier)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--admin-text-dim);">Fee when customer selects this group size</div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; width: 150px;">
                    <span style="color: var(--admin-gold); font-weight: bold; font-size: 1rem;">₹</span>
                    <input type="number" class="auth-input slot-tier-price-input" data-tier="${escapeHtml(tier)}" value="${currentVal}" min="0" step="50" style="font-weight: 700; color: #4ade80; text-align: right; padding: 6px 10px;" required>
                </div>
            </div>
        `;
    }).join('');

    showModal('slotPersonPricingModal');
}

function handleSaveSlotPersonPrices(event) {
    event.preventDefault();
    const slotId = document.getElementById('slotPersonPricingSlotId').value;
    if (!slotId) return;

    const inputs = document.querySelectorAll('.slot-tier-price-input');
    const newPrices = {};
    inputs.forEach(input => {
        const tier = input.getAttribute('data-tier');
        const price = parseInt(input.value) || 0;
        if (tier) newPrices[tier] = price;
    });

    window.rcaDB.updateSlotAllTierPrices(slotId, newPrices);
    closeModal('slotPersonPricingModal');
    renderAdminSlots();
    alert("Group tier rates saved successfully! They are now active on the public booking form and UPI QR codes.");
}

function toggleSlotStatus(slotId, targetStatus) {
    window.rcaDB.toggleSlotAvailability(slotId, targetStatus);
    renderAdminSlots();
    const msg = targetStatus ? "Slot marked as AVAILABLE on website!" : "Slot marked as SOLD OUT on website!";
    alert(msg);
}


// -----------------------------------------------------------------------------
// SLOT PAYMENT QR & UTR POLICY CONTROLLER
// -----------------------------------------------------------------------------
function handleSlotUtrPolicyChange(isMandatory) {
    window.rcaDB.updateSlotUtrPolicy(isMandatory);
    alert(isMandatory 
        ? "Slot Booking Policy Updated: UPI UTR is now MANDATORY for slot bookings!"
        : "Slot Booking Policy Updated: UPI UTR is now OPTIONAL for slot bookings!"
    );
}

let activeSlotForQrModal = null;

function openUpdateSlotQrModal(slotId) {
    const slots = window.rcaDB.getSlots();
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    activeSlotForQrModal = slot;
    document.getElementById('modalSlotId').value = slot.id;
    document.getElementById('modalSlotTitle').textContent = slot.title;
    document.getElementById('modalSlotPrice').textContent = '₹' + slot.price + '/- Fixed Rate';
    
    const qrUrl = window.rcaDB.getSlotQrUrl(slot);
    document.getElementById('modalSlotQrPreview').src = qrUrl;
    document.getElementById('modalSlotQrUrlInput').value = slot.qrImage || '';
    document.getElementById('modalSlotQrFileInput').value = '';

    showModal('updateSlotQrModal');
}

function previewModalSlotQrFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('modalSlotQrPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function previewModalSlotQrUrl(url) {
    if (url && url.trim().length > 0) {
        document.getElementById('modalSlotQrPreview').src = url.trim();
    }
}

function saveModalSlotQr() {
    if (!activeSlotForQrModal) return;
    const fileInput = document.getElementById('modalSlotQrFileInput');
    const urlInput = document.getElementById('modalSlotQrUrlInput').value.trim();

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const dataUrl = e.target.result;
            window.rcaDB.updateSlotQr(activeSlotForQrModal.id, dataUrl);
            renderAdminSlots();
            closeModal('updateSlotQrModal');
            alert("Custom QR code saved for " + activeSlotForQrModal.title);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else if (urlInput.length > 0) {
        window.rcaDB.updateSlotQr(activeSlotForQrModal.id, urlInput);
        renderAdminSlots();
        closeModal('updateSlotQrModal');
        alert("Custom QR code saved for " + activeSlotForQrModal.title);
    } else {
        alert("Please select a QR image file or enter an image URL.");
    }
}

function resetModalSlotQrToAuto() {
    if (!activeSlotForQrModal) return;
    window.rcaDB.updateSlotQr(activeSlotForQrModal.id, "");
    renderAdminSlots();
    closeModal('updateSlotQrModal');
    alert("Reset to dynamic auto-generated UPI QR code for " + activeSlotForQrModal.title);
}

// Updated handleCustomSlotSubmit with QR Code support

function handleCustomSlotSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('customSlotTitle').value.trim();
    const time = document.getElementById('customSlotTime').value.trim();
    const facility = document.getElementById('customSlotFacility').value.trim();
    const price = document.getElementById('customSlotPrice').value;
    const amenitiesRaw = document.getElementById('customSlotAmenities').value.trim();

    const amenities = amenitiesRaw ? amenitiesRaw.split(',').map(a => a.trim()).filter(Boolean) : ["Turf Pitch", "Coach Supervision"];

    const qrFileInput = document.getElementById('customSlotQrFile');
    const qrUrlInput = (document.getElementById('customSlotQrUrl')?.value || '').trim();

    function finalizeSlotCreation(qrImg = "") {
        window.rcaDB.addCustomSlot({
            title,
            time,
            facility,
            price,
            amenities,
            qrImage: qrImg
        });
        document.getElementById('addCustomSlotForm').reset();
        renderAdminSlots();
        alert("New practice slot created with fixed rate & QR, live on website!");
    }

    if (qrFileInput && qrFileInput.files && qrFileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => finalizeSlotCreation(e.target.result);
        reader.readAsDataURL(qrFileInput.files[0]);
    } else if (qrUrlInput) {
        finalizeSlotCreation(qrUrlInput);
    } else {
        finalizeSlotCreation("");
    }
}

function deleteAdminSlot(slotId) {
    if (confirm("Delete this practice slot from the website?")) {
        window.rcaDB.deleteSlot(slotId);
        renderAdminSlots();
    }
}

// -----------------------------------------------------------------------------
// VIEW 4: GALLERY MANAGER
// -----------------------------------------------------------------------------
function renderAdminGallery() {
    const container = document.getElementById('adminGalleryContainer');
    if (!container) return;

    const gallery = window.rcaDB.getGallery();

    if (gallery.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; color: var(--admin-text-dim); text-align: center;">No photos uploaded yet.</div>`;
        return;
    }

    container.innerHTML = gallery.map(item => `
        <div class="admin-gallery-card">
            <img src="${item.image}" alt="${escapeHtml(item.title)}" class="admin-gallery-thumb" onerror="this.src='assets/images/hero-cricket.jpg'">
            <div class="admin-gallery-info">
                <span style="font-size: 0.72rem; color: var(--admin-gold); font-weight: 700; text-transform: uppercase;">${item.category}</span>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.caption || '')}</p>
                <button onclick="deleteGalleryPhoto('${item.id}')" class="btn btn-purple btn-sm" style="margin-top: 10px; width: 100%; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fca5a5;">
                    <i class="fa-solid fa-trash-can"></i> Delete Photo
                </button>
            </div>
        </div>
    `).join('');
}

async function handlePhotoUpload(event) {
    event.preventDefault();

    const title = document.getElementById('photoTitle').value.trim();
    const category = document.getElementById('photoCategory').value;
    const caption = document.getElementById('photoCaption').value.trim();
    const fileInput = document.getElementById('photoFileInput');
    const urlInput = document.getElementById('photoUrlInput');

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        // If Supabase Storage is configured, upload directly to cloud bucket 'rca-media'!
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            const submitBtn = document.querySelector('#addPhotoForm button[type="submit"]');
            const origText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading to Supabase...';
            try {
                const cdnUrl = await window.rcaSupabase.uploadImage(file, 'gallery');
                if (submitBtn) submitBtn.innerHTML = origText;
                if (cdnUrl) {
                    window.rcaDB.addGalleryItem({
                        title,
                        category,
                        caption,
                        image: cdnUrl
                    });
                    finishPhotoUpload();
                    return;
                }
            } catch (err) {
                console.warn("Supabase photo upload fallback:", err);
                if (submitBtn) submitBtn.innerHTML = origText;
            }
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            window.rcaDB.addGalleryItem({
                title,
                category,
                caption,
                image: e.target.result
            });
            finishPhotoUpload();
        };
        reader.readAsDataURL(file);
    } else if (urlInput.value.trim()) {
        window.rcaDB.addGalleryItem({
            title,
            category,
            caption,
            image: urlInput.value.trim()
        });
        finishPhotoUpload();
    } else {
        alert("Please select a photo file or enter an image URL.");
    }
}

function finishPhotoUpload() {
    document.getElementById('addPhotoForm').reset();
    renderAdminGallery();
    updateMetrics();
    alert("Photo added successfully to gallery showcase!");
}

function deleteGalleryPhoto(id) {
    if (confirm("Are you sure you want to delete this photo from the gallery?")) {
        window.rcaDB.deleteGalleryItem(id);
        renderAdminGallery();
        updateMetrics();
    }
}

// -----------------------------------------------------------------------------
// VIEW 5: NOTICES & ANNOUNCEMENTS MANAGER
// -----------------------------------------------------------------------------
function renderAdminNotices() {
    const container = document.getElementById('adminNoticesContainer');
    if (!container) return;

    const notices = window.rcaDB.getNotices();

    if (notices.length === 0) {
        container.innerHTML = `<div style="padding: 20px; color: var(--admin-text-dim); text-align: center;">No announcements posted.</div>`;
        return;
    }

    container.innerHTML = notices.map(n => `
        <div style="background: rgba(12, 2, 20, 0.7); border: 1px solid var(--admin-border); border-left: 4px solid var(--admin-gold); padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
            <div style="flex-grow: 1;">
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px;">
                    <span class="notice-tag ${n.tagType || 'tag-gold'}">${n.tag}</span>
                    <span style="font-size: 0.8rem; color: #baa3d6;"><i class="fa-regular fa-clock"></i> ${n.date}</span>
                </div>
                <h4 style="font-size: 1.05rem; color: #fff; margin-bottom: 4px;">${escapeHtml(n.title)}</h4>
                <p style="font-size: 0.9rem; color: var(--admin-text-dim);">${escapeHtml(n.content)}</p>
            </div>
            <div>
                <button onclick="deleteNoticeItem('${n.id}')" class="act-btn act-delete" title="Delete Announcement" style="width: 36px; height: 36px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function handleNoticeSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('noticeTitle').value.trim();
    const tag = document.getElementById('noticeTag').value.trim();
    const tagType = document.getElementById('noticeTagType').value;
    const date = document.getElementById('noticeDate').value;
    const content = document.getElementById('noticeContent').value.trim();

    window.rcaDB.addNotice({
        title,
        tag,
        tagType,
        date,
        content
    });

    document.getElementById('addNoticeForm').reset();
    document.getElementById('noticeDate').value = new Date().toISOString().split('T')[0];
    renderAdminNotices();
    alert("New notice published successfully!");
}

function deleteNoticeItem(id) {
    if (confirm("Delete this notice? It will no longer show on the website home page.")) {
        window.rcaDB.deleteNotice(id);
        renderAdminNotices();
    }
}

// -----------------------------------------------------------------------------
// VIEW 6: SETTINGS & GOOGLE SHEETS SYNC
// -----------------------------------------------------------------------------
function loadSettingsIntoForm() {
    const isSlotUtrReq = window.rcaDB && window.rcaDB.isSlotUtrRequired ? window.rcaDB.isSlotUtrRequired() : false;
    const radMandatory = document.getElementById('slotUtrMandatoryRadio');
    const radOptional = document.getElementById('slotUtrOptionalRadio');
    if (radMandatory && radOptional) {
        if (isSlotUtrReq) {
            radMandatory.checked = true;
            radOptional.checked = false;
        } else {
            radOptional.checked = true;
            radMandatory.checked = false;
        }
    }
    const s = window.rcaDB ? window.rcaDB.getSettings() : {};
    document.getElementById('setPhone').value = s.phone || '';
    if (document.getElementById('setAltPhone')) {
        document.getElementById('setAltPhone').value = s.phoneAlternate || '8265800805';
    }
    document.getElementById('setCoach').value = s.headCoach || '';
    document.getElementById('setEmail').value = s.email || '';
    document.getElementById('setAdminEmail').value = s.adminNotifyEmail || '';
    document.getElementById('setInstagram').value = s.instagramUrl || '';
    document.getElementById('setAddress').value = s.address || '';
    if (document.getElementById('setAdmissionFee')) {
        document.getElementById('setAdmissionFee').value = window.rcaDB.getAdmissionFee ? window.rcaDB.getAdmissionFee() : 1499;
    }

    const sheetInput = document.getElementById('sheetWebhookUrl');
    if (sheetInput) {
        sheetInput.value = s.googleSheetWebhookUrl || '';
    }
}

function handleSettingsUpdate(event) {
    event.preventDefault();
    const radMandatory = document.getElementById('slotUtrMandatoryRadio');
    const isSlotUtrReq = radMandatory ? radMandatory.checked : (window.rcaDB ? window.rcaDB.isSlotUtrRequired() : false);
    const newSettings = {
        phone: document.getElementById('setPhone').value.trim(),
        phoneAlternate: document.getElementById('setAltPhone') ? document.getElementById('setAltPhone').value.trim() : '8265800805',
        headCoach: document.getElementById('setCoach').value.trim(),
        email: document.getElementById('setEmail').value.trim(),
        adminNotifyEmail: document.getElementById('setAdminEmail').value.trim(),
        instagramUrl: document.getElementById('setInstagram').value.trim(),
        address: document.getElementById('setAddress').value.trim(),
        admissionFee: document.getElementById('setAdmissionFee') ? parseInt(document.getElementById('setAdmissionFee').value) || 1499 : 1499,
        slotUtrRequired: isSlotUtrReq
    };

    if (window.rcaDB.updateAdmissionFee && document.getElementById('setAdmissionFee')) {
        window.rcaDB.updateAdmissionFee(document.getElementById('setAdmissionFee').value);
    }

    window.rcaDB.updateSettings(newSettings);
    alert("Academy settings saved successfully!");
}

function saveGoogleSheetWebhook() {
    const url = document.getElementById('sheetWebhookUrl').value.trim();
    window.rcaDB.updateSettings({ googleSheetWebhookUrl: url });
    alert("Google Sheets Webhook URL saved successfully! Future registrations will sync automatically.");
}

async function testGoogleSheetWebhookEmail() {
    const s = window.rcaDB.getSettings();
    const inputVal = document.getElementById('sheetWebhookUrl') ? document.getElementById('sheetWebhookUrl').value.trim() : '';
    const url = inputVal || s.googleSheetWebhookUrl;

    if (!url) {
        alert("Pehle Google Apps Script Webhook URL enter karke 'Save Webhook' par click karein!");
        return;
    }

    const testPayload = {
        isTest: true,
        sheetTab: "New Joiny Admissions",
        category: "Under-16",
        name: "Test Verification Player",
        phone: "9897517704",
        city: "Vrindavan",
        role: "All-Rounder",
        feeAmount: "1499",
        utrNumber: "TEST-UTR-EMAIL-CHECK",
        timestamp: new Date().toLocaleString("en-IN")
    };

    try {
        await fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testPayload)
        });
        alert("✅ Test Signal Webhook ko bhej diya gaya hai!\n\n1-2 minute me apna Gmail (rcaacademy9897@gmail.com) check karein.\n\nAgar mail na aaye, to Apps Script editor me jaakar top dropdown me 'testEmailAlert' select karke 'Run' dabayein aur Google Permissions allow karein, phir Deploy → Manage deployments me 'New version' deploy karein.");
    } catch (err) {
        alert("Webhook Error: " + err.message);
    }
}

function triggerManualSheetSync() {
    const s = window.rcaDB.getSettings();
    if (!s.googleSheetWebhookUrl) {
        alert("Please first enter and save your Google Apps Script Webhook URL in Settings → Google Sheets Integration.");
        switchView('settingsView', document.querySelector('.menu-item:last-child'));
        return;
    }

    const count = window.rcaDB.syncAllToGoogleSheet();
    alert(`Triggered synchronization of ${count} bookings to your Google Sheet!`);
}

function copyAppsScriptCode() {
    const code = document.getElementById('appsScriptSnippet').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Google Apps Script code copied to clipboard! Paste it into Google Sheets Script Editor.");
    }).catch(() => {
        alert("Please select and copy the code manually.");
    });
}

// -----------------------------------------------------------------------------
// VIEW 6B: BOOKING / INQUIRY CATEGORIES & DYNAMIC PRICING MANAGER
// -----------------------------------------------------------------------------
function renderAdminBookingTypes() {
    const tbody = document.getElementById('adminBookingTypesTableBody');
    if (!tbody) return;

    const types = window.rcaDB.getBookingTypes();

    if (!types || types.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--admin-text-dim); padding: 16px;">No categories configured.</td></tr>`;
        return;
    }

    tbody.innerHTML = types.map((item, index) => {
        const priceTxt = item.price > 0 ? `₹${item.price.toLocaleString('en-IN')}/-` : '<span style="color: #93c5fd;">Free / Inquire</span>';
        const labelTxt = item.label ? `<span style="font-size: 0.75rem; color: #cbd5e1; display: block;">${escapeHtml(item.label)}</span>` : '';
        const escapedName = (item.name || '').replace(/'/g, "\\'");
        const escapedLabel = (item.label || '').replace(/'/g, "\\'");
        return `
            <tr>
                <td><strong style="color: #fff;">${escapeHtml(item.name)}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div>
                            <span style="font-weight: 800; color: #4ade80;">${priceTxt}</span>
                            ${labelTxt}
                        </div>
                        <button onclick="openEditBookingTypePriceModal('${escapedName}', ${item.price || 0}, '${escapedLabel}')" class="btn btn-outline btn-sm" style="padding: 2px 7px; font-size: 0.7rem; border-color: var(--admin-gold); color: var(--admin-gold);" title="Edit Category Fee">
                            <i class="fa-solid fa-pen"></i> Edit Fee
                        </button>
                    </div>
                </td>
                <td><span class="slot-badge-available"><i class="fa-solid fa-circle-check"></i> Active on Website</span></td>
                <td>
                    <button onclick="handleDeleteBookingType(${index})" class="act-btn act-delete" title="Delete Category">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function handleAddBookingType(event) {
    event.preventDefault();
    const nameInput = document.getElementById('newBookingTypeName');
    const priceInput = document.getElementById('newBookingTypePrice');
    const labelInput = document.getElementById('newBookingTypeLabel');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    const price = parseInt(priceInput ? priceInput.value : 0) || 0;
    const label = labelInput ? labelInput.value.trim() : '';
    if (!name) return;

    const success = window.rcaDB.addBookingType(name, price, label);
    if (success) {
        nameInput.value = '';
        if (priceInput) priceInput.value = '';
        if (labelInput) labelInput.value = '';
        renderAdminBookingTypes();
        alert(`Booking category "${name}" (₹${price.toLocaleString('en-IN')}) added successfully! It is now active on the website.`);
    } else {
        alert("This category could not be added.");
    }
}

function handleDeleteBookingType(index) {
    const types = window.rcaDB.getBookingTypes();
    const item = types[index];
    if (!item) return;
    const typeName = item.name;
    if (confirm(`Are you sure you want to delete the category "${typeName}" from website forms?`)) {
        window.rcaDB.deleteBookingType(typeName);
        renderAdminBookingTypes();
    }
}

// -----------------------------------------------------------------------------
// UNIVERSAL PRICE & PRICING CONTROLLER (SLOTS, CATEGORIES, TOURNAMENTS)
// -----------------------------------------------------------------------------
function openEditSlotPriceModal(slotId) {
    const slots = window.rcaDB.getSlots();
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    
    document.getElementById('editPriceTargetType').value = 'slot';
    document.getElementById('editPriceTargetId').value = slot.id;
    document.getElementById('universalPriceItemNameLabel').textContent = 'Practice Slot Title';
    document.getElementById('universalPriceItemName').value = slot.title;
    document.getElementById('universalPriceValue').value = slot.price || 1500;
    document.getElementById('universalPriceExtraGroup').style.display = 'none';
    document.getElementById('universalPriceSubtitle').textContent = 'Update official session rate for this turf / practice slot.';
    showModal('universalPriceModal');
}

function openEditBookingTypePriceModal(typeName, currentPrice, currentLabel) {
    document.getElementById('editPriceTargetType').value = 'booking_type';
    document.getElementById('editPriceTargetId').value = typeName;
    document.getElementById('universalPriceItemNameLabel').textContent = 'Category / Inquiry Name';
    document.getElementById('universalPriceItemName').value = typeName;
    document.getElementById('universalPriceValue').value = currentPrice || 0;
    document.getElementById('universalPriceExtraGroup').style.display = 'block';
    document.getElementById('universalPriceExtraLabel').textContent = 'Fee Label (e.g. 2-Hour Slot, Per Match, Team Fee)';
    document.getElementById('universalPriceExtra').value = currentLabel || '';
    document.getElementById('universalPriceSubtitle').textContent = 'Update the fee shown when a player selects this inquiry type on the website.';
    showModal('universalPriceModal');
}

function openEditTournamentFeeModal(tourId) {
    const tournaments = window.rcaDB.getTournaments();
    const tour = tournaments.find(t => t.id === tourId);
    if (!tour) return;

    document.getElementById('editPriceTargetType').value = 'tournament';
    document.getElementById('editPriceTargetId').value = tour.id;
    document.getElementById('universalPriceItemNameLabel').textContent = 'Tournament / League Title';
    document.getElementById('universalPriceItemName').value = tour.title;
    document.getElementById('universalPriceValue').value = tour.trialFee || tour.teamFee || 0;
    document.getElementById('universalPriceExtraGroup').style.display = 'block';
    document.getElementById('universalPriceExtraLabel').textContent = 'Fee Badge Label (e.g. ₹1,499 Trial Fee or Team Entry ₹15,000)';
    document.getElementById('universalPriceExtra').value = tour.feeLabel || '';
    document.getElementById('universalPriceSubtitle').textContent = 'Update official trial / team fee for this cricket tournament.';
    showModal('universalPriceModal');
}

function handleUniversalPriceSubmit(event) {
    event.preventDefault();
    const targetType = document.getElementById('editPriceTargetType').value;
    const targetId = document.getElementById('editPriceTargetId').value;
    const price = parseInt(document.getElementById('universalPriceValue').value) || 0;
    const extra = document.getElementById('universalPriceExtra').value.trim();

    if (targetType === 'slot') {
        window.rcaDB.updateSlotPrice(targetId, price);
        renderAdminSlots();
        closeModal('universalPriceModal');
        alert(`Slot rate updated to ₹${price.toLocaleString('en-IN')}/-! It is now live on the website.`);
    } else if (targetType === 'booking_type') {
        window.rcaDB.updateBookingTypePrice(targetId, price, extra);
        renderAdminBookingTypes();
        closeModal('universalPriceModal');
        alert(`Pricing for category "${targetId}" updated to ₹${price.toLocaleString('en-IN')}/-!`);
    } else if (targetType === 'tournament') {
        window.rcaDB.updateTournamentFees(targetId, price, price, extra || `₹${price.toLocaleString('en-IN')}`);
        renderAdminTournaments();
        closeModal('universalPriceModal');
        alert(`Tournament fee updated to ₹${price.toLocaleString('en-IN')}/-!`);
    }
}

// Database Backup / Reset
function downloadDatabaseBackup() {
    const data = window.rcaDB.getRawData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RCA_Database_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function resetDatabaseDefaults() {
    if (confirm("Reset all data (bookings, tournaments, slots, gallery, notices) to original demo state?")) {
        window.rcaDB.resetToDefault();
        initDashboard();
        alert("Database reset to demo state.");
    }
}

// Modal Helpers
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('show');
        document.body.style.overflow = '';
    }
});

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------------------------------------------------------
// SUPABASE CLOUD DATABASE & STORAGE INTEGRATION CONTROLLER
// -----------------------------------------------------------------------------
function loadSupabaseSettings() {
    if (!window.rcaSupabase) return;
    const config = window.rcaSupabase.config;
    const urlInput = document.getElementById('sbProjectUrl');
    const keyInput = document.getElementById('sbAnonKey');
    const badge = document.getElementById('supabaseStatusBadge');

    if (urlInput && config.supabaseUrl) urlInput.value = config.supabaseUrl;
    if (keyInput && config.supabaseAnonKey) keyInput.value = config.supabaseAnonKey;

    if (badge) {
        if (window.rcaSupabase.isConfigured()) {
            badge.className = "status-pill status-Confirmed";
            badge.style.background = "rgba(62, 207, 142, 0.25)";
            badge.style.borderColor = "#3ecf8e";
            badge.style.color = "#3ecf8e";
            badge.innerHTML = `<i class="fa-solid fa-cloud-bolt"></i> Supabase Cloud Active & Connected`;
        } else {
            badge.className = "status-pill";
            badge.style.background = "rgba(245, 158, 11, 0.2)";
            badge.style.borderColor = "#f59e0b";
            badge.style.color = "#fbbf24";
            badge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> Offline LocalStorage Active (Supabase Not Connected)`;
        }
    }
}

async function handleSaveSupabaseConfig() {
    const urlInput = document.getElementById('sbProjectUrl');
    const keyInput = document.getElementById('sbAnonKey');
    if (!urlInput || !keyInput) return;

    const supabaseUrl = urlInput.value.trim();
    const supabaseAnonKey = keyInput.value.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        alert("Please provide both Supabase Project URL and Anon Public Key.");
        return;
    }

    if (window.rcaSupabase) {
        window.rcaSupabase.saveConfig({ supabaseUrl, supabaseAnonKey });
        loadSupabaseSettings();
        const synced = await window.rcaDB.syncFromSupabase();
        if (synced) {
            alert("✅ Supabase Cloud Connected successfully! All live data has been synchronized.");
        } else {
            alert("Configuration saved! Attempting initial cloud handshake...");
        }
    }
}

async function handleTestSupabaseConnection() {
    if (!window.rcaSupabase || !window.rcaSupabase.isConfigured()) {
        alert("Supabase is not configured yet. Please enter your Project URL and Anon Public Key above and click 'Save Supabase Cloud Settings'.");
        return;
    }

    const badge = document.getElementById('supabaseStatusBadge');
    if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Testing Supabase Cloud Handshake...`;
    }

    try {
        const success = await window.rcaDB.syncFromSupabase();
        loadSupabaseSettings();
        if (success) {
            alert("🎉 SUCCESS! RCA Database is successfully connected to Supabase Cloud.\n\nAll tournaments, slots, bookings, and images are live and synced!");
        } else {
            alert("⚠️ Connection handshake completed, but no tables were returned or an error occurred. Make sure you ran 'supabase_schema.sql' in your Supabase SQL Editor!");
        }
    } catch (err) {
        loadSupabaseSettings();
        alert(`❌ Connection test failed: ${err.message || err}`);
    }
}

function copySupabaseSchemaSql() {
    const sqlGuide = `-- RAM CRICKET ACADEMY (RCA) - SUPABASE CLOUD SCHEMA
-- Open your Supabase Dashboard -> SQL Editor -> New Query -> Paste this and click RUN!
-- Full schema is available in your project file: supabase_schema.sql`;
    
    fetch('supabase_schema.sql')
        .then(res => res.text())
        .then(sql => {
            navigator.clipboard.writeText(sql).then(() => {
                alert("✅ Full Supabase SQL Schema copied to clipboard!\n\nOpen your Supabase Dashboard -> SQL Editor -> New Query, paste and click 'Run'.");
            }).catch(() => {
                prompt("Copy this SQL schema:", sql);
            });
        })
        .catch(() => {
            navigator.clipboard.writeText(sqlGuide);
            alert("Please open 'supabase_schema.sql' from the project folder and paste into Supabase SQL Editor.");
        });
}

// -----------------------------------------------------------------------------
// COMMITTEE MEMBERS ADMIN CONTROLLERS (President, Owner, CEO, Coaches)
// -----------------------------------------------------------------------------
function renderAdminCommittee() {
    const tbody = document.getElementById('adminCommitteeTableBody');
    if (!tbody || !window.rcaDB) return;

    const list = window.rcaDB.getCommittee ? window.rcaDB.getCommittee() : [];
    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 24px; color: var(--admin-text-dim);">
                    No committee members added yet. Click "+ Add Committee Member" above.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(m => `
        <tr>
            <td>
                <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid var(--admin-gold); background: #000;">
                    <img src="${escapeHtml(m.photo || 'assets/images/logo.png')}" alt="${escapeHtml(m.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/images/logo.png'">
                </div>
            </td>
            <td>
                <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(m.name)}</strong>
            </td>
            <td>
                <span class="status-pill status-Confirmed" style="font-size: 0.78rem;">
                    <i class="fa-solid fa-id-badge"></i> ${escapeHtml(m.designation)}
                </span>
            </td>
            <td style="color: var(--admin-text-dim); font-size: 0.85rem; max-width: 280px;">
                ${escapeHtml(m.bio || '—')}
            </td>
            <td style="color: var(--admin-gold); font-weight: 700;">
                #${m.order || 1}
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="openEditCommitteeMemberModal('${m.id}')" title="Edit Member">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button type="button" class="btn btn-sm" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);" onclick="deleteAdminCommitteeMember('${m.id}')" title="Delete Member">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddCommitteeMemberModal() {
    const form = document.getElementById('committeeMemberForm');
    if (form) form.reset();
    document.getElementById('commMemberId').value = '';
    document.getElementById('commModalTitle').textContent = 'Add Committee Member';
    const currentList = window.rcaDB.getCommittee ? window.rcaDB.getCommittee() : [];
    document.getElementById('commMemberOrder').value = currentList.length + 1;
    showModal('committeeMemberModal');
}

function openEditCommitteeMemberModal(id) {
    if (!window.rcaDB || !window.rcaDB.getCommitteeMember) return;
    const member = window.rcaDB.getCommitteeMember(id);
    if (!member) return;

    const form = document.getElementById('committeeMemberForm');
    if (form) form.reset();

    document.getElementById('commMemberId').value = member.id;
    document.getElementById('commModalTitle').textContent = `Edit: ${member.name}`;
    document.getElementById('commMemberName').value = member.name || '';
    document.getElementById('commMemberRole').value = member.designation || '';
    document.getElementById('commMemberPhotoUrl').value = member.photo || '';
    document.getElementById('commMemberBio').value = member.bio || '';
    document.getElementById('commMemberOrder').value = member.order || 1;

    showModal('committeeMemberModal');
}

async function handleCommitteeMemberSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('commMemberId').value.trim();
    const name = document.getElementById('commMemberName').value.trim();
    const designation = document.getElementById('commMemberRole').value.trim();
    const urlInput = document.getElementById('commMemberPhotoUrl').value.trim();
    const fileInput = document.getElementById('commMemberPhotoFile');
    const bio = document.getElementById('commMemberBio').value.trim();
    const order = parseInt(document.getElementById('commMemberOrder').value) || 1;

    if (!name || !designation) {
        alert("Please provide member name and designation.");
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const saveRecord = (photoUrl) => {
        const payload = {
            name,
            designation,
            photo: photoUrl || urlInput || 'assets/images/logo.png',
            bio,
            order
        };

        if (id) {
            window.rcaDB.updateCommitteeMember(id, payload);
        } else {
            window.rcaDB.addCommitteeMember(payload);
        }

        if (submitBtn) submitBtn.innerHTML = origText;
        closeModal('committeeMemberModal');
        renderAdminCommittee();
        alert(`Committee member '${name}' saved successfully!`);
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            try {
                const cdnUrl = await window.rcaSupabase.uploadImage(file, 'committee');
                if (cdnUrl) {
                    saveRecord(cdnUrl);
                    return;
                }
            } catch (err) {
                console.warn("Supabase upload fallback to dataURL:", err);
            }
        }
        const reader = new FileReader();
        reader.onload = (e) => saveRecord(e.target.result);
        reader.readAsDataURL(file);
    } else {
        saveRecord(urlInput || 'assets/images/logo.png');
    }
}

function deleteAdminCommitteeMember(id) {
    const member = window.rcaDB.getCommitteeMember ? window.rcaDB.getCommitteeMember(id) : null;
    const name = member ? member.name : 'this member';
    if (!confirm(`Are you sure you want to delete ${name} from the Committee?`)) {
        return;
    }
    window.rcaDB.deleteCommitteeMember(id);
    renderAdminCommittee();
    alert(`${name} removed from committee list.`);
}

// -----------------------------------------------------------------------------
// SPONSORS & PARTNERS ADMIN CONTROLLERS
// -----------------------------------------------------------------------------
function renderAdminSponsors() {
    const tbody = document.getElementById('adminSponsorsTableBody');
    if (!tbody || !window.rcaDB) return;

    const list = window.rcaDB.getSponsors ? window.rcaDB.getSponsors() : [];
    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: var(--admin-text-dim);">
                    No sponsors added yet. Click "+ Add Official Sponsor" above.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td>
                <div style="width: 60px; height: 40px; border-radius: 6px; overflow: hidden; border: 1px solid var(--admin-border); background: #000; padding: 2px;">
                    <img src="${escapeHtml(s.logo || 'assets/images/logo.png')}" alt="${escapeHtml(s.name)}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='assets/images/logo.png'">
                </div>
            </td>
            <td>
                <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(s.name)}</strong>
            </td>
            <td>
                <span class="status-pill status-Confirmed" style="font-size: 0.78rem;">
                    <i class="fa-solid fa-ribbon"></i> ${escapeHtml(s.designation)}
                </span>
            </td>
            <td>
                <span style="color: #93c5fd; font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.city || 'Vrindavan')}</span>
            </td>
            <td style="color: var(--admin-text-dim); font-size: 0.85rem; max-width: 260px;">
                ${escapeHtml(s.shortInfo || '—')}
            </td>
            <td style="color: var(--admin-gold); font-weight: 700;">
                #${s.order || 1}
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="openEditSponsorModal('${s.id}')" title="Edit Sponsor">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button type="button" class="btn btn-sm" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);" onclick="deleteAdminSponsor('${s.id}')" title="Delete Sponsor">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddSponsorModal() {
    const form = document.getElementById('sponsorForm');
    if (form) form.reset();
    document.getElementById('sponId').value = '';
    document.getElementById('sponModalTitle').textContent = 'Add Official Sponsor';
    const currentList = window.rcaDB.getSponsors ? window.rcaDB.getSponsors() : [];
    document.getElementById('sponOrder').value = currentList.length + 1;
    showModal('sponsorModal');
}

function openEditSponsorModal(id) {
    if (!window.rcaDB || !window.rcaDB.getSponsor) return;
    const sponsor = window.rcaDB.getSponsor(id);
    if (!sponsor) return;

    const form = document.getElementById('sponsorForm');
    if (form) form.reset();

    document.getElementById('sponId').value = sponsor.id;
    document.getElementById('sponModalTitle').textContent = `Edit: ${sponsor.name}`;
    document.getElementById('sponName').value = sponsor.name || '';
    document.getElementById('sponRole').value = sponsor.designation || '';
    document.getElementById('sponCity').value = sponsor.city || '';
    document.getElementById('sponInfo').value = sponsor.shortInfo || '';
    document.getElementById('sponLogoUrl').value = sponsor.logo || '';
    document.getElementById('sponOrder').value = sponsor.order || 1;

    showModal('sponsorModal');
}

async function handleSponsorSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('sponId').value.trim();
    const name = document.getElementById('sponName').value.trim();
    const designation = document.getElementById('sponRole').value.trim();
    const city = document.getElementById('sponCity').value.trim();
    const shortInfo = document.getElementById('sponInfo').value.trim();
    const urlInput = document.getElementById('sponLogoUrl').value.trim();
    const fileInput = document.getElementById('sponLogoFile');
    const order = parseInt(document.getElementById('sponOrder').value) || 1;

    if (!name || !designation || !shortInfo) {
        alert("Please fill in Sponsor Name, Designation, and Short Information.");
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const saveRecord = (logoUrl) => {
        const payload = {
            name,
            designation,
            city: city || 'Vrindavan / Mathura',
            shortInfo,
            logo: logoUrl || urlInput || 'assets/images/logo.png',
            order
        };

        if (id) {
            window.rcaDB.updateSponsor(id, payload);
        } else {
            window.rcaDB.addSponsor(payload);
        }

        if (submitBtn) submitBtn.innerHTML = origText;
        closeModal('sponsorModal');
        renderAdminSponsors();
        alert(`Sponsor '${name}' saved successfully!`);
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (window.rcaSupabase && window.rcaSupabase.isConfigured()) {
            try {
                const cdnUrl = await window.rcaSupabase.uploadImage(file, 'sponsors');
                if (cdnUrl) {
                    saveRecord(cdnUrl);
                    return;
                }
            } catch (err) {
                console.warn("Supabase sponsor logo upload fallback:", err);
            }
        }
        const reader = new FileReader();
        reader.onload = (e) => saveRecord(e.target.result);
        reader.readAsDataURL(file);
    } else {
        saveRecord(urlInput || 'assets/images/logo.png');
    }
}

function deleteAdminSponsor(id) {
    const sponsor = window.rcaDB.getSponsor ? window.rcaDB.getSponsor(id) : null;
    const name = sponsor ? sponsor.name : 'this sponsor';
    if (!confirm(`Are you sure you want to delete ${name} from Sponsors?`)) {
        return;
    }
    window.rcaDB.deleteSponsor(id);
    renderAdminSponsors();
    alert(`${name} removed from sponsors list.`);
}

// -----------------------------------------------------------------------------
// ABOUT FOUNDER PROFILE (COACH R.K. CHAUHAN) ADMIN CONTROLLER
// -----------------------------------------------------------------------------
function renderAdminAboutProfile() {
    if (!window.rcaDB || !window.rcaDB.getAboutProfile) return;
    const prof = window.rcaDB.getAboutProfile();
    if (!prof) return;

    const elHeadCoach = document.getElementById('profHeadCoach');
    const elTitle = document.getElementById('profTitle');
    const elYears = document.getElementById('profYearsExp');
    const elPhone = document.getElementById('profPhone');
    const elInsta = document.getElementById('profInstagramUrl');
    const elQuote = document.getElementById('profQuote');
    const elBio = document.getElementById('profBio');

    if (elHeadCoach) elHeadCoach.value = prof.headCoach || '';
    if (elTitle) elTitle.value = prof.title || '';
    if (elYears) elYears.value = prof.yearsExp || '8+';
    if (elPhone) elPhone.value = prof.phone || '9897517704';
    if (elInsta) elInsta.value = prof.instagramUrl || '';
    if (elQuote) elQuote.value = prof.quote || '';
    if (elBio) elBio.value = prof.bio || '';
}

function handleAdminAboutProfileSubmit(event) {
    event.preventDefault();
    if (!window.rcaDB || !window.rcaDB.updateAboutProfile) return;

    const headCoach = document.getElementById('profHeadCoach').value.trim();
    const title = document.getElementById('profTitle').value.trim();
    const yearsExp = document.getElementById('profYearsExp').value.trim();
    const phone = document.getElementById('profPhone').value.trim();
    const instagramUrl = document.getElementById('profInstagramUrl').value.trim();
    const quote = document.getElementById('profQuote').value.trim();
    const bio = document.getElementById('profBio').value.trim();

    window.rcaDB.updateAboutProfile({
        headCoach,
        title,
        yearsExp,
        phone,
        instagramUrl,
        quote,
        bio
    });

    alert("✅ Coach R.K. Chauhan Founder Profile updated successfully on the live website!");
}
