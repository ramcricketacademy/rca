
// Synchronize Slot Payment Card with selected Slot's price, group tier & QR code
function syncSlotPaymentCard(slotTitle, slotPrice, scope = 'popup', tierName = '') {
    const isMandatory = window.rcaDB && window.rcaDB.isSlotUtrRequired ? window.rcaDB.isSlotUtrRequired() : false;
    const slots = window.rcaDB ? window.rcaDB.getSlots() : [];
    
    // Find matching slot or fallback
    let matchedSlot = slots.find(s => s.title && s.title.toLowerCase().trim() === (slotTitle || '').toLowerCase().trim());
    if (!matchedSlot && slotTitle) {
        matchedSlot = slots.find(s => s.title && s.title.toLowerCase().includes((slotTitle || '').toLowerCase()));
    }

    let finalPrice = 1500;
    if (slotPrice !== undefined && slotPrice !== null && !isNaN(parseInt(slotPrice)) && parseInt(slotPrice) > 0) {
        finalPrice = parseInt(slotPrice);
    } else if (matchedSlot) {
        finalPrice = matchedSlot.price !== undefined ? matchedSlot.price : 1500;
    } else if (window.rcaDB) {
        const bTypes = window.rcaDB.getBookingTypes();
        const bMatch = bTypes.find(t => t.name.toLowerCase() === (slotTitle || '').toLowerCase());
        if (bMatch) finalPrice = bMatch.price;
    }

    const finalTitle = matchedSlot ? matchedSlot.title : (slotTitle || 'Turf Net Practice Slot');
    const qrUrl = window.rcaDB && window.rcaDB.getSlotQrUrl 
        ? window.rcaDB.getSlotQrUrl(matchedSlot, finalPrice, tierName) 
        : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('upi://pay?pa=ramsports6072@ybl&am=' + finalPrice + '.00&pn=Ram%20Sports%20Academy&tn=' + encodeURIComponent(finalTitle + (tierName ? ' - ' + tierName : '')))}`;
    const upiPayHref = `upi://pay?pa=ramsports6072@ybl&pn=Ram%20Sports%20Academy&am=${finalPrice}.00&cu=INR&tn=${encodeURIComponent(finalTitle + (tierName ? ' - ' + tierName : ''))}`;
    const feeText = finalPrice > 0 ? `₹ ${finalPrice.toLocaleString('en-IN')}/- Official Fee` : `Complimentary / Free Inquiry`;

    if (scope === 'popup' || scope === 'both') {
        const titleEl = document.getElementById('popupSlotTitleDisplay');
        const badgeEl = document.getElementById('popupSlotFeeBadge');
        const qrEl = document.getElementById('popupSlotQrImg');
        const btnEl = document.getElementById('popupSlotPayAppBtn');
        const utrBadgeEl = document.getElementById('popupSlotUtrReqBadge');
        const utrInput = document.getElementById('popupPlayerUtr');

        if (titleEl) titleEl.textContent = finalTitle;
        if (badgeEl) badgeEl.textContent = feeText;
        if (qrEl) qrEl.src = qrUrl;
        if (btnEl) btnEl.href = upiPayHref;
        if (utrBadgeEl) {
            utrBadgeEl.textContent = isMandatory ? '* Mandatory' : '(Optional)';
            utrBadgeEl.style.color = isMandatory ? '#facc15' : '#94a3b8';
            utrBadgeEl.style.fontWeight = isMandatory ? '800' : '500';
        }
        if (utrInput) {
            utrInput.required = isMandatory;
        }
    }

    if (scope === 'inline' || scope === 'both') {
        const titleEl = document.getElementById('inlineSlotTitleDisplay');
        const badgeEl = document.getElementById('inlineSlotFeeBadge');
        const qrEl = document.getElementById('inlineSlotQrImg');
        const btnEl = document.getElementById('inlineSlotPayAppBtn');
        const utrBadgeEl = document.getElementById('inlineSlotUtrReqBadge');
        const utrInput = document.getElementById('playerUtr');

        if (titleEl) titleEl.textContent = finalTitle;
        if (badgeEl) badgeEl.textContent = feeText;
        if (qrEl) qrEl.src = qrUrl;
        if (btnEl) btnEl.href = upiPayHref;
        if (utrBadgeEl) {
            utrBadgeEl.textContent = isMandatory ? '* Mandatory' : '(Optional)';
            utrBadgeEl.style.color = isMandatory ? '#facc15' : '#94a3b8';
            utrBadgeEl.style.fontWeight = isMandatory ? '800' : '500';
        }
        if (utrInput) {
            utrInput.required = isMandatory;
        }
    }
}

/**
 * RCA (RAM CRICKET ACADEMY) - Main Interactive Script
 * Handles public site interactions, gallery filters, dynamic notices, dynamic tournaments,
 * live slot availability (available vs sold out), popup slot booking modal, RRPL trial registration,
 * custom flexible slot booking, WhatsApp connect, and registration pass generation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initDateInputs();
    renderPersonTierDropdowns();
    renderBookingTypeDropdowns();
    renderTournaments();
    renderSlots();
    renderGallery('All');
    renderNotices();
    renderCommittee();
    renderSponsors();
    renderAboutProfile();

    // Live update when Supabase Cloud syncs
    window.addEventListener('rcaDataUpdated', () => {
        console.log("⚡ [Homepage] Re-rendering live data from Supabase Cloud update...");
        renderPersonTierDropdowns();
        renderBookingTypeDropdowns();
        renderTournaments();
        renderSlots();
        renderGallery('All');
        renderNotices();
        renderCommittee();
        renderSponsors();
        renderAboutProfile();
    });

    // Fetch freshest cloud data from Supabase immediately on load
    if (window.rcaDB) {
        window.rcaDB.syncFromSupabase();
    }

    // Attach real-time 10-digit mobile number validation
    attachPhoneInputValidator('rrplPhone', 'rrplPhoneError');
    attachPhoneInputValidator('playerPhone', 'playerPhoneError');
    attachPhoneInputValidator('popupPlayerPhone', 'popupPlayerPhoneError');
    attachPhoneInputValidator('admPhone', 'admPhoneError');
    attachPhoneInputValidator('standalonePhone', 'standalonePhoneError');

    // Auto-launch New Joiny / Admission Welcome Popup (GPL Style per User Request)
    initAdmissionsPopup();
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
// DYNAMIC BOOKING TYPES & PRICING CONTROLLER
// -----------------------------------------------------------------------------
function handleBookingTypeSelectionChange(selectedName, scope = 'both') {
    if (!window.rcaDB) return;
    const types = window.rcaDB.getBookingTypes();
    const slots = window.rcaDB.getSlots();

    const matched = types.find(t => t.name.toLowerCase().trim() === (selectedName || '').toLowerCase().trim())
        || types.find(t => t.name.toLowerCase().includes((selectedName || '').toLowerCase().trim()));

    const matchedSlot = slots.find(s => s.title && s.title.toLowerCase().trim() === (selectedName || '').toLowerCase().trim())
        || slots.find(s => s.title && s.title.toLowerCase().includes((selectedName || '').toLowerCase().trim()));

    const price = matched ? (matched.price || 0) : (matchedSlot ? matchedSlot.price : 0);
    const label = matched ? (matched.label || '') : (matchedSlot ? (matchedSlot.facility || 'Ground Practice') : '');
    const name = matched ? matched.name : (matchedSlot ? matchedSlot.title : (selectedName || 'General Practice'));

    const priceBoxHtml = (price > 0)
        ? `
            <div style="background: rgba(212, 175, 55, 0.12); border: 1.5px solid var(--gold); border-radius: 8px; padding: 10px 14px; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div>
                    <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--gold-light); font-weight: 700; letter-spacing: 0.5px;">Official Academy Fee</div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: #fff;">₹${price.toLocaleString('en-IN')}/- ${label ? `<span style="font-size: 0.8rem; font-weight: normal; color: #cbd5e1;">(${escapeHtml(label)})</span>` : ''}</div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #22c55e; color: #000; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 12px;"><i class="fa-solid fa-qrcode"></i> UPI QR Ready</span>
                </div>
            </div>
          `
        : `
            <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid #3b82f6; border-radius: 8px; padding: 8px 12px; margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #93c5fd; font-size: 0.82rem;"><i class="fa-solid fa-circle-info"></i> Consultation / Free Session inquiry. Pay later at academy ground.</span>
                <span style="background: #3b82f6; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px;">FREE / ON CALL</span>
            </div>
          `;

    if (scope === 'inline' || scope === 'both') {
        const box = document.getElementById('inlineBookingTypePriceBox');
        if (box) box.innerHTML = priceBoxHtml;
        syncSlotPaymentCard(name, price, 'inline');
    }

    if (scope === 'popup' || scope === 'both') {
        const box = document.getElementById('popupBookingTypePriceBox');
        if (box) box.innerHTML = priceBoxHtml;
        syncSlotPaymentCard(name, price, 'popup');
    }
}

function renderBookingTypeDropdowns() {
    if (!window.rcaDB) return;
    const types = window.rcaDB.getBookingTypes();

    const optionsHtml = types.map(t => {
        const priceTxt = t.price > 0 ? ` (₹${t.price.toLocaleString('en-IN')})` : '';
        return `<option value="${escapeHtml(t.name)}" data-price="${t.price}" data-label="${escapeHtml(t.label || '')}">${escapeHtml(t.name)}${priceTxt}</option>`;
    }).join('');

    const inlineSelect = document.getElementById('bookingType');
    if (inlineSelect) {
        const prevVal = inlineSelect.value;
        inlineSelect.innerHTML = optionsHtml;
        if (prevVal) inlineSelect.value = prevVal;
        handleBookingTypeSelectionChange(inlineSelect.value, 'inline');
    }

    const popupSelect = document.getElementById('popupBookingType');
    if (popupSelect) {
        const prevVal = popupSelect.value;
        popupSelect.innerHTML = optionsHtml;
        if (prevVal) popupSelect.value = prevVal;
        handleBookingTypeSelectionChange(popupSelect.value, 'popup');
    }
}

// Dynamic Person / Group Sizes Dropdowns Controller (User Requested)
function renderPersonTierDropdowns() {
    if (!window.rcaDB) return;
    const tiers = window.rcaDB.getPersonTiers ? window.rcaDB.getPersonTiers() : [
        "1 Player (Individual Practice)", "2 Players", "3-5 Players (Net Group)", "6-10 Players", "Full Team (11-15 Players)", "Both Teams (22+ Players)"
    ];

    const optionsHtml = tiers.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    const popupPersons = document.getElementById('popupTotalPersons');
    if (popupPersons) {
        const prev = popupPersons.value;
        popupPersons.innerHTML = optionsHtml;
        if (prev && tiers.includes(prev)) popupPersons.value = prev;
    }

    const inlinePersons = document.getElementById('totalPersons');
    if (inlinePersons) {
        const prev = inlinePersons.value;
        inlinePersons.innerHTML = optionsHtml;
        if (prev && tiers.includes(prev)) inlinePersons.value = prev;
    }
}

// When user changes Group Size in popup modal (e.g. 1 Player -> 2 Players -> Full Team)
function handlePopupTotalPersonsChange(newTier) {
    const slotTitle = document.getElementById('popupBookingType')?.value || '';
    if (!slotTitle || !window.rcaDB) return;

    const tierPrice = window.rcaDB.getSlotPriceForTier ? window.rcaDB.getSlotPriceForTier(slotTitle, newTier) : 1500;

    const priceBox = document.getElementById('popupBookingTypePriceBox');
    if (priceBox) {
        priceBox.innerHTML = `
            <div style="margin-top: 6px; padding: 6px 12px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 6px; font-size: 0.85rem; color: #ffd700; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-tag"></i> Booking Rate: ₹${tierPrice.toLocaleString('en-IN')}/-
                <span style="font-size: 0.78rem; font-weight: normal; color: #fef08a;">(${escapeHtml(newTier)})</span>
            </div>
        `;
    }

    syncSlotPaymentCard(slotTitle, tierPrice, 'popup', newTier);
}

// When user changes Group Size in bottom inline form
function handleInlineTotalPersonsChange(newTier) {
    const slotTitle = document.getElementById('bookingType')?.value || '';
    if (!slotTitle || !window.rcaDB) return;

    const tierPrice = window.rcaDB.getSlotPriceForTier ? window.rcaDB.getSlotPriceForTier(slotTitle, newTier) : 1500;

    const priceBox = document.getElementById('inlineBookingTypePriceBox');
    if (priceBox) {
        priceBox.innerHTML = `
            <div style="margin-top: 6px; padding: 6px 12px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 6px; font-size: 0.85rem; color: #ffd700; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-tag"></i> Booking Rate: ₹${tierPrice.toLocaleString('en-IN')}/-
                <span style="font-size: 0.78rem; font-weight: normal; color: #fef08a;">(${escapeHtml(newTier)})</span>
            </div>
        `;
    }

    syncSlotPaymentCard(slotTitle, tierPrice, 'inline', newTier);
}

// -----------------------------------------------------------------------------
// BOOKING POPUP MODAL (User Requested: Strict Heading Only for Ground Bookings)
// -----------------------------------------------------------------------------
function openBookingModal(prefillType = '', prefillTime = '') {
    initDateInputs();
    renderPersonTierDropdowns();

    const popupBookingType = document.getElementById('popupBookingType');
    const popupCustomTime = document.getElementById('popupCustomTime');
    const popupPersons = document.getElementById('popupTotalPersons');
    const allSlots = window.rcaDB ? window.rcaDB.getSlots() : [];

    let matchedSlot = null;
    if (prefillType) {
        matchedSlot = allSlots.find(s => s.title && s.title.toLowerCase().trim() === prefillType.toLowerCase().trim())
                   || allSlots.find(s => s.title && s.title.toLowerCase().includes(prefillType.toLowerCase()));
    }

    const slotTitle = matchedSlot ? matchedSlot.title : prefillType;
    const baseSlotPrice = matchedSlot ? matchedSlot.price : 1500;
    const slotTime = prefillTime || (matchedSlot ? matchedSlot.time : '06:30 AM - 08:30 AM');
    const activeTiers = window.rcaDB && window.rcaDB.getPersonTiers ? window.rcaDB.getPersonTiers() : [];
    const selectedTier = (popupPersons && popupPersons.value) ? popupPersons.value : (activeTiers[0] || '1 Player (Individual Practice)');
    if (popupPersons && !popupPersons.value) {
        popupPersons.value = selectedTier;
    }
    const effectivePrice = window.rcaDB && window.rcaDB.getSlotPriceForTier 
        ? window.rcaDB.getSlotPriceForTier(slotTitle, selectedTier) 
        : baseSlotPrice;

    if (popupBookingType) {
        if (slotTitle) {
            // User requested: "Ground booking me jo form open hoke aata hai usme se inquiry booking type me bahi likho jo ground booking ki heading hai eg. Afternoon Match Simulation, baki sab option hata do"
            popupBookingType.innerHTML = `<option value="${escapeHtml(slotTitle)}" data-price="${effectivePrice}" selected>${escapeHtml(slotTitle)}</option>`;
            popupBookingType.value = slotTitle;
        } else {
            // General open without prefill: Only show Ground Booking practice slots (Never tournaments or admissions!)
            if (allSlots.length > 0) {
                popupBookingType.innerHTML = allSlots.map(s => 
                    `<option value="${escapeHtml(s.title)}" data-price="${s.price}">${escapeHtml(s.title)} (₹${s.price.toLocaleString('en-IN')})</option>`
                ).join('');
                matchedSlot = allSlots[0];
            } else {
                renderBookingTypeDropdowns();
            }
        }
    }

    if (popupCustomTime) {
        popupCustomTime.value = slotTime && !slotTime.toLowerCase().includes('flexible') ? slotTime : '06:30 AM - 08:30 AM';
    }

    const priceBox = document.getElementById('popupBookingTypePriceBox');
    if (priceBox) {
        priceBox.innerHTML = `
            <div style="margin-top: 6px; padding: 6px 12px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 6px; font-size: 0.85rem; color: #ffd700; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-tag"></i> Booking Rate: ₹${effectivePrice.toLocaleString('en-IN')}/-
                <span style="font-size: 0.78rem; font-weight: normal; color: #fef08a;">(${escapeHtml(selectedTier)})</span>
            </div>
        `;
    }

    syncSlotPaymentCard(slotTitle, effectivePrice, 'popup', selectedTier);
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
    const utr = (document.getElementById('popupPlayerUtr')?.value || '').trim();

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

    // 1. Mandatory UTR check for all ₹1,499 Trial / Admission selections
    const is1499 = bookingType.includes('1499') || bookingType.includes('1,499') || bookingType.includes('RRPL') || bookingType.includes('Admission');
    if (is1499 && !utr) {
        alert("Please complete the payment and enter your 12-digit UPI UTR number to complete registration.");
        const uInput = document.getElementById('popupPlayerUtr');
        if (uInput) { uInput.focus(); uInput.style.borderColor = "#ef4444"; }
        return;
    }

    // 2. Check Admin Policy: whether slot booking UTR is mandatory
    const isSlotUtrMandatory = window.rcaDB && window.rcaDB.isSlotUtrRequired ? window.rcaDB.isSlotUtrRequired() : false;
    if (isSlotUtrMandatory && !utr) {
        alert("Academy Policy: Please complete the payment and enter your UPI UTR number to reserve this practice slot.");
        const uInput = document.getElementById('popupPlayerUtr');
        if (uInput) { uInput.focus(); uInput.style.borderColor = "#ef4444"; }
        return;
    }
    const allSlots = window.rcaDB ? window.rcaDB.getSlots() : [];
    const matchedSlot = allSlots.find(s => s.title && s.title.toLowerCase().trim() === bookingType.toLowerCase().trim())
                     || allSlots.find(s => s.title && s.title.toLowerCase().includes(bookingType.toLowerCase()));
    const finalFee = (matchedSlot && window.rcaDB && window.rcaDB.getSlotPriceForTier) 
        ? String(window.rcaDB.getSlotPriceForTier(matchedSlot, totalPersons)) 
        : (document.getElementById('popupSlotFeeBadge')?.innerText?.replace(/\D/g, '') || (is1499 ? '1499' : '1500'));

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
        facilityType: matchedSlot ? (matchedSlot.facility || "Turf Ground") : "Turf / Cement Grounds",
        remarks,
        formType: 'slot_booking',
        category: '',
        utrNumber: utr,
        feeAmount: finalFee,
        paymentStatus: utr ? 'Pending Verification' : 'Slot Reserved',
        formData: { utrNumber: utr, ...(dynamic.formData || {}) }
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
    const utr = (document.getElementById('playerUtr')?.value || '').trim();

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

    // 1. Mandatory UTR check for all ₹1,499 Trial / Admission selections
    const is1499 = bookingType.includes('1499') || bookingType.includes('1,499') || bookingType.includes('RRPL') || bookingType.includes('Admission');
    if (is1499 && !utr) {
        alert("Please complete the payment and enter your 12-digit UPI UTR number to complete registration.");
        const uInput = document.getElementById('playerUtr');
        if (uInput) { uInput.focus(); uInput.style.borderColor = "#ef4444"; }
        return;
    }

    // 2. Check Admin Policy: whether slot booking UTR is mandatory
    const isSlotUtrMandatory = window.rcaDB && window.rcaDB.isSlotUtrRequired ? window.rcaDB.isSlotUtrRequired() : false;
    if (isSlotUtrMandatory && !utr) {
        alert("Academy Policy: Please complete the payment and enter your UPI UTR number to reserve this practice slot.");
        const uInput = document.getElementById('playerUtr');
        if (uInput) { uInput.focus(); uInput.style.borderColor = "#ef4444"; }
        return;
    }

    // Tournament vs Slot detection
    const isTournament = bookingType.toLowerCase().includes('cup') || 
                         bookingType.toLowerCase().includes('tournament') || 
                         bookingType.toLowerCase().includes('league') || 
                         bookingType.toLowerCase().includes('rrpl');

    const formType = isTournament ? 'tournament_registration' : 'slot_booking';

    const bookingInput = {
        name: playerName,
        age: playerAge || "-",
        fatherName: dynamic.fatherName || "-",
        phone: playerPhone,
        email: dynamic.email || "",
        city: playerCity || "Vrindavan",
        role: dynamic.role || (isTournament ? "Tournament Team / Player" : "Player / Team Member"),
        totalPersons: totalPersons,
        bookingType: bookingType,
        formType: formType,
        category: '',
        utrNumber: utr,
        feeAmount: is1499 ? '1499' : (document.getElementById('inlineSlotFeeBadge')?.innerText?.replace(/\D/g, '') || ''),
        paymentStatus: utr ? 'Pending Verification' : 'Slot Reserved',
        slotDate: slotDate,
        timeSlot: customTime || "Flexible Time",
        facilityType: "Turf / Cement Grounds",
        remarks: playerRemarks,
        formData: { utrNumber: utr, ...(dynamic.formData || {}) }
    };

    const savedBooking = window.rcaDB.addBooking(bookingInput);

    if (savedBooking) {
        displayPassModal(savedBooking, isTournament ? "TOURNAMENT REGISTRATION PASS" : "PRACTICE & SLOT REGISTRATION PASS");
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
            ? `window.location.href='rrpl-registration.html'` 
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

// When clicking "Book This Slot", directly open the registration form popup (User Requested: Strict Heading Only)
function selectSlot(title, time) {
    const allSlots = window.rcaDB ? window.rcaDB.getSlots() : [];
    const matched = allSlots.find(s => s.title && s.title.toLowerCase().trim() === (title || '').toLowerCase().trim())
                 || allSlots.find(s => s.title && s.title.toLowerCase().includes((title || '').toLowerCase()));

    const slotTitle = matched ? matched.title : title;
    const slotPrice = matched ? matched.price : 1500;
    const slotTime = time && !time.toLowerCase().includes('flexible') ? time : (matched ? matched.time : '06:30 AM - 08:30 AM');

    // Open popup directly with matching QR & rate and ONLY this heading (All other options eliminated)
    openBookingModal(slotTitle, slotTime);

    // Also update bottom inline form in case user scrolls down
    const inlineTime = document.getElementById('customTime');
    const inlineType = document.getElementById('bookingType');
    if (inlineTime) {
        inlineTime.value = slotTime;
    }
    if (inlineType) {
        let exists = Array.from(inlineType.options).some(o => o.value === slotTitle);
        if (!exists) {
            const opt = document.createElement('option');
            opt.value = slotTitle;
            opt.textContent = `${slotTitle} (₹${slotPrice.toLocaleString('en-IN')})`;
            opt.setAttribute('data-price', slotPrice);
            inlineType.appendChild(opt);
        }
        inlineType.value = slotTitle;
        handleBookingTypeSelectionChange(slotTitle, 'inline');
    }
    syncSlotPaymentCard(slotTitle, slotPrice, 'both');
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

// -----------------------------------------------------------------------------
// ABOUT SECTION SUB-ELEMENTS: COACH, COMMITTEE & SPONSORSHIPS
// -----------------------------------------------------------------------------
function switchAboutTab(tabName) {
    const tabs = ['coach', 'committee', 'sponsors'];
    tabs.forEach(t => {
        const btn = document.getElementById(`aboutTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`aboutTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) btn.classList.remove('active');
        if (content) content.classList.remove('active');
    });

    const activeBtn = document.getElementById(`aboutTabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const activeContent = document.getElementById(`aboutTabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');

    // Smooth scroll to #about if triggered from header/sidebar
    const aboutSec = document.getElementById('about');
    if (aboutSec && window.scrollY > 0) {
        const rect = aboutSec.getBoundingClientRect();
        if (rect.top < -50 || rect.top > window.innerHeight) {
            aboutSec.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function renderCommittee() {
    const container = document.getElementById('committeeCardsContainer');
    if (!container || !window.rcaDB) return;

    const list = window.rcaDB.getCommittee ? window.rcaDB.getCommittee() : [];
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted);">
                Committee member details updating. Please contact academy office.
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(m => `
        <div class="committee-card">
            <div class="committee-photo-wrap">
                <img src="${escapeHtml(m.photo || 'assets/images/logo.png')}" alt="${escapeHtml(m.name)}" onerror="this.src='assets/images/logo.png'">
            </div>
            <div class="committee-name">${escapeHtml(m.name)}</div>
            <div class="committee-role"><i class="fa-solid fa-id-badge" style="margin-right: 4px;"></i>${escapeHtml(m.designation)}</div>
            <div class="committee-bio">${escapeHtml(m.bio || '')}</div>
        </div>
    `).join('');
}

function renderSponsors() {
    const container = document.getElementById('sponsorsCardsContainer');
    if (!container || !window.rcaDB) return;

    const list = window.rcaDB.getSponsors ? window.rcaDB.getSponsors() : [];
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted);">
                Sponsorship partners updating. Inquire to become an official partner.
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(s => `
        <div class="sponsor-card">
            <div>
                <div class="sponsor-logo-box">
                    <img src="${escapeHtml(s.logo || 'assets/images/logo.png')}" alt="${escapeHtml(s.name)}" onerror="this.src='assets/images/logo.png'">
                </div>
                <div class="sponsor-name">${escapeHtml(s.name)}</div>
                <div class="sponsor-badge-row">
                    <span class="sponsor-role-pill"><i class="fa-solid fa-ribbon" style="margin-right: 4px;"></i>${escapeHtml(s.designation)}</span>
                    <span class="sponsor-city-pill"><i class="fa-solid fa-location-dot" style="margin-right: 3px;"></i>${escapeHtml(s.city || 'Vrindavan')}</span>
                </div>
                <div class="sponsor-info-text">${escapeHtml(s.shortInfo || '')}</div>
            </div>
        </div>
    `).join('');
}

function renderAboutProfile() {
    if (!window.rcaDB || !window.rcaDB.getAboutProfile) return;
    const prof = window.rcaDB.getAboutProfile();
    if (!prof) return;

    const founderName = document.getElementById('aboutFounderName');
    const founderTitle = document.getElementById('aboutFounderTitle');
    const founderBio = document.getElementById('aboutFounderBio');
    const founderQuote = document.getElementById('aboutFounderQuote');
    const founderYears = document.getElementById('aboutFounderYears');
    const founderPhoneBtn = document.getElementById('aboutFounderPhoneBtn');
    const founderInstaBtn = document.getElementById('aboutFounderInstaBtn');

    if (founderName && prof.headCoach) founderName.textContent = prof.headCoach;
    if (founderTitle && prof.title) founderTitle.textContent = prof.title;
    if (founderBio && prof.bio) founderBio.innerHTML = prof.bio;
    if (founderQuote && prof.quote) founderQuote.textContent = `"${prof.quote}"`;
    if (founderYears && prof.yearsExp) founderYears.textContent = prof.yearsExp;
    if (founderPhoneBtn && prof.phone) {
        founderPhoneBtn.href = `tel:+91${prof.phone.replace(/[^0-9]/g, '')}`;
        founderPhoneBtn.innerHTML = `<i class="fa-solid fa-phone"></i> +91 ${prof.phone}`;
    }
    if (founderInstaBtn && prof.instagramUrl) {
        founderInstaBtn.href = prof.instagramUrl;
    }
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
    const fatherName = document.getElementById('rrplFather') ? document.getElementById('rrplFather').value.trim() : '-';
    const category = document.getElementById('rrplCategory') ? document.getElementById('rrplCategory').value.trim() : 'Under-16';
    const dob = document.getElementById('rrplDob') ? document.getElementById('rrplDob').value.trim() : '';
    const ageCalc = dob ? calculateCricketAge(dob) : null;
    const age = ageCalc ? ageCalc.text : (document.getElementById('rrplAge') ? document.getElementById('rrplAge').value.trim() : '16');
    const role = document.getElementById('rrplRole').value;
    const totalPersons = document.getElementById('rrplPersons') ? document.getElementById('rrplPersons').value : category;
    const city = document.getElementById('rrplCity').value.trim();
    const utr = document.getElementById('rrplUtr') ? document.getElementById('rrplUtr').value.trim() : '';

    if (!name || !phone) {
        alert("Please fill in Player Name and Mobile Number!");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById('rrplPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    if (!utr) {
        alert("Kripya payment QR scan karke UPI Transaction ID (UTR) bharein!");
        const utrEl = document.getElementById('rrplUtr');
        if (utrEl) { utrEl.focus(); utrEl.style.borderColor = "#ef4444"; }
        return;
    }

    const bookingInput = {
        name: name,
        age: age,
        fatherName: fatherName,
        category: category,
        dob: dob,
        phone: phone,
        email: dynamic.email || "",
        city: city || "Vrindavan",
        role: role,
        totalPersons: totalPersons,
        bookingType: `RRPL 2026 Trial (${category})`,
        formType: "rrpl_trials",
        slotDate: new Date().toISOString().split('T')[0],
        timeSlot: "Trial Session (Morning Batch)",
        facilityType: "Match Turf Wicket (RCA Ground)",
        feeAmount: "1499",
        utrNumber: utr,
        paymentStatus: "Pending Verification",
        remarks: `Dedicated RRPL 2026 Trial. Category: ${category}. Father: ${fatherName}. Role: ${role}. UTR: ${utr}. Trial Fee: ₹1,499.`,
        formData: {
            category,
            dob,
            fatherName,
            utrNumber: utr,
            feeAmount: "1499",
            ...(dynamic.formData || {})
        }
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
// ADMISSION WELCOME ENTRANCE POPUP (GPL STYLE)
// -----------------------------------------------------------------------------
function initAdmissionsPopup() {
    const dismissed = sessionStorage.getItem('rca_admission_popup_closed');
    if (!dismissed) {
        setTimeout(() => {
            const popup = document.getElementById('admissionWelcomePopup');
            if (popup && !document.querySelector('.modal-backdrop.show')) {
                showModal('admissionWelcomePopup');
            }
        }, 1200);
    }
}

function closeAdmissionPopup() {
    sessionStorage.setItem('rca_admission_popup_closed', 'true');
    closeModal('admissionWelcomePopup');
}

function openAdmissionRegistrationModal(category = 'Under-16') {
    closeAdmissionPopup();
    selectCategory(category, 'adm');
    showModal('admissionRegistrationModal');
    const nameInput = document.getElementById('admName');
    if (nameInput) setTimeout(() => nameInput.focus(), 300);
}

// -----------------------------------------------------------------------------
// AGE CATEGORY SELECTION & LIVE CRICKET AGE CALCULATION
// -----------------------------------------------------------------------------
function selectCategory(category, scope = 'adm') {
    const inputId = scope === 'rrpl' ? 'rrplCategory' : (scope === 'standalone' ? 'standaloneCategory' : 'admCategory');
    const input = document.getElementById(inputId);
    if (input) input.value = category;

    // Toggle active class on cards
    const containerId = scope === 'rrpl' ? 'rrplCategoryGroup' : (scope === 'standalone' ? 'standaloneCategoryGroup' : 'admCategoryGroup');
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('.category-card').forEach(card => {
            if (card.dataset.category === category) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    // Trigger re-evaluation of DOB if already selected
    const dobInputId = scope === 'rrpl' ? 'rrplDob' : (scope === 'standalone' ? 'standaloneDob' : 'admDob');
    const dobInput = document.getElementById(dobInputId);
    if (dobInput && dobInput.value) {
        handleDobChange(dobInput.value, scope);
    }
}

function calculateCricketAge(dobString) {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    let days = today.getDate() - dob.getDate();

    if (days < 0) {
        months--;
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    return {
        years: Math.max(0, years),
        months: Math.max(0, months),
        text: `${years} Yrs, ${months} Mos`
    };
}

function handleDobChange(dobValue, scope = 'adm') {
    const ageResultId = scope === 'rrpl' ? 'rrplAgeResult' : (scope === 'standalone' ? 'standaloneAgeResult' : 'admAgeResult');
    const ageBadgeId = scope === 'rrpl' ? 'rrplAgeBadge' : (scope === 'standalone' ? 'standaloneAgeBadge' : 'admAgeBadge');
    const alertBoxId = scope === 'rrpl' ? 'rrplAgeAlert' : (scope === 'standalone' ? 'standaloneAgeAlert' : 'admAgeAlert');
    const alertMsgId = scope === 'rrpl' ? 'rrplAgeAlertMsg' : (scope === 'standalone' ? 'standaloneAgeAlertMsg' : 'admAgeAlertMsg');
    const switchBtnId = scope === 'rrpl' ? 'rrplAgeSwitchBtn' : (scope === 'standalone' ? 'standaloneAgeSwitchBtn' : 'admAgeSwitchBtn');
    const categoryInputId = scope === 'rrpl' ? 'rrplCategory' : (scope === 'standalone' ? 'standaloneCategory' : 'admCategory');

    const category = (document.getElementById(categoryInputId)?.value || 'Under-16').trim();
    const resultEl = document.getElementById(ageResultId);
    const badgeEl = document.getElementById(ageBadgeId);
    const alertBox = document.getElementById(alertBoxId);
    const alertMsg = document.getElementById(alertMsgId);
    const switchBtn = document.getElementById(switchBtnId);

    if (!dobValue) {
        if (resultEl) resultEl.textContent = 'Select DOB';
        if (badgeEl) { badgeEl.className = 'age-calc-badge'; badgeEl.textContent = ''; }
        if (alertBox) alertBox.classList.remove('show');
        return;
    }

    const calc = calculateCricketAge(dobValue);
    if (!calc) return;

    if (resultEl) {
        resultEl.textContent = `🎂 ${calc.text}`;
    }

    let isEligible = true;
    let suggestedCat = null;
    let warningMsg = '';

    if (category === 'Under-14') {
        if (calc.years >= 14) {
            isEligible = false;
            suggestedCat = calc.years < 16 ? 'Under-16' : (calc.years < 19 ? 'Under-19' : 'Open / Senior');
            warningMsg = `Player is ${calc.years} yrs old (exceeds U-14 limit). Eligible for ${suggestedCat}.`;
        }
    } else if (category === 'Under-16') {
        if (calc.years >= 16) {
            isEligible = false;
            suggestedCat = calc.years < 19 ? 'Under-19' : 'Open / Senior';
            warningMsg = `Player is ${calc.years} yrs old (exceeds U-16 limit). Eligible for ${suggestedCat}.`;
        }
    } else if (category === 'Under-19') {
        if (calc.years >= 19) {
            isEligible = false;
            suggestedCat = 'Open / Senior';
            warningMsg = `Player is ${calc.years} yrs old (exceeds U-19 cutoff). Senior division trials applicable.`;
        }
    }

    if (calc.years < 7) {
        isEligible = false;
        warningMsg = `Minimum recommended academy age is 7 years. (Entered: ${calc.years} yrs).`;
    }

    if (badgeEl) {
        if (isEligible) {
            badgeEl.className = 'age-calc-badge age-badge-valid';
            badgeEl.textContent = `✔ Eligible for ${category}`;
        } else {
            badgeEl.className = 'age-calc-badge age-badge-warning';
            badgeEl.textContent = `⚠️ Category Check Needed`;
        }
    }

    if (alertBox && alertMsg) {
        if (!isEligible) {
            alertMsg.textContent = warningMsg;
            alertBox.classList.add('show');
            if (switchBtn && suggestedCat && suggestedCat.startsWith('Under')) {
                switchBtn.style.display = 'inline-block';
                switchBtn.textContent = `Switch to ${suggestedCat}`;
                switchBtn.onclick = () => selectCategory(suggestedCat, scope);
            } else if (switchBtn) {
                switchBtn.style.display = 'none';
            }
        } else {
            alertBox.classList.remove('show');
        }
    }
}

// Copy UPI ID to Clipboard
function copyUpiId(btnEl, upiId = 'ramsports6072@ybl') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(upiId).then(() => {
            const original = btnEl.innerHTML;
            btnEl.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => btnEl.innerHTML = original, 2000);
        });
    } else {
        const temp = document.createElement('textarea');
        temp.value = upiId;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        const original = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btnEl.innerHTML = original, 2000);
    }
}

// Copy Shareable Registration Link for Coaches & Admin
function shareRegistrationLink() {
    const url = window.location.origin + '/rrpl-registration';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert("✅ Registration Link Copied to Clipboard!\n\n" + url + "\n\nAap ise direct WhatsApp ya Social Media par share kar sakte hain.");
        });
    } else {
        alert("Registration Link:\n" + url);
    }
}

// -----------------------------------------------------------------------------
// ADMISSION REGISTRATION FORM SUBMIT HANDLER (POPUP MODAL & STANDALONE PAGE)
// -----------------------------------------------------------------------------
function handleAdmissionRegistrationSubmit(event, scope = 'adm') {
    event.preventDefault();
    const form = event.target;
    const dynamic = extractDynamicFormData(form, 'academy_admission');

    const name = (document.getElementById(scope === 'standalone' ? 'standaloneName' : 'admName')?.value || '').trim();
    const phone = (document.getElementById(scope === 'standalone' ? 'standalonePhone' : 'admPhone')?.value || '').trim();
    const fatherName = (document.getElementById(scope === 'standalone' ? 'standaloneFather' : 'admFather')?.value || '').trim();
    const category = (document.getElementById(scope === 'standalone' ? 'standaloneCategory' : 'admCategory')?.value || 'Under-16').trim();
    const dob = (document.getElementById(scope === 'standalone' ? 'standaloneDob' : 'admDob')?.value || '').trim();
    const role = document.getElementById(scope === 'standalone' ? 'standaloneRole' : 'admRole')?.value || 'All-Rounder';
    const battingStyle = document.getElementById(scope === 'standalone' ? 'standaloneBatting' : 'admBatting')?.value || 'Right-Hand Bat';
    const bowlingStyle = document.getElementById(scope === 'standalone' ? 'standaloneBowling' : 'admBowling')?.value || 'Right-Arm Fast';
    const city = (document.getElementById(scope === 'standalone' ? 'standaloneCity' : 'admCity')?.value || 'Vrindavan').trim();
    const utr = (document.getElementById(scope === 'standalone' ? 'standaloneUtr' : 'admUtr')?.value || '').trim();

    if (!name || !phone || !fatherName || !dob) {
        alert("Please fill in all mandatory fields (Name, Phone, Father Name, DOB)!");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone, "Mobile Number");
    if (!phoneCheck.valid) {
        alert(phoneCheck.message);
        const pInput = document.getElementById(scope === 'standalone' ? 'standalonePhone' : 'admPhone');
        if (pInput) { pInput.focus(); pInput.style.borderColor = "#ef4444"; }
        return;
    }

    if (!utr) {
        alert("Kripya payment complete karke UPI UTR / Transaction Reference ID zaroor bharein!");
        const utrInput = document.getElementById(scope === 'standalone' ? 'standaloneUtr' : 'admUtr');
        if (utrInput) { utrInput.focus(); utrInput.style.borderColor = "#ef4444"; }
        return;
    }

    const calc = calculateCricketAge(dob);
    const ageText = calc ? calc.text : '-';

    const bookingInput = {
        name: name,
        phone: phone,
        fatherName: fatherName,
        category: category,
        dob: dob,
        age: ageText,
        role: role,
        battingStyle: battingStyle,
        bowlingStyle: bowlingStyle,
        city: city,
        totalPersons: category,
        bookingType: `RCA Admission / Trials (${category})`,
        formType: 'academy_admission',
        slotDate: new Date().toISOString().split('T')[0],
        timeSlot: 'Morning Batch (06:30 AM - 08:30 AM)',
        facilityType: 'Match Turf Pitch (RCA Vrindavan)',
        feeAmount: '1499',
        utrNumber: utr,
        paymentStatus: 'Pending Verification',
        remarks: `RCA Admission ${category}. Father: ${fatherName}. Batting: ${battingStyle}. Bowling: ${bowlingStyle}. Fee: ₹1499. UTR: ${utr}.`,
        formData: {
            category,
            dob,
            ageText,
            fatherName,
            battingStyle,
            bowlingStyle,
            utrNumber: utr,
            feeAmount: '1499',
            paymentMethod: 'PhonePe UPI QR (Fixed ₹1,499)',
            ...(dynamic.formData || {})
        }
    };

    const saved = window.rcaDB.addBooking(bookingInput);
    if (saved) {
        if (scope === 'adm') {
            closeModal('admissionRegistrationModal');
        }
        displayPassModal(saved, `RCA ${category.toUpperCase()} REGISTRATION PASS (₹1,499)`);
        form.reset();
        const errEl = document.getElementById(scope === 'standalone' ? 'standalonePhoneError' : 'admPhoneError');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    } else {
        alert("There was an issue processing your registration. Please contact Coach Chauhan directly at +91 9897517704.");
    }
}

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
            <i class="fa-solid fa-location-dot" style="color: var(--gold);"></i> <a href="https://goo.gl/maps/JbRKLzuBDmZG7U68A" target="_blank" rel="noopener" style="color: #facc15; text-decoration: underline;">RCA Ground: Panigaon Raya Road, Vrindavan (Mathura)</a> • Helpline: +91 9897517704
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
