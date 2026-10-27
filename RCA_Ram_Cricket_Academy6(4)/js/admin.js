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
            renderBookingsTable();
            renderAdminTournaments();
            renderAdminSlots();
            renderAdminGallery();
            renderAdminNotices();
            renderAdminBookingTypes();
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
    updateMetrics();
    renderBookingsTable();
    renderAdminTournaments();
    renderAdminSlots();
    renderAdminGallery();
    renderAdminNotices();
    renderAdminBookingTypes();
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
        bookingsView: "Slot Bookings & Registrations",
        tournamentsView: "Tournaments & Leagues Manager",
        slotsView: "Slots & Sold Out Availability",
        galleryView: "Photo Showcase Manager",
        noticesView: "Announcements & Notices",
        settingsView: "Settings & Google Sheet"
    };

    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle && titleMap[viewId]) {
        topbarTitle.textContent = titleMap[viewId];
    }

    // Close mobile drawer on navigation
    closeAdminSidebar();

    // Scroll to top of main view smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Top Metric Stat Cards
function updateMetrics() {
    const bookings = window.rcaDB.getBookings();
    const tournaments = window.rcaDB.getTournaments();

    const total = bookings.length;
    const newCount = bookings.filter(b => b.status === 'New').length;
    const confirmedCount = bookings.filter(b => b.status === 'Confirmed').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statNew').textContent = newCount;
    document.getElementById('statConfirmed').textContent = confirmedCount;
    document.getElementById('statTournaments').textContent = tournaments.length;

    const sidebarBadge = document.getElementById('sidebarBookingBadge');
    if (sidebarBadge) {
        sidebarBadge.textContent = newCount > 0 ? `${newCount} New` : total;
    }

    const tourBadge = document.getElementById('sidebarTournamentsBadge');
    if (tourBadge) {
        tourBadge.textContent = tournaments.length;
    }
}

// -----------------------------------------------------------------------------
// VIEW 1: BOOKINGS & REGISTRATIONS MANAGER
// -----------------------------------------------------------------------------
function renderBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    let bookings = window.rcaDB.getBookings();

    // Apply Status Filter
    if (currentFilter !== 'All') {
        bookings = bookings.filter(b => b.status === currentFilter);
    }

    // Apply Search Query
    if (currentSearch.trim() !== '') {
        const q = currentSearch.toLowerCase();
        bookings = bookings.filter(b => 
            (b.name && b.name.toLowerCase().includes(q)) ||
            (b.phone && b.phone.includes(q)) ||
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.city && b.city.toLowerCase().includes(q)) ||
            (b.bookingType && b.bookingType.toLowerCase().includes(q))
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
                <td><strong style="color: var(--admin-gold);">${b.id}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #fff;">${escapeHtml(b.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-dim);">
                        Age: ${b.age} ${b.fatherName && b.fatherName !== '-' ? '• S/o ' + escapeHtml(b.fatherName) : ''}
                    </div>
                </td>
                <td>
                    <span style="background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.35); padding: 3px 8px; border-radius: 6px; font-size: 0.82rem; color: var(--admin-gold-light); font-weight: 700;">
                        <i class="fa-solid fa-users"></i> ${escapeHtml(b.totalPersons || '1 Player')}
                    </span>
                </td>
                <td>
                    <div><a href="tel:${b.phone}" style="color: var(--admin-gold-light); font-weight: 600;"><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${b.phone}</a></div>
                    <div style="font-size: 0.78rem; color: #baa3d6;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.city)}</div>
                </td>
                <td>
                    <span style="font-size: 0.82rem; background: rgba(70, 20, 115, 0.4); border: 1px solid rgba(212, 175, 55, 0.3); padding: 4px 8px; border-radius: 4px; color: #fff; display: inline-block;">
                        ${escapeHtml(b.bookingType)}
                    </span>
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
    currentSearch = document.getElementById('bookingSearchInput').value;
    renderBookingsTable();
}

function updateStatus(bookingId, newStatus) {
    window.rcaDB.updateBookingStatus(bookingId, newStatus);
    updateMetrics();
    renderBookingsTable();
}

function deleteBookingRow(bookingId) {
    if (confirm(`Are you sure you want to delete registration ${bookingId}?`)) {
        window.rcaDB.deleteBooking(bookingId);
        updateMetrics();
        renderBookingsTable();
    }
}

function viewPlayerSlip(bookingId) {
    const bookings = window.rcaDB.getBookings();
    const b = bookings.find(item => item.id === bookingId);
    if (!b) return;

    const modalContent = document.getElementById('slipModalContent');
    modalContent.innerHTML = `
        <div class="success-pass" style="margin: 0;">
            <div class="success-pass-header">
                <div>
                    <div style="font-size: 0.72rem; color: var(--admin-gold-light); font-weight: 700;">RAM CRICKET ACADEMY • OFFICIAL REGISTRATION</div>
                    <div class="pass-id">${b.id}</div>
                </div>
                <img src="assets/images/logo.png" alt="RCA" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--admin-gold);">
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
                        ${Object.entries(b.formData).map(([k, v]) => `
                            <div>
                                <span class="pass-label">${escapeHtml(k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))}:</span>
                                <div class="pass-value" style="color: #a7f3d0;">${escapeHtml(String(v))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="margin-top: 12px; font-size: 0.75rem; color: #baa3d6;">
                Recorded At: ${b.createdAt} • Ground: Panigaon Raya Road / Garun Govind Road, Vrindavan
            </div>
        </div>
    `;

    showModal('viewSlipModal');
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

                <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.25);">
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
// VIEW 3: SLOTS & AVAILABILITY MANAGER (SOLD OUT TOGGLE)
// -----------------------------------------------------------------------------
function renderAdminSlots() {
    const tbody = document.getElementById('adminSlotsTableBody');
    if (!tbody) return;

    const slots = window.rcaDB.getSlots();

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

        return `
            <tr>
                <td><strong style="color: #fff;">${escapeHtml(s.title)}</strong></td>
                <td><span style="color: var(--admin-gold-light); font-weight: 500;"><i class="fa-regular fa-clock"></i> ${escapeHtml(s.time)}</span></td>
                <td><span style="color: var(--admin-text-dim);">${escapeHtml(s.facility)}</span></td>
                <td><strong style="color: #fff;">₹${s.price}/-</strong></td>
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

function toggleSlotStatus(slotId, targetStatus) {
    window.rcaDB.toggleSlotAvailability(slotId, targetStatus);
    renderAdminSlots();
    const msg = targetStatus ? "Slot marked as AVAILABLE on website!" : "Slot marked as SOLD OUT on website!";
    alert(msg);
}

function handleCustomSlotSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('customSlotTitle').value.trim();
    const time = document.getElementById('customSlotTime').value.trim();
    const facility = document.getElementById('customSlotFacility').value.trim();
    const price = document.getElementById('customSlotPrice').value;
    const amenitiesRaw = document.getElementById('customSlotAmenities').value.trim();

    const amenities = amenitiesRaw ? amenitiesRaw.split(',').map(a => a.trim()).filter(Boolean) : ["Turf Pitch", "Coach Supervision"];

    window.rcaDB.addCustomSlot({
        title,
        time,
        facility,
        price,
        amenities
    });

    document.getElementById('addCustomSlotForm').reset();
    renderAdminSlots();
    alert("New practice slot created and live on website!");
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
    const s = window.rcaDB.getSettings();
    document.getElementById('setPhone').value = s.phone;
    if (document.getElementById('setAltPhone')) {
        document.getElementById('setAltPhone').value = s.phoneAlternate || '8265800805';
    }
    document.getElementById('setCoach').value = s.headCoach;
    document.getElementById('setEmail').value = s.email;
    document.getElementById('setAdminEmail').value = s.adminNotifyEmail;
    document.getElementById('setInstagram').value = s.instagramUrl;
    document.getElementById('setAddress').value = s.address;

    const sheetInput = document.getElementById('sheetWebhookUrl');
    if (sheetInput) {
        sheetInput.value = s.googleSheetWebhookUrl || '';
    }
}

function handleSettingsUpdate(event) {
    event.preventDefault();
    const newSettings = {
        phone: document.getElementById('setPhone').value.trim(),
        phoneAlternate: document.getElementById('setAltPhone') ? document.getElementById('setAltPhone').value.trim() : '8265800805',
        headCoach: document.getElementById('setCoach').value.trim(),
        email: document.getElementById('setEmail').value.trim(),
        adminNotifyEmail: document.getElementById('setAdminEmail').value.trim(),
        instagramUrl: document.getElementById('setInstagram').value.trim(),
        address: document.getElementById('setAddress').value.trim()
    };

    window.rcaDB.updateSettings(newSettings);
    alert("Academy settings saved successfully!");
}

function saveGoogleSheetWebhook() {
    const url = document.getElementById('sheetWebhookUrl').value.trim();
    window.rcaDB.updateSettings({ googleSheetWebhookUrl: url });
    alert("Google Sheets Webhook URL saved successfully! Future registrations will sync automatically.");
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
// VIEW 6B: BOOKING / INQUIRY CATEGORIES MANAGER (ADD / DELETE)
// -----------------------------------------------------------------------------
function renderAdminBookingTypes() {
    const tbody = document.getElementById('adminBookingTypesTableBody');
    if (!tbody) return;

    const types = window.rcaDB.getBookingTypes();

    if (!types || types.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--admin-text-dim); padding: 16px;">No categories configured.</td></tr>`;
        return;
    }

    tbody.innerHTML = types.map((typeName, index) => `
        <tr>
            <td><strong style="color: #fff;">${escapeHtml(typeName)}</strong></td>
            <td><span class="slot-badge-available"><i class="fa-solid fa-circle-check"></i> Active on Website</span></td>
            <td>
                <button onclick="handleDeleteBookingType(${index})" class="act-btn act-delete" title="Delete Category">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function handleAddBookingType(event) {
    event.preventDefault();
    const input = document.getElementById('newBookingTypeName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    const success = window.rcaDB.addBookingType(name);
    if (success) {
        input.value = '';
        renderAdminBookingTypes();
        alert(`Booking category "${name}" added successfully! It is now active on the website.`);
    } else {
        alert("This category already exists or could not be added.");
    }
}

function handleDeleteBookingType(index) {
    const types = window.rcaDB.getBookingTypes();
    const typeName = types[index];
    if (!typeName) return;
    if (confirm(`Are you sure you want to delete the category "${typeName}" from website forms?`)) {
        window.rcaDB.deleteBookingType(typeName);
        renderAdminBookingTypes();
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
