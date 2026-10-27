/**
 * RCA (RAM CRICKET ACADEMY) - Main Interactive Script
 * Handles public site interactions, gallery filters, dynamic notices, dynamic tournaments,
 * live slot availability (available vs sold out), popup slot booking modal, RRPL trial registration,
 * custom flexible slot booking, WhatsApp connect, and registration pass generation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initDateInputs();
    renderBookingTypeDropdowns();
    renderTournaments();
    renderSlots();
    renderGallery('All');
    renderNotices();

    // Live update when Supabase Cloud syncs
    window.addEventListener('rcaDataUpdated', () => {
        console.log("⚡ [Homepage] Re-rendering live data from Supabase Cloud update...");
        renderBookingTypeDropdowns();
        renderTournaments();
        renderSlots();
        renderGallery('All');
        renderNotices();
    });

    // Fetch freshest cloud data from Supabase immediately on load
    if (window.rcaDB) {
        window.rcaDB.syncFromSupabase();
    }

    // Attach real-time 10-digit mobile number validation
    attachPhoneInputValidator('rrplPhone', 'rrplPhoneError');
    attachPhoneInputValidator('playerPhone', 'playerPhoneError');
    attachPhoneInputValidator('popupPlayerPhone', 'popupPlayerPhoneError');
});

/**
 * Generic Dynamic Form Extractor
 * Extracts all input, select, textarea elements from any form.
 * Maps standard keys if present, and bundles all other fields into `formData` object.
 * Enables adding or deleting form fields, or creating new forms without breaking anything!
 */
function extractDynamicFormData(formElement, defaultFormType = 'custom_form') {
    if (!formElement) return { formType: defaultFormType, formData: {} };
    const result = {
        formType: defaultFormType,
        formData: {}
    };

    const standardKeyMap = {
        name: 'name',
        playername: 'name',
        fullname: 'name',
        phone: 'phone',
        playerphone: 'phone',
        contact: 'phone',
        email: 'email',
        playeremail: 'email',
        city: 'city',
        playercity: 'city',
        age: 'age',
        playerage: 'age',
        fathername: 'fatherName',
        father: 'fatherName',
        guardian: 'fatherName',
        role: 'role',
        playerrole: 'role',
        totalpersons: 'totalPersons',
        persons: 'totalPersons',
        bookingtype: 'bookingType',
        reason: 'bookingType',
        type: 'bookingType',
        slotdate: 'slotDate',
        date: 'slotDate',
        timeslot: 'timeSlot',
        customtime: 'timeSlot',
        time: 'timeSlot',
        remarks: 'remarks',
        playerremarks: 'remarks',
        message: 'remarks'
    };

    const elements = formElement.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
        const key = el.name || el.id;
        if (!key) return;
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const val = el.value !== undefined ? el.value.trim() : '';

        if (standardKeyMap[normalizedKey]) {
            const mappedField = standardKeyMap[normalizedKey];
            if (!result[mappedField] || result[mappedField] === '-' || result[mappedField] === 'Vrindavan') {
                result[mappedField] = val;
            }
        } else {
            // Any new or custom field added now or in the future!
            if (val !== '') {
                result.formData[key] = val;
            }
        }
    });

    return result;
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

    inputElementBlurHandler(input, errorEl);
}

function inputElementBlurHandler(input, errorEl) {
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

// Sticky Header & Active Nav on Scroll
function initHeaderScroll() {
    const header = document.getElementById('header');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Active link indicator
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.offsetHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// -----------------------------------------------------------------------------
// RIGHT-SIDE SLIDING SIDEBAR DRAWER CONTROLS (User Requested)
// -----------------------------------------------------------------------------
function openRightSidebar() {
    const sidebar = document.getElementById('rightSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeRightSidebar() {
    const sidebar = document.getElementById('rightSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function toggleRightSidebar() {
    const sidebar = document.getElementById('rightSidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        closeRightSidebar();
    } else {
        openRightSidebar();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeRightSidebar();
    }
});

// Set Minimum Date to Today for Slot Booking (both popup and inline forms)
function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('slotDate');
    const popupDateInput = document.getElementById('popupSlotDate');

    if (dateInput) {
        dateInput.min = today;
        if (!dateInput.value) dateInput.value = today;
    }
    if (popupDateInput) {
        popupDateInput.min = today;
        if (!popupDateInput.value) popupDateInput.value = today;
    }
}

// -----------------------------------------------------------------------------
// DYNAMIC BOOKING TYPES / CATEGORIES POPULATION
// -----------------------------------------------------------------------------
function renderBookingTypeDropdowns() {
    if (!window.rcaDB) return;
    const types = window.rcaDB.getBookingTypes();

    const optionsHtml = types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    const inlineSelect = document.getElementById('bookingType');
    if (inlineSelect) {
        inlineSelect.innerHTML = optionsHtml;
    }

    const popupSelect = document.getElementById('popupBookingType');
    if (popupSelect) {
        popupSelect.innerHTML = optionsHtml;
    }
}

// -----------------------------------------------------------------------------
// BOOKING POPUP MODAL (User Requested)
// -----------------------------------------------------------------------------
function openBookingModal(prefillType = '', prefillTime = '') {
    initDateInputs();
    renderBookingTypeDropdowns();

    const popupBookingType = document.getElementById('popupBookingType');
    const popupCustomTime = document.getElementById('popupCustomTime');

    if (prefillType && popupBookingType) {
        popupBookingType.value = prefillType;
    }
    if (prefillTime && popupCustomTime) {
        popupCustomTime.value = prefillTime;
    }

    showModal('slotBookingModal');

    const nameInput = document.getElementById('popupPlayerName');
    if (nameInput) setTimeout(() => nameInput.focus(), 300);
}

function handlePopupBookingSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const dynamic = extractDynamicFormData(form, 'slot_booking_popup');

    const name = document.getElementById('popupPlayerName').value.trim();
    const phone = document.getElementById('popupPlayerPhone').value.trim();
    const totalPersons = document.getElementById('popupTotalPersons').value;
    const age = document.getElementById('popupPlayerAge') ? document.getElementById('popupPlayerAge').value.trim() : "";
    const bookingType = document.getElementById('popupBookingType').value;
    const slotDate = document.getElementById('popupSlotDate').value;
    const customTime = document.getElementById('popupCustomTime').value.trim();
    const city = document.getElementById('popupPlayerCity').value.trim();
    const remarks = document.getElementById('popupPlayerRemarks').value.trim();

    if (!name || !phone || !slotDate) {
        alert("Please fill in all required fields!");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById('popupPlayerPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    const bookingInput = {
        name,
        age: age || "-",
        fatherName: "-",
        phone,
        email: dynamic.email || "",
        city: city || "Vrindavan",
        role: dynamic.role || "Player / Team Member",
        totalPersons,
        bookingType,
        slotDate,
        timeSlot: customTime || "Flexible Time",
        facilityType: "Turf / Cement Grounds",
        remarks,
        formType: 'slot_booking_popup',
        formData: dynamic.formData || {}
    };

    const savedBooking = window.rcaDB.addBooking(bookingInput);

    if (savedBooking) {
        closeModal('slotBookingModal');
        displayPassModal(savedBooking, "SLOT RESERVATION PASS");
        document.getElementById('popupBookingForm').reset();
        const errEl = document.getElementById('popupPlayerPhoneError');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        initDateInputs();
        document.getElementById('popupPlayerCity').value = 'Vrindavan';
        document.getElementById('popupCustomTime').value = '06:30 AM - 08:30 AM';
    } else {
        alert("There was an issue saving your booking. Please call Coach Chauhan directly at +91 9897517704.");
    }
}

// -----------------------------------------------------------------------------
// DYNAMIC TOURNAMENTS & CHAMPIONSHIPS
// -----------------------------------------------------------------------------
function renderTournaments() {
    const container = document.getElementById('tournamentsContainer');
    if (!container || !window.rcaDB) return;

    const tournaments = window.rcaDB.getTournaments();

    if (!tournaments || tournaments.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-trophy" style="font-size: 2.5rem; color: var(--gold); margin-bottom: 12px; display: block;"></i>
                <p>New tournaments will be announced shortly. Stay tuned!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tournaments.map(t => {
        const isRrpl = t.id.includes('rrpl') || t.title.toLowerCase().includes('radha rani');
        const ctaAction = isRrpl 
            ? `scrollToRrpl()` 
            : `selectTournamentBooking('${escapeHtml(t.title)}')`;
        const ctaText = isRrpl 
            ? `<i class="fa-solid fa-trophy"></i> Register for RRPL Trials (₹1,499)`
            : `<i class="fa-solid fa-ticket"></i> Enter Tournament (${t.feeLabel || 'Register'})`;

        return `
            <div class="tournament-card">
                <div class="tournament-poster-wrap" onclick="openLightbox('${t.poster}', '${escapeHtml(t.title)}', '${escapeHtml(t.dates || '')}')">
                    <img src="${t.poster}" alt="${escapeHtml(t.title)}" class="tournament-poster-img" onerror="this.src='assets/images/tournaments/ram-sports-cup-7th.jpg'">
                    <span class="gallery-category-badge" style="top: 14px; left: 14px; background: rgba(36, 8, 60, 0.9); border: 1px solid var(--gold);">${t.category || 'Cricket Championship'}</span>
                    <span class="gallery-category-badge" style="top: 14px; right: 14px; left: auto; background: var(--gold-gradient); color: #000; font-weight: 800;">${t.feeLabel || 'Official Event'}</span>
                </div>
                <div class="tournament-body">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 0.8rem; color: var(--gold-200); font-weight: 700;">
                                <i class="fa-solid fa-calendar-days"></i> ${t.dates || 'Upcoming'}
                            </span>
                            <span style="font-size: 0.78rem; color: #4ade80; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); padding: 2px 8px; border-radius: 12px;">
                                ${t.status || 'Registration Open'}
                            </span>
                        </div>
                        <h3 style="font-size: 1.35rem; color: #fff; line-height: 1.3; margin-bottom: 10px;">
                            ${escapeHtml(t.title)}
                        </h3>
                        <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                            ${escapeHtml(t.description || '')}
                        </p>

                        <div class="prize-pill-group">
                            ${t.winnerPrize ? `<span class="prize-pill featured"><i class="fa-solid fa-trophy"></i> Winner: ${t.winnerPrize}</span>` : ''}
                            ${t.runnerPrize ? `<span class="prize-pill"><i class="fa-solid fa-medal"></i> Runner: ${t.runnerPrize}</span>` : ''}
                            ${t.playerOfSeries ? `<span class="prize-pill"><i class="fa-solid fa-motorcycle"></i> ${t.playerOfSeries}</span>` : ''}
                        </div>

                        ${t.specialAwards ? `
                            <div style="font-size: 0.8rem; color: #baa3d6; margin-bottom: 10px; line-height: 1.4;">
                                <strong>Special Honors:</strong> ${escapeHtml(t.specialAwards)}
                            </div>
                        ` : ''}

                        <div style="font-size: 0.8rem; color: var(--gold-200); margin-bottom: 16px;">
                            <i class="fa-solid fa-location-dot"></i> Venue: ${escapeHtml(t.venue || 'RCA Ground Vrindavan')}
                        </div>
                    </div>

                    <button onclick="${ctaAction}" class="btn btn-gold" style="width: 100%; font-size: 0.95rem; padding: 12px;">
                        ${ctaText}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function scrollToRrpl() {
    const el = document.getElementById('rrplSection');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        const nameInput = document.getElementById('rrplName');
        if (nameInput) setTimeout(() => nameInput.focus(), 600);
    }
}

function selectTournamentBooking(tournamentTitle) {
    let inferredType = 'RAM SPORTS CUP 7th (Team Entry ₹15,000)';
    if (tournamentTitle.toLowerCase().includes('rrpl')) {
        inferredType = 'RRPL Trial Registration (₹1,499)';
    }

    openBookingModal(inferredType, 'Morning Batch');

    // Also update bottom inline form if user scrolls down
    const inlineType = document.getElementById('bookingType');
    const inlineRemarks = document.getElementById('playerRemarks');
    if (inlineType) inlineType.value = inferredType;
    if (inlineRemarks) inlineRemarks.value = `Registering for: ${tournamentTitle}.`;
}

// -----------------------------------------------------------------------------
// DYNAMIC SLOTS & AVAILABILITY (AVAILABLE VS SOLD OUT)
// -----------------------------------------------------------------------------
function renderSlots() {
    const container = document.getElementById('slotsDisplayContainer');
    if (!container || !window.rcaDB) return;

    const slots = window.rcaDB.getSlots();

    if (!slots || slots.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">
                Slots data updating. Please call directly for live availability.
            </div>
        `;
        return;
    }

    container.innerHTML = slots.map(slot => {
        const isAvail = slot.isAvailable !== false;
        const cardClass = isAvail ? 'slot-card' : 'slot-card sold-out';
        const badge = isAvail 
            ? `<span class="slot-badge-available"><i class="fa-solid fa-circle-check"></i> AVAILABLE</span>`
            : `<span class="slot-badge-sold-out"><i class="fa-solid fa-ban"></i> SOLD OUT</span>`;

        // Direct popup opener when clicking Book This Slot (User Requested)
        const actionBtn = isAvail
            ? `<button onclick="selectSlot('${escapeHtml(slot.title)}', '${escapeHtml(slot.time)}')" class="btn btn-gold btn-sm" style="width: 100%;">
                    <i class="fa-solid fa-check"></i> Book This Slot
               </button>`
            : `<button class="btn btn-disabled btn-sm" style="width: 100%;" disabled>
                    <i class="fa-solid fa-lock"></i> Slot Full / Sold Out
               </button>`;

        const amenitiesList = (slot.amenities || []).map(a => `<li><span>✔</span> ${escapeHtml(a)}</li>`).join('');

        return `
            <div class="${cardClass}">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                        <h4 style="font-size: 1.15rem; color: #fff; line-height: 1.3;">${escapeHtml(slot.title)}</h4>
                        ${badge}
                    </div>

                    <div style="background: rgba(15, 3, 25, 0.6); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
                        <div style="font-size: 0.85rem; color: var(--gold-200); font-weight: 700;">
                            <i class="fa-solid fa-clock"></i> ${escapeHtml(slot.time)}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                            <i class="fa-solid fa-shield-halved"></i> ${escapeHtml(slot.facility || 'Turf Facility')}
                        </div>
                    </div>

                    <ul class="training-features" style="margin-bottom: 18px; font-size: 0.85rem;">
                        ${amenitiesList}
                    </ul>
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.25);">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Est. Session Rate:</span>
                        <span style="font-size: 1.15rem; font-weight: 800; color: #fff;">₹${slot.price}/-</span>
                    </div>
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

// When clicking "Book This Slot", directly open the registration form popup (User Requested)
function selectSlot(title, time) {
    let inferredType = 'Turf Net Practice Slot';
    if (title.toLowerCase().includes('match')) {
        inferredType = 'Full Ground Match Booking';
    } else if (title.toLowerCase().includes('machine')) {
        inferredType = 'Bowling Machine Practice';
    }

    // Open popup directly
    openBookingModal(inferredType, time && !time.toLowerCase().includes('flexible') ? time : '06:30 AM - 08:30 AM');

    // Also update bottom inline form in case user scrolls down
    const inlineTime = document.getElementById('customTime');
    const inlineType = document.getElementById('bookingType');
    if (inlineTime && time && !time.toLowerCase().includes('flexible')) {
        inlineTime.value = time;
    }
    if (inlineType) {
        inlineType.value = inferredType;
    }
}

// -----------------------------------------------------------------------------
// DYNAMIC GALLERY
// -----------------------------------------------------------------------------
function renderGallery(filterCategory = 'All') {
    const container = document.getElementById('galleryContainer');
    if (!container || !window.rcaDB) return;

    const items = window.rcaDB.getGallery();
    const filtered = filterCategory === 'All' 
        ? items 
        : items.filter(item => item.category.toLowerCase() === filterCategory.toLowerCase());

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-regular fa-image" style="font-size: 2.5rem; color: var(--gold); margin-bottom: 12px; display: block;"></i>
                <p>No photos in this category yet. Check back soon!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => `
        <div class="gallery-card" onclick="openLightbox('${item.image}', '${escapeHtml(item.title)}', '${escapeHtml(item.caption || '')}')">
            <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='assets/images/hero-cricket.jpg'">
            <span class="gallery-category-badge">${item.category}</span>
            <div class="gallery-overlay">
                <div class="gallery-title">${item.title}</div>
                <div class="gallery-caption">${item.caption || ''}</div>
            </div>
        </div>
    `).join('');
}

function filterGallery(category) {
    const filterButtons = document.querySelectorAll('#galleryFilterContainer .filter-btn');
    filterButtons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase().includes(category.toLowerCase())) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderGallery(category);
}

function openLightbox(src, title, caption) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const titleEl = document.getElementById('lightboxTitle');
    const capEl = document.getElementById('lightboxCaption');

    if (modal && img) {
        img.src = src;
        titleEl.textContent = title;
        capEl.textContent = caption || '';
        showModal('lightboxModal');
    }
}

// -----------------------------------------------------------------------------
// DYNAMIC ANNOUNCEMENTS & NOTICES
// -----------------------------------------------------------------------------
function renderNotices() {
    const container = document.getElementById('noticeContainer');
    if (!container || !window.rcaDB) return;

    const notices = window.rcaDB.getNotices();

    if (notices.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                No current announcements. All training batches running on normal schedule.
            </div>
        `;
        return;
    }

    container.innerHTML = notices.map(notice => {
        const dateObj = new Date(notice.date);
        const formattedDate = !isNaN(dateObj) 
            ? dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
            : notice.date;

        return `
            <div class="notice-item ${notice.urgent ? 'urgent' : ''}">
                <div class="notice-top">
                    <span class="notice-tag ${notice.tagType || 'tag-gold'}">${notice.tag || 'Notice'}</span>
                    <span class="notice-date"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
                </div>
                <h4 class="notice-title">${notice.title}</h4>
                <p class="notice-content">${notice.content}</p>
            </div>
        `;
    }).join('');
}

// Quick Program Prefill
function prefillBooking(programName) {
    let inferredType = 'Free Trial Session';
    if (programName.toLowerCase().includes('rrpl')) {
        inferredType = 'RRPL Trial Registration (₹1,499)';
    } else if (programName.toLowerCase().includes('ram sports cup') || programName.toLowerCase().includes('tournament')) {
        inferredType = 'RAM SPORTS CUP 7th (Team Entry ₹15,000)';
    } else if (programName.toLowerCase().includes('net') || programName.toLowerCase().includes('corporate')) {
        inferredType = 'Turf Net Practice Slot';
    } else if (programName.toLowerCase().includes('machine')) {
        inferredType = 'Bowling Machine Practice';
    }

    openBookingModal(inferredType, '06:30 AM - 08:30 AM');
}

// -----------------------------------------------------------------------------
// RRPL TRIAL REGISTRATION SUBMISSION (₹1,499)
// -----------------------------------------------------------------------------
function handleRrplTrialSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const dynamic = extractDynamicFormData(form, 'rrpl_trials');

    const name = document.getElementById('rrplName').value.trim();
    const phone = document.getElementById('rrplPhone').value.trim();
    const age = document.getElementById('rrplAge').value.trim();
    const role = document.getElementById('rrplRole').value;
    const totalPersons = document.getElementById('rrplPersons').value;
    const city = document.getElementById('rrplCity').value.trim();

    if (!name || !phone || !age) {
        alert("Please fill in all required fields!");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById('rrplPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    const bookingInput = {
        name: name,
        age: age,
        fatherName: dynamic.fatherName || "-",
        phone: phone,
        email: dynamic.email || "",
        city: city || "Vrindavan",
        role: role,
        totalPersons: totalPersons,
        bookingType: "RRPL Trial Registration (₹1,499)",
        formType: "rrpl_trials",
        slotDate: new Date().toISOString().split('T')[0],
        timeSlot: "Trial Session (Morning Batch)",
        facilityType: "Match Turf Wicket (RCA Ground)",
        remarks: `Dedicated RRPL 2026 Trial registration. Group size: ${totalPersons}. Role: ${role}. Trial Fee: ₹1,499 (Stay & Food included by RRPL Committee).`,
        formData: dynamic.formData || {}
    };

    const savedBooking = window.rcaDB.addBooking(bookingInput);

    if (savedBooking) {
        displayPassModal(savedBooking, "RRPL 2026 TRIAL PASS (₹1,499)");
        document.getElementById('rrplTrialForm').reset();
        document.getElementById('rrplCity').value = 'Vrindavan';
        const errEl = document.getElementById('rrplPhoneError');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    } else {
        alert("There was an issue saving your registration. Please call Coach Chauhan directly at +91 9897517704.");
    }
}

// -----------------------------------------------------------------------------
// INLINE GROUND & PRACTICE BOOKING SUBMISSION (BOTTOM FORM)
// -----------------------------------------------------------------------------
function handleBookingSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const dynamic = extractDynamicFormData(form, 'slot_booking_inline');

    const playerName = document.getElementById('playerName').value.trim();
    const playerPhone = document.getElementById('playerPhone').value.trim();
    const totalPersons = document.getElementById('totalPersons').value;
    const playerAge = document.getElementById('playerAge') ? document.getElementById('playerAge').value.trim() : "";
    const bookingType = document.getElementById('bookingType').value;
    const slotDate = document.getElementById('slotDate').value;
    const customTime = document.getElementById('customTime').value.trim();
    const playerCity = document.getElementById('playerCity').value.trim();
    const playerRemarks = document.getElementById('playerRemarks').value.trim();

    if (!playerName || !playerPhone || !slotDate) {
        alert("Please fill in all required fields!");
        return;
    }

    const phoneCheck = validatePhoneNumber(playerPhone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById('playerPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    const bookingInput = {
        name: playerName,
        age: playerAge || "-",
        fatherName: dynamic.fatherName || "-",
        phone: playerPhone,
        email: dynamic.email || "",
        city: playerCity || "Vrindavan",
        role: dynamic.role || "Player / Team Member",
        totalPersons: totalPersons,
        bookingType: bookingType,
        formType: "slot_booking_inline",
        slotDate: slotDate,
        timeSlot: customTime || "Flexible Time",
        facilityType: "Turf / Cement Grounds",
        remarks: playerRemarks,
        formData: dynamic.formData || {}
    };

    const savedBooking = window.rcaDB.addBooking(bookingInput);

    if (savedBooking) {
        displayPassModal(savedBooking, "PRACTICE & SLOT REGISTRATION PASS");
        document.getElementById('bookingForm').reset();
        const errEl = document.getElementById('playerPhoneError');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        initDateInputs();
        document.getElementById('playerCity').value = 'Vrindavan';
        document.getElementById('customTime').value = '06:30 AM - 08:30 AM';
    } else {
        alert("There was an issue saving your booking. Please call Coach Chauhan directly at +91 9897517704.");
    }
}

// Display Pass Modal & Connect WhatsApp Trigger (No manual email button shown per User Request 1)
function displayPassModal(savedBooking, headerTitle = "REGISTRATION PASS") {
    const passContainer = document.getElementById('passContainer');
    if (!passContainer) return;

    passContainer.innerHTML = `
        <div class="success-pass-header">
            <div>
                <div style="font-size: 0.75rem; color: var(--gold-200); font-weight: 700; letter-spacing: 1px;">RAM CRICKET ACADEMY • ${headerTitle}</div>
                <div class="pass-id">${savedBooking.id}</div>
            </div>
            <img src="assets/images/logo.png" alt="RCA" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--gold);">
        </div>

        <div class="pass-grid">
            <div>
                <span class="pass-label">Player Name:</span>
                <div class="pass-value">${escapeHtml(savedBooking.name)} ${savedBooking.age && savedBooking.age !== '-' ? '(Age: ' + savedBooking.age + ')' : ''}</div>
            </div>
            <div>
                <span class="pass-label">Total Persons:</span>
                <div class="pass-value" style="color: var(--gold-200); font-weight: 700;">${savedBooking.totalPersons || '1 Player'}</div>
            </div>
            <div>
                <span class="pass-label">Program / Category:</span>
                <div class="pass-value">${savedBooking.bookingType}</div>
            </div>
            <div>
                <span class="pass-label">Preferred Date:</span>
                <div class="pass-value">${savedBooking.slotDate}</div>
            </div>
            <div>
                <span class="pass-label">Preferred Time:</span>
                <div class="pass-value">${escapeHtml(savedBooking.timeSlot)}</div>
            </div>
            <div>
                <span class="pass-label">City:</span>
                <div class="pass-value">${escapeHtml(savedBooking.city)}</div>
            </div>
        </div>
        
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.25); font-size: 0.78rem; color: #d5cae6;">
            <i class="fa-solid fa-location-dot" style="color: var(--gold);"></i> RCA Ground: Panigaon Raya Road / Garun Govind Road, Vrindavan • Helpline: +91 9897517704
        </div>
    `;

    // Direct WhatsApp Link to Coach Chauhan with full pre-filled details
    const whatsAppUrl = window.rcaDB.getCoachWhatsAppUrl(savedBooking);
    const modalWhatsAppBtn = document.getElementById('modalWhatsAppBtn');
    if (modalWhatsAppBtn) {
        modalWhatsAppBtn.href = whatsAppUrl;
    }

    showModal('bookingSuccessModal');
}

// -----------------------------------------------------------------------------
// MODAL CONTROLS
// -----------------------------------------------------------------------------
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

// Close modal when clicking outside modal-box
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
