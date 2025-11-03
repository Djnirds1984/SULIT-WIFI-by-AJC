// SULIT WIFI - PostgreSQL Database Module
// NOTE: This file has a .ts extension but contains JavaScript for compatibility
// with the existing Node.js server setup.
// FIX: Add reference to node types to resolve errors with `require`, `process`, and `module`.
/// <reference types="node" />

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// The connection pool will automatically use environment variables
// (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT)
const pool = new Pool();

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

// Generic query function for logging and execution
// FIX: Made params argument optional to handle queries without parameters and added types.
const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // console.log('[DB] Executed Query:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('[DB] Error executing query:', { text });
        throw error;
    }
};

// --- Schema Initialization ---
const initializeDatabase = async () => {
    console.log('[DB] Initializing database schema...');
    try {
        // SETTINGS TABLE (stores SSID, network config, etc.)
        await query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL
            );
        `);

        // ADMIN TABLE (for login)
        await query(`
            CREATE TABLE IF NOT EXISTS admin (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                session_token TEXT
            );
        `);

        // VOUCHERS TABLE
        await query(`
            CREATE TABLE IF NOT EXISTS vouchers (
                code TEXT PRIMARY KEY,
                duration_seconds INTEGER NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // SESSIONS TABLE (active user sessions)
        await query(`
            CREATE TABLE IF NOT EXISTS sessions (
                mac_address TEXT PRIMARY KEY,
                voucher_code TEXT,
                start_time TIMESTAMPTZ NOT NULL,
                duration_seconds INTEGER NOT NULL
            );
        `);

        console.log('[DB] All tables created or already exist.');
        
        // Seed database with initial required data if it's empty
        await seedInitialData();

    } catch (error) {
        console.error('[DB] FATAL: Could not initialize database schema.', error);
        process.exit(1);
    }
};

const seedInitialData = async () => {
    // Seed default admin user if none exists
    const adminRes = await query('SELECT COUNT(*) FROM admin');
    if (adminRes.rows[0].count === '0') {
        const defaultPassword = 'admin'; // This should be changed immediately by the user
        const saltRounds = 10;
        const hash = await bcrypt.hash(defaultPassword, saltRounds);
        await query(`
            INSERT INTO admin (username, password_hash) VALUES ($1, $2);
        `, ['admin', hash]);
        console.log('[DB] Seeded database with default admin user. Please change the password.');
    }

    // Seed default settings if they don't exist
    const defaultSettings = {
        ssid: 'SULIT WIFI Hotspot',
        networkConfiguration: {
            wanInterface: 'eth0',
            hotspotInterface: 'wlan0',
            hotspotIpAddress: '192.168.200.13',
            hotspotDhcpServer: {
                enabled: true,
                start: '192.168.200.100',
                end: '192.168.200.200',
                lease: '12h',
            },
        },
    };
    
    await query(
        `INSERT INTO settings (key, value) VALUES ('app_settings', $1) ON CONFLICT (key) DO NOTHING;`,
        [JSON.stringify(defaultSettings)]
    );
     console.log('[DB] Default settings verified.');
};


// --- Module Exports (Database API) ---

module.exports = {
    initializeDatabase,
    query,

    // --- Admin & Auth ---
    getAdminUser: async () => {
        const res = await query('SELECT * FROM admin WHERE username = $1', ['admin']);
        return res.rows[0];
    },
    updateAdminToken: async (token) => {
        await query('UPDATE admin SET session_token = $1 WHERE username = $2', [token, 'admin']);
    },
    
    // --- Sessions ---
    getSession: async (macAddress) => {
        const res = await query('SELECT * FROM sessions WHERE mac_address = $1', [macAddress]);
        return res.rows[0];
    },
    createSession: async (macAddress, voucherCode, durationSeconds) => {
        await query(
            'INSERT INTO sessions (mac_address, voucher_code, start_time, duration_seconds) VALUES ($1, $2, NOW(), $3)',
            [macAddress, voucherCode, durationSeconds]
        );
    },
    deleteSession: async (macAddress) => {
        await query('DELETE FROM sessions WHERE mac_address = $1', [macAddress]);
    },

    // --- Vouchers ---
    getVoucherByCode: async (code) => {
        const res = await query('SELECT code, duration_seconds, is_used FROM vouchers WHERE code = $1', [code]);
        return res.rows[0];
    },
    getAllVouchers: async () => {
        const res = await query('SELECT code, duration_seconds as duration, is_used as used FROM vouchers ORDER BY created_at DESC');
        return res.rows;
    },
    useVoucher: async (code) => {
        await query('UPDATE vouchers SET is_used = TRUE WHERE code = $1', [code]);
    },
    createNewVoucher: async (code, duration) => {
        const res = await query(
            'INSERT INTO vouchers (code, duration_seconds) VALUES ($1, $2) RETURNING *',
            [code, duration]
        );
        return res.rows[0];
    },

    // --- Stats ---
    getDashboardStats: async () => {
        const sessionsRes = query('SELECT COUNT(*) FROM sessions');
        const usedRes = query("SELECT COUNT(*) FROM vouchers WHERE is_used = TRUE");
        const availableRes = query("SELECT COUNT(*) FROM vouchers WHERE is_used = FALSE");

        const [sessions, used, available] = await Promise.all([sessionsRes, usedRes, availableRes]);
        
        return {
            activeSessions: parseInt(sessions.rows[0].count, 10),
            totalVouchersUsed: parseInt(used.rows[0].count, 10),
            totalVouchersAvailable: parseInt(available.rows[0].count, 10),
        };
    },

    // --- Settings ---
    getSettings: async () => {
        const res = await query("SELECT value FROM settings WHERE key = 'app_settings'");
        if (res.rows.length === 0) {
            console.error("CRITICAL: No settings found in database.");
            // Fallback to a default to prevent crash
            return {
                ssid: 'SULIT WIFI (DB Error)',
                networkConfiguration: { wanInterface: 'eth0', hotspotInterface: 'wlan0' }
            };
        }
        return res.rows[0].value;
    },
    updateSettings: async (settings) => {
        await query(
            "INSERT INTO settings (key, value) VALUES ('app_settings', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [JSON.stringify(settings)]
        );
    },
};
