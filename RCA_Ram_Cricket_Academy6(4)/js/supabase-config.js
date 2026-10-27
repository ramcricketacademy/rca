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

            return (rawRows || []).map(b => ({
                id: b.id,
                name: b.name,
                phone: b.phone,
                email: b.email,
                city: b.city,
                age: b.age,
                fatherName: b.father_name,
                role: b.role,
                totalPersons: b.total_persons,
                bookingType: b.booking_type,
                formType: b.form_type || 'slot_booking',
                slotDate: b.slot_date,
                timeSlot: b.time_slot,
                facilityType: b.facility_type,
                status: b.status,
                remarks: b.remarks,
                formData: b.form_data || {},
                createdAt: new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            }));
        } catch (e) {
            console.warn("[RCA Supabase] fetchBookings error:", e);
            return [];
        }
    }

    async insertBooking(b) {
        if (!this.isConfigured()) return null;
        try {
            const payload = {
                id: b.id,
                name: b.name,
                phone: b.phone,
                email: b.email || '',
                city: b.city || 'Vrindavan',
                age: String(b.age || '-'),
                father_name: b.fatherName || '-',
                role: b.role || 'Player',
                total_persons: b.totalPersons || '1 Player',
                booking_type: b.bookingType || 'Practice Slot',
                form_type: b.formType || 'slot_booking',
                slot_date: b.slotDate || '',
                time_slot: b.timeSlot || '',
                facility_type: b.facilityType || 'Turf Pitch',
                status: b.status || 'New',
                remarks: b.remarks || '',
                form_data: b.formData || {}
            };

            const { error } = await this.client
                .from('bookings')
                .insert([payload]);

            if (error) throw error;
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
                price: s.price,
                isAvailable: s.is_available,
                amenities: s.amenities || [],
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
            price: s.price,
            is_available: s.isAvailable !== false,
            amenities: s.amenities || [],
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
            }

            const { error } = await this.client.from('slots').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertSlot error:", e);
            return null;
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
    // 6. BOOKING CATEGORIES (Dynamic Dropdown List)
    // -------------------------------------------------------------------------
    async fetchBookingTypes() {
        if (!this.isConfigured()) return null;
        try {
            const { data, error } = await this.client.from('booking_types').select('name').eq('is_active', true);
            if (error) throw error;
            return data.map(t => t.name);
        } catch (e) {
            console.warn("[RCA Supabase] fetchBookingTypes error:", e);
            return null;
        }
    }

    async insertBookingType(name, adminToken = null) {
        if (!this.isConfigured()) return null;
        const token = this.getAdminToken(adminToken);
        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_insert', {
                    p_table: 'booking_types',
                    p_payload: { name },
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('booking_types').insert([{ name, is_active: true }]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] insertBookingType error:", e);
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
            return {
                academyName: data.academy_name,
                headCoach: data.head_coach,
                phone: data.phone,
                phoneAlternate: data.phone_alternate,
                email: data.email,
                adminNotifyEmail: data.admin_notify_email,
                instagramUrl: data.instagram_url,
                address: data.address,
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
        const payload = {
            academy_name: s.academyName,
            head_coach: s.headCoach,
            phone: s.phone,
            phone_alternate: s.phoneAlternate,
            email: s.email,
            admin_notify_email: s.adminNotifyEmail,
            instagram_url: s.instagramUrl,
            address: s.address,
            google_sheet_webhook_url: s.googleSheetWebhookUrl,
            updated_at: new Date().toISOString()
        };

        try {
            if (token) {
                const { error: rpcError } = await this.client.rpc('rca_admin_update', {
                    p_table: 'settings',
                    p_id: 'rca_settings',
                    p_payload: payload,
                    p_admin_token: token
                });
                if (!rpcError) return true;
            }

            const { error } = await this.client.from('settings').upsert({ id: 'rca_settings', ...payload });
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("[RCA Supabase] updateSettings error:", e);
            return false;
        }
    }
}

// Global Supabase singleton
window.rcaSupabase = new RcaSupabaseManager();
