/**
 * RCA (RAM CRICKET ACADEMY) - Supabase Cloud Database & Storage Client
 * Official Website: https://ramcricketacademy.com
 * Handles real-time cloud database syncing, image uploads to Supabase Storage,
 * and seamless fallback to LocalStorage when offline.
 */

const SUPABASE_CONFIG_STORAGE_KEY = 'RCA_SUPABASE_CONFIG_V1';

// Default Supabase configuration (Pre-configured with live Supabase Project)
const DEFAULT_SUPABASE_CONFIG = {
    supabaseUrl: "https://ixkipytohfcbenqjtjvm.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4a2lweXRvaGZjYmVucWp0anZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MDcxMTksImV4cCI6MjEwODQ4MzExOX0.FVGau1Mrg6eCyecNSP-n9GQ-vS6bN8SI2Vlv1XW-7uU",
    bucketName: "rca-media"
};

class RcaSupabaseManager {
    constructor() {
        this.client = null;
        this.config = this.loadConfig();
        this.initClient();
    }

    loadConfig() {
        try {
            const saved = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : {};
            return {
                supabaseUrl: parsed.supabaseUrl || DEFAULT_SUPABASE_CONFIG.supabaseUrl,
                supabaseAnonKey: parsed.supabaseAnonKey || DEFAULT_SUPABASE_CONFIG.supabaseAnonKey,
                bucketName: parsed.bucketName || DEFAULT_SUPABASE_CONFIG.bucketName
            };
        } catch (e) {
            console.warn("Could not load Supabase config:", e);
            return { ...DEFAULT_SUPABASE_CONFIG };
        }
    }

    saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
        this.initClient();
        return this.isConfigured();
    }

    initClient() {
        if (typeof window.supabase !== 'undefined' && this.config.supabaseUrl && this.config.supabaseAnonKey) {
            try {
                this.client = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
                console.log("⚡ [RCA Supabase] Connected to Cloud Database:", this.config.supabaseUrl);
            } catch (err) {
                console.error("❌ [RCA Supabase] Initialization error:", err);
                this.client = null;
            }
        } else {
            this.client = null;
        }
    }

    isConfigured() {
        return !!(this.client && this.config.supabaseUrl && this.config.supabaseAnonKey);
    }

    // Helper to retrieve active admin authentication token
    getAdminToken(explicitToken = null) {
        if (explicitToken && typeof explicitToken === 'string' && explicitToken.length > 0) return explicitToken;
        if (typeof sessionStorage !== 'undefined') {
            const sToken = sessionStorage.getItem('rca_admin_token');
            if (sToken) return sToken;
        }
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('rca_admin_logged_in') === 'true') {
            return 'rca_admin_verified_session_token';
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // SUPABASE STORAGE: Image Upload (Posters, Gallery, Logos)
    // -------------------------------------------------------------------------
    async uploadImage(file, folder = 'general') {
        if (!this.isConfigured()) {
            console.warn("[RCA Supabase] Cloud storage not configured. Using local file fallback.");
            return null;
        }

        try {
            const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
            const cleanName = (file.name || 'image').replace(/[^a-zA-Z0-9]/g, '_');
            const filePath = `${folder}/${Date.now()}_${cleanName}.${fileExt}`;

            const { data, error } = await this.client.storage
                .from(this.config.bucketName || 'rca-media')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error("[RCA Supabase Storage Error]:", error);
                throw error;
            }

            // Get Public URL
            const { data: publicData } = this.client.storage
                .from(this.config.bucketName || 'rca-media')
                .getPublicUrl(filePath);

            return publicData ? publicData.publicUrl : null;
        } catch (err) {
            console.error("Failed to upload image to Supabase Storage:", err);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // 1. BOOKINGS (Dynamic & Extensible Schema)
    // Protected: Only authenticated admin can read, update status, or delete bookings
    // -------------------------------------------------------------------------
    async fetchBookings(adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        if (!token) {
            // Normal public visitor: Do NOT expose private customer bookings
            return [];
        }

        try {
            // 1. Try secure RPC function first (bypasses direct anon select restriction safely)
            const { data: rpcData, error: rpcError } = await this.client.rpc('rca_admin_fetch_bookings', {
                p_admin_token: token
            });

            let rawRows = null;
            if (!rpcError && Array.isArray(rpcData)) {
                rawRows = rpcData;
            } else {
                // Fallback to direct select if RPC not yet run in SQL Editor
                const { data, error } = await this.client
                    .from('bookings')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw (rpcError || error);
                rawRows = data;
            }

            return (rawRows || []).map(b => {
                const ft = (b.form_type || '').toLowerCase();
                const bt = (b.booking_type || '').toLowerCase();
                const isExplicitSlot = ft.includes('slot') || ft.includes('ground') || bt.includes('slot') || bt.includes('net practice');
                const inferredCategory = isExplicitSlot ? '' : (b.category || (b.form_data && b.form_data.category) || (bt.includes('under') ? b.booking_type : ''));

                return {
                    id: b.id,
                    name: b.name,
                    phone: b.phone,
                    email: b.email,
                    city: b.city,
                    age: b.age,
                    fatherName: b.father_name || (b.form_data && b.form_data.fatherName) || '-',
                    role: b.role,
                    totalPersons: b.total_persons,
                    bookingType: b.booking_type,
                    formType: b.form_type || (isExplicitSlot ? 'slot_booking' : 'academy_admission'),
                    slotDate: b.slot_date,
                    timeSlot: b.time_slot,
                    facilityType: b.facility_type,
                    status: b.status,
                    remarks: b.remarks,
                    category: inferredCategory,
                    dob: b.dob || (b.form_data && b.form_data.dob) || '',
                    utrNumber: b.utr_number || (b.form_data && b.form_data.utrNumber) || '',
                    feeAmount: b.fee_amount || (b.form_data && b.form_data.feeAmount) || (isExplicitSlot ? '' : '1499'),
                    paymentStatus: b.payment_status || (b.form_data && b.form_data.paymentStatus) || (b.utr_number ? 'Pending Verification' : 'New'),
                    formData: b.form_data || {},
                    createdAt: new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                };
            });
        } catch (e) {
            console.warn("[RCA Supabase] fetchBookings error:", e);
            return [];
        }
    }

    async insertBooking(b) {
        if (!this.isConfigured()) return null;
        try {
            const ft = (b.formType || '').toLowerCase();
            const bt = (b.bookingType || '').toLowerCase();
            const isExplicitSlot = ft.includes('slot') || ft.includes('ground') || bt.includes('slot') || bt.includes('net practice');
            const isAdmission = !isExplicitSlot && (ft === 'academy_admission' || ft === 'rrpl_trials' || bt.includes('admission') || bt.includes('rrpl') || bt.includes('trial'));

            const category = isExplicitSlot ? '' : (b.category || (isAdmission ? 'Under-16' : ''));
            const utr = b.utrNumber || '';
            const fee = b.feeAmount || (isAdmission ? '1499' : '');
            const dob = b.dob || '';

            const basePayload = {
                id: b.id,
                name: b.name,
                phone: b.phone,
                email: b.email || '',
                city: b.city || 'Vrindavan',
                age: String(b.age || '-'),
                father_name: b.fatherName || '-',
                role: b.role || (isExplicitSlot ? 'Player / Team' : 'Player'),
                total_persons: b.totalPersons || (category ? category : '1 Player'),
                booking_type: b.bookingType || (isAdmission ? `RCA Trials (${category})` : 'Practice Slot'),
                form_type: b.formType || (isExplicitSlot ? 'slot_booking' : 'academy_admission'),
                slot_date: b.slotDate || new Date().toISOString().split('T')[0],
                time_slot: b.timeSlot || 'Flexible Time',
                facility_type: b.facilityType || 'Turf Pitch',
                status: b.status || 'New',
                remarks: b.remarks || (utr ? `UPI UTR: ${utr} | Fee: ₹${fee}` : ''),
                form_data: {
                    ...(b.formData || {}),
                    category: category,
                    dob: dob,
                    fatherName: b.fatherName || '-',
                    utrNumber: utr,
                    feeAmount: fee,
                    paymentStatus: b.paymentStatus || (utr ? 'Pending Verification' : 'New'),
                    submittedAt: new Date().toISOString()
                }
            };

            // Attempt insert with specific category/payment columns if available in DB
            const extendedPayload = {
                ...basePayload,
                category: category,
                dob: dob,
                utr_number: utr,
                fee_amount: fee,
                payment_status: b.paymentStatus || (utr ? 'Pending Verification' : 'New')
            };

            const { error: fullError } = await this.client
                .from('bookings')
                .insert([extendedPayload]);

            if (!fullError) return true;

            // Graceful fallback to base payload if columns are not yet added to Supabase table
            console.warn("[RCA Supabase] Fallback to base booking schema:", fullError.message);
            const { error: baseError } = await this.client
                .from('bookings')
                .insert([basePayload]);

            if (baseError) throw baseError;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertBooking error:", e);
            return null;
        }
    }

    async updateBookingStatus(id, newStatus, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            // 1. Try secure RPC function with admin token
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'bookings',
                    p_id: id,
                    p_payload: { status: newStatus },
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            // 2. Fallback to direct update
            const { error } = await this.client
                .from('bookings')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateBookingStatus error:", e);
            return false;
        }
    }

    async deleteBooking(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            // 1. Try secure RPC function with admin token
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'bookings',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            // 2. Fallback to direct delete
            const { error } = await this.client
                .from('bookings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteBooking error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 2. TOURNAMENTS
    // -------------------------------------------------------------------------
    async fetchTournaments() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client
                .from('tournaments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map(t => ({
                id: t.id,
                title: t.title,
                shortTag: t.short_tag,
                category: t.category,
                trialFee: t.trial_fee,
                teamFee: t.team_fee,
                feeLabel: t.fee_label,
                dates: t.dates,
                status: t.status,
                winnerPrize: t.winner_prize,
                runnerPrize: t.runner_prize,
                playerOfSeries: t.player_of_series,
                specialAwards: t.special_awards,
                hospitality: t.hospitality,
                telecast: t.telecast,
                venue: t.venue,
                poster: t.poster,
                description: t.description,
                extraData: t.extra_data || {}
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchTournaments error:", e);
            return null;
        }
    }

    async insertTournament(t, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: t.id,
            title: t.title,
            short_tag: t.shortTag || 'TOURNAMENT',
            category: t.category || 'Cricket Championship',
            trial_fee: t.trialFee || 0,
            team_fee: t.teamFee || 0,
            fee_label: t.feeLabel || 'Entry Open',
            dates: t.dates || 'Upcoming',
            status: t.status || 'Registration Open',
            winner_prize: t.winnerPrize || '',
            runner_prize: t.runnerPrize || '',
            player_of_series: t.playerOfSeries || '',
            special_awards: t.specialAwards || '',
            hospitality: t.hospitality || 'RCA Vrindavan',
            telecast: t.telecast || 'Live Match',
            venue: t.venue || 'RCA Ground, Panigaon Raya Road, Vrindavan',
            poster: t.poster || 'assets/images/tournaments/ram-sports-cup-7th.jpg',
            description: t.description || '',
            extra_data: t.extraData || {}
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'tournaments',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('tournaments').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertTournament error:", e);
            return null;
        }
    }

    async updateTournamentFees(id, fees, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            trial_fee: parseInt(fees.trialFee) || 0,
            team_fee: parseInt(fees.teamFee) || 0,
            fee_label: fees.feeLabel || 'Registration Open'
        };
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'tournaments',
                    p_id: id,
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }
            const { error } = await this.client.from('tournaments').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateTournamentFees error:", e);
            return false;
        }
    }

    async deleteTournament(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'tournaments',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('tournaments').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteTournament error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 3. PRACTICE SLOTS & SOLD OUT TOGGLE
    // -------------------------------------------------------------------------
    async fetchSlots() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('slots').select('*').order('created_at', { ascending: true });
            if (error) throw error;

            return data.map(s => ({
                id: s.id,
                title: s.title,
                time: s.time,
                facility: s.facility,
                price: parseInt(s.price) || 1500,
                isAvailable: s.is_available !== false,
                amenities: Array.isArray(s.amenities) ? s.amenities : [],
                qrImage: s.qr_image || "",
                personPrices: (s.extra_data && s.extra_data.personPrices) || s.person_prices || {},
                extraData: s.extra_data || {}
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchSlots error:", e);
            return null;
        }
    }

    async updateSlotAvailability(id, isAvailable, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'slots',
                    p_id: id,
                    p_payload: { is_available: isAvailable },
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('slots').update({ is_available: isAvailable }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateSlotAvailability error:", e);
            return false;
        }
    }

    async insertSlot(s, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: s.id,
            title: s.title,
            time: s.time,
            facility: s.facility,
            price: parseInt(s.price) || 1500,
            is_available: s.isAvailable !== false,
            amenities: Array.isArray(s.amenities) ? s.amenities : ["Turf Pitch", "Coach Supervision"],
            qr_image: s.qrImage || "",
            extra_data: s.extraData || {}
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'slots',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
                console.warn("[RCA Supabase] rca_admin_insert error:", rpcError);
            }

            const { error } = await this.client.from('slots').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertSlot error:", e);
            return null;
        }
    }

    async updateSlotPrice(id, price, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const numPrice = parseInt(price) || 0;
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'slots',
                    p_id: id,
                    p_payload: { price: numPrice },
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }
            const { error } = await this.client.from('slots').update({ price: numPrice }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateSlotPrice error:", e);
            return false;
        }
    }

    async updateSlotPersonPrices(id, personPrices, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'slots',
                    p_id: id,
                    p_payload: { extra_data: { personPrices } },
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }
            const { error } = await this.client.from('slots').update({ extra_data: { personPrices } }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateSlotPersonPrices error:", e);
            return false;
        }
    }

    async deleteSlot(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'slots',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('slots').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteSlot error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 4. GALLERY PHOTOS
    // -------------------------------------------------------------------------
    async fetchGallery() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('gallery').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(g => ({
                id: g.id,
                title: g.title,
                category: g.category,
                image: g.image,
                caption: g.caption,
                extraData: g.extra_data || {}
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchGallery error:", e);
            return null;
        }
    }

    async insertGallery(item, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: item.id,
            title: item.title,
            category: item.category,
            image: item.image,
            caption: item.caption || '',
            extra_data: item.extraData || {}
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'gallery',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('gallery').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertGallery error:", e);
            return null;
        }
    }

    async deleteGallery(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'gallery',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('gallery').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteGallery error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 5. NOTICES
    // -------------------------------------------------------------------------
    async fetchNotices() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('notices').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(n => ({
                id: n.id,
                title: n.title,
                tag: n.tag,
                tagType: n.tag_type,
                date: n.date,
                content: n.content,
                urgent: n.urgent
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchNotices error:", e);
            return null;
        }
    }

    async insertNotice(n, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: n.id,
            title: n.title,
            tag: n.tag,
            tag_type: n.tagType,
            date: n.date,
            content: n.content,
            urgent: !!n.urgent
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'notices',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('notices').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertNotice error:", e);
            return null;
        }
    }

    async deleteNotice(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'notices',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('notices').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteNotice error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 6. BOOKING CATEGORIES & DYNAMIC PRICING
    // -------------------------------------------------------------------------
    async fetchBookingTypes() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('booking_types').select('name, price, label').eq('is_active', true);
            if (error) throw error;
            return data.map(t => ({
                name: t.name,
                price: parseInt(t.price) || 0,
                label: t.label || ''
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchBookingTypes error:", e);
            return null;
        }
    }

    async insertBookingType(name, price = 0, label = '', adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            name,
            price: parseInt(price) || 0,
            label: label || ''
        };
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'booking_types',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('booking_types').insert([{ ...payload, is_active: true }]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertBookingType error:", e);
            return false;
        }
    }

    async updateBookingTypePrice(name, price = 0, label = '', adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            price: parseInt(price) || 0,
            label: label || ''
        };
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'booking_types',
                    p_id: name,
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('booking_types').update(payload).eq('name', name);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateBookingTypePrice error:", e);
            return false;
        }
    }

    async deleteBookingType(name, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'booking_types',
                    p_id: name,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('booking_types').delete().eq('name', name);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] deleteBookingType error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 7. SETTINGS
    // -------------------------------------------------------------------------
    async fetchSettings() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('settings').select('*').eq('id', 'rca_settings').single();
            if (error) throw error;
            const extra = data.extra_data || {};
            const isUtrReq = (data.slot_utr_required !== undefined && data.slot_utr_required !== null)
                ? Boolean(data.slot_utr_required)
                : Boolean(extra.slotUtrRequired !== undefined ? extra.slotUtrRequired : extra.slot_utr_required);

            return {
                academyName: data.academy_name,
                headCoach: data.head_coach,
                phone: data.phone,
                phoneAlternate: data.phone_alternate,
                email: data.email,
                adminNotifyEmail: data.admin_notify_email,
                instagramUrl: data.instagram_url,
                address: data.address,
                admissionFee: parseInt(data.admission_fee) || 1499,
                slotUtrRequired: isUtrReq,
                googleSheetWebhookUrl: data.google_sheet_webhook_url,
                extraData: data.extra_data || {}
            };
        } catch (e) {
            console.warn("[RCA Supabase] fetchSettings error:", e);
            return null;
        }
    }

    async updateSettings(s, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const isUtrReq = (s.slotUtrRequired !== undefined)
            ? Boolean(s.slotUtrRequired)
            : ((s.slot_utr_required !== undefined) ? Boolean(s.slot_utr_required) : false);

        const basePayload = {
            academy_name: s.academyName || s.academy_name || 'RCA (RAM CRICKET ACADEMY)',
            head_coach: s.headCoach || s.head_coach || 'Coach R.K. Chauhan',
            phone: s.phone || '9897517704',
            phone_alternate: s.phoneAlternate || s.phone_alternate || '8265800805',
            email: s.email || 'RCAACADEMY9897@gmail.com',
            admin_notify_email: s.adminNotifyEmail || s.admin_notify_email || 'RCAACADEMY9897@gmail.com',
            instagram_url: s.instagramUrl || s.instagram_url || '',
            address: s.address || '',
            google_sheet_webhook_url: s.googleSheetWebhookUrl || s.google_sheet_webhook_url || '',
            extra_data: {
                ...(s.extraData || {}),
                slotUtrRequired: isUtrReq,
                slot_utr_required: isUtrReq,
                admissionFee: parseInt(s.admissionFee || s.admission_fee) || 1499
            },
            updated_at: new Date().toISOString()
        };

        const extendedPayload = {
            ...basePayload,
            admission_fee: parseInt(s.admissionFee || s.admission_fee) || 1499,
            slot_utr_required: isUtrReq
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'settings',
                    p_id: 'rca_settings',
                    p_payload: extendedPayload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            // Upsert extended payload (with slot_utr_required)
            const { error: extErr } = await this.client.from('settings').upsert({ id: 'rca_settings', ...extendedPayload });
            if (!extErr) return true;

            // Fallback to basePayload (saving slotUtrRequired inside extra_data) if slot_utr_required column doesn't exist
            console.warn("[RCA Supabase] Retrying settings update with extra_data fallback:", extErr.message);
            const { error: baseErr } = await this.client.from('settings').upsert({ id: 'rca_settings', ...basePayload });
            if (baseErr) throw baseErr;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateSettings error:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 8. COMMITTEE MEMBERS (President, Owner, CEO, Coaches)
    // -------------------------------------------------------------------------
    async fetchCommittee() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('committee_members').select('*').order('display_order', { ascending: true });
            if (error) throw error;
            return data.map(m => ({
                id: m.id,
                name: m.name,
                designation: m.designation,
                photo: m.photo,
                bio: m.bio,
                order: m.display_order
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchCommittee fallback (table may not exist yet):", e);
            return null;
        }
    }

    async insertCommitteeMember(item, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: item.id,
            name: item.name,
            designation: item.designation,
            photo: item.photo || '',
            bio: item.bio || '',
            display_order: parseInt(item.order) || 0,
            updated_at: new Date().toISOString()
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'committee_members',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('committee_members').upsert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] insertCommitteeMember warning:", e);
            return null;
        }
    }

    async updateCommitteeMember(id, item, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            name: item.name,
            designation: item.designation,
            photo: item.photo || '',
            bio: item.bio || '',
            display_order: parseInt(item.order) || 0,
            updated_at: new Date().toISOString()
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'committee_members',
                    p_id: id,
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('committee_members').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] updateCommitteeMember warning:", e);
            return null;
        }
    }

    async deleteCommitteeMember(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'committee_members',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('committee_members').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] deleteCommitteeMember warning:", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 9. SPONSORSHIPS & PARTNERS
    // -------------------------------------------------------------------------
    async fetchSponsors() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('sponsors').select('*').order('display_order', { ascending: true });
            if (error) throw error;
            return data.map(s => ({
                id: s.id,
                name: s.name,
                designation: s.designation,
                city: s.city,
                shortInfo: s.short_info,
                logo: s.logo,
                order: s.display_order
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchSponsors fallback (table may not exist yet):", e);
            return null;
        }
    }

    async insertSponsor(item, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            id: item.id,
            name: item.name,
            designation: item.designation,
            city: item.city || '',
            short_info: item.shortInfo || '',
            logo: item.logo || '',
            display_order: parseInt(item.order) || 0,
            updated_at: new Date().toISOString()
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'sponsors',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('sponsors').upsert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] insertSponsor warning:", e);
            return null;
        }
    }

    async updateSponsor(id, item, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        const payload = {
            name: item.name,
            designation: item.designation,
            city: item.city || '',
            short_info: item.shortInfo || '',
            logo: item.logo || '',
            display_order: parseInt(item.order) || 0,
            updated_at: new Date().toISOString()
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'sponsors',
                    p_id: id,
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('sponsors').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] updateSponsor warning:", e);
            return null;
        }
    }

    async deleteSponsor(id, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_delete', {
                    p_table: 'sponsors',
                    p_id: id,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('sponsors').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn("[RCA Supabase] deleteSponsor warning:", e);
            return false;
        }
    }
}

// Global Supabase singleton
window.rcaSupabase = new RcaSupabaseManager();
