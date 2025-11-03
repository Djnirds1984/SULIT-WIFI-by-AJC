// --- PostgreSQL Database Module ---
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  // FIX: Add timeouts to make the connection pool more resilient.
  // This prevents errors from stale connections, especially for the dashboard.
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds.
  connectionTimeoutMillis: 5000, // Return an error if connection takes > 5 seconds.
});

// A helper function to execute queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // console.log('[DB] Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('[DB] Error executing query:', { text });
        throw error;
    }
};

const checkConnection = async () => {
    await pool.query('SELECT NOW()');
};

const initializeDatabase = async () => {
    // ONE-TIME FIX: Drop the sessions table to ensure a clean schema.
    // This resolves a bug where an old, incorrect table structure caused dashboard errors.
    // This will clear active sessions but is necessary to repair the database.
    await query(`DROP TABLE IF EXISTS sessions;`);

    // Create tables if they don't exist
    await query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL
        );
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS vouchers (
            code TEXT PRIMARY KEY,
            duration INT NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS sessions (
            mac_address TEXT PRIMARY KEY,
            voucher_code TEXT,
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL
        );
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS admin (
            id INT PRIMARY KEY,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL
        );
    `);
    // Track last seen MAC for coin slot functionality
     await query(`
        CREATE TABLE IF NOT EXISTS last_seen_mac (
            id INT PRIMARY KEY,
            mac_address TEXT NOT NULL,
            seen_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    
    // Seed initial data if it doesn't exist
    await seedInitialData();
};

const seedInitialData = async () => {
    const adminRes = await query('SELECT * FROM admin WHERE id = 1');
    if (adminRes.rowCount === 0) {
        console.log('[DB] No admin user found. Seeding default admin...');
        const passwordHash = await bcrypt.hash('admin', 10);
        await query('INSERT INTO admin (id, username, password_hash) VALUES (1, $1, $2)', ['admin', passwordHash]);
        console.log('[DB] Default admin user created with password "admin". PLEASE CHANGE THIS!');
    }

    const ssidRes = await query("SELECT * FROM settings WHERE key = 'networkSsid'");
    if (ssidRes.rowCount === 0) {
        await query("INSERT INTO settings (key, value) VALUES ('networkSsid', $1)", [JSON.stringify('SULIT WIFI')]);
    }
    
    const netConfigRes = await query("SELECT * FROM settings WHERE key = 'networkConfig'");
    if (netConfigRes.rowCount === 0) {
        const defaultConfig = {
            wanInterface: "eth0",
            hotspotInterface: "wlan0",
            hotspotIpAddress: "192.168.200.13",
            hotspotDhcpServer: {
                enabled: true,
                start: "192.168.200.100",
                end: "192.168.200.200",
                lease: "12h"
            }
        };
        await query("INSERT INTO settings (key, value) VALUES ('networkConfig', $1)", [JSON.stringify(defaultConfig)]);
    }
};


// --- VOUCHER FUNCTIONS ---
const getVoucher = async (code) => {
    const res = await query('SELECT * FROM vouchers WHERE code = $1', [code]);
    return res.rows[0];
};

const useVoucher = async (code) => {
    await query('UPDATE vouchers SET used = TRUE WHERE code = $1', [code]);
};

const createVoucher = async (duration) => {
    // Generate a simple random code
    const code = 'SULIT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await query('INSERT INTO vouchers (code, duration) VALUES ($1, $2)', [code, duration]);
    return code;
};

const getVouchers = async (used = false) => {
    const res = await query('SELECT code, duration FROM vouchers WHERE used = $1 ORDER BY created_at DESC', [used]);
    return res.rows;
};

const getUsedVoucherCount = async () => {
    const res = await query('SELECT COUNT(*) FROM vouchers WHERE used = TRUE');
    return parseInt(res.rows[0].count, 10);
}
const getAvailableVoucherCount = async () => {
    const res = await query('SELECT COUNT(*) FROM vouchers WHERE used = FALSE');
    return parseInt(res.rows[0].count, 10);
}


// --- SESSION FUNCTIONS ---
const createSession = async (mac, voucherCode, durationSeconds) => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    await query(
        'INSERT INTO sessions (mac_address, voucher_code, start_time, end_time) VALUES ($1, $2, $3, $4) ON CONFLICT (mac_address) DO UPDATE SET start_time = $3, end_time = $4',
        [mac, voucherCode, startTime, endTime]
    );
    return { voucherCode, startTime: startTime.getTime(), duration: durationSeconds, remainingTime: durationSeconds };
};

const getSession = async (mac) => {
    const res = await query('SELECT * FROM sessions WHERE mac_address = $1', [mac]);
    const session = res.rows[0];
    if (!session) return null;

    const now = new Date();
    const endTime = new Date(session.end_time);
    const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));
    
    if (remainingTime <= 0) {
        return null; // Session expired
    }

    return {
        voucherCode: session.voucher_code,
        startTime: new Date(session.start_time).getTime(),
        duration: Math.floor((endTime - new Date(session.start_time)) / 1000),
        remainingTime,
    };
};

const deleteSession = async (mac) => {
    await query('DELETE FROM sessions WHERE mac_address = $1', [mac]);
};

const getActiveSessionCount = async () => {
    const res = await query("SELECT COUNT(*) FROM sessions WHERE end_time > NOW()");
    return parseInt(res.rows[0].count, 10);
};

// --- Coin Slot Helpers ---
const trackUnauthenticatedMac = async (mac) => {
    await query('INSERT INTO last_seen_mac (id, mac_address, seen_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET mac_address = $2, seen_at = NOW()', [mac, mac]);
};

const getLastUnauthenticatedMac = async () => {
    // Get the last seen MAC, but only if it's been seen in the last 2 minutes
    const res = await query("SELECT mac_address FROM last_seen_mac WHERE id = 1 AND seen_at > NOW() - INTERVAL '2 minutes'");
    return res.rows[0]?.mac_address;
};


// --- ADMIN/SETTINGS FUNCTIONS ---
const getAdminUser = async () => {
    const res = await query('SELECT * FROM admin WHERE id = 1');
    return res.rows[0];
};

const getSetting = async (key) => {
    const res = await query("SELECT value FROM settings WHERE key = $1", [key]);
    return res.rows[0];
};

const updateSetting = async (key, value) => {
    const valueJson = JSON.stringify(value);
    await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, valueJson]);
};

module.exports = {
    query,
    checkConnection,
    initializeDatabase,
    getVoucher,
    useVoucher,
    createVoucher,
    getVouchers,
    getUsedVoucherCount,
    getAvailableVoucherCount,
    createSession,
    getSession,
    deleteSession,
    getActiveSessionCount,
    trackUnauthenticatedMac,
    getLastUnauthenticatedMac,
    getAdminUser,
    getSetting,
    updateSetting,
};