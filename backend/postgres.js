

const { Pool } = require('pg');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const bcrypt = require('bcryptjs');

// Normalize and validate environment configuration for Postgres
const rawPassword = process.env.PGPASSWORD;
let normalizedPassword = undefined;
if (rawPassword !== undefined) {
    try {
        // Ensure password is a string to satisfy SCRAM auth requirement
        normalizedPassword = String(rawPassword);
        if (normalizedPassword.length === 0) {
            console.warn('[DB] PGPASSWORD is set but empty. Authentication may fail.');
        }
    } catch (e) {
        console.error('[DB] Failed to normalize PGPASSWORD to string:', e.message);
    }
}

if (rawPassword !== undefined && typeof rawPassword !== 'string') {
    console.warn('[DB] PGPASSWORD was not a string. Coerced to string for SCRAM auth.');
}

const pool = new Pool({
    user: process.env.PGUSER || 'sulituser',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'sulitwifi',
    password: normalizedPassword,
    port: process.env.PGPORT || 5432,
});

const DEFAULT_PORTAL_HTML = `<!-- 
  Welcome to the SULIT WIFI Portal Editor!
  
  This is the default HTML content for your captive portal page.
  The main application is a React Single Page App (SPA), so this
  HTML is NOT currently rendered to the user by default.
  
  This editor is a functional tool to demonstrate how you
  could save and load custom HTML content from the database.
  
  To make this content appear, you would need to modify the server
  to serve this HTML instead of the React app's index.html, or
  find a way to inject it into the React app itself.
-->
<div style="font-family: sans-serif; text-align: center; padding: 2em; color: #333;">
  <h1>Welcome to SULIT WIFI!</h1>
  <p>This is your default portal content.</p>
  <p>You can edit this HTML in the Admin Panel under "Portal Editor".</p>
</div>
`;

const connect = async () => {
    let retries = 5;
    while (retries) {
        try {
            await pool.connect();
            console.log('[DB] Database connection successful.');
            break;
        } catch (err) {
            console.error(`[DB] Connection attempt ${6 - retries} failed. Retrying in 5 seconds...`);
            retries -= 1;
            if (retries === 0) {
                 console.error('[FATAL] Could not connect to the database after multiple retries.');
                 console.error('[Details]:', err.message);
                 // Provide targeted diagnostics for common misconfigurations
                 if (!normalizedPassword) {
                    console.error('[Hint] No valid PGPASSWORD detected. Ensure it is set as a non-empty string.');
                 }
                 if (err.code === '28P01') {
                    console.error('[Reason] Authentication failed. Please check the PGPASSWORD in your .env file.');
                 } else if (err.code === '3D000') {
                    console.error('[Reason] Database "sulitwifi" does not exist. Please run the setup commands in the README.');
                 }
                 throw err;
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};

const columnExists = async (tableName, columnName) => {
    const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName]);
    return res.rowCount > 0;
};


const initSchema = async () => {
    console.log('[DB] Applying necessary database schema updates...');
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value JSONB
        );
        CREATE TABLE IF NOT EXISTS vouchers (
            id SERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            duration INTEGER NOT NULL,
            type TEXT DEFAULT 'VOUCHER',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_used BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            mac_address TEXT UNIQUE NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE NOT NULL,
            voucher_code TEXT
        );
    `);

    // --- Non-destructive Migrations ---
    if (!await columnExists('vouchers', 'is_used')) {
        await pool.query('ALTER TABLE vouchers ADD COLUMN is_used BOOLEAN DEFAULT FALSE;');
        console.log('[DB] Schema updated: Added "is_used" column to vouchers.');
    }
     if (!await columnExists('vouchers', 'created_at')) {
        await pool.query('ALTER TABLE vouchers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        console.log('[DB] Schema updated: Added "created_at" column to vouchers.');
    }
     if (!await columnExists('sessions', 'expires_at')) { // Example of a future migration
        // await pool.query('ALTER TABLE sessions ADD COLUMN expires_at TIMESTAMP;');
    }
    
    // Seed default settings if they don't exist
    const settings = await getSetting('adminPassword');
    if (!settings) {
        console.log('[DB] Seeding default settings...');
        const salt = await bcrypt.genSalt(10);
        const defaultPassword = await bcrypt.hash('admin', salt);
        await updateSetting('adminPassword', defaultPassword);
        
        await updateSetting('portalSettings', {
            portalTitle: 'SULIT WIFI Portal',
            coinSlotEnabled: true,
            coinPulseValue: 15, // minutes
        });
        
        await updateSetting('networkConfig', {
             hotspotInterface: "wlan0",
             ssid: "SULIT WIFI Hotspot",
             security: "open",
             password: "",
             hotspotIpAddress: "192.168.10.1",
             hotspotDhcpServer: {
                 enabled: true,
                 start: "192.168.10.100",
                 end: "192.168.10.200",
                 lease: "12h"
             }
        });
        
        await updateSetting('gpioConfig', {
            coinPin: 17, // Default to BCM 17, a safer general-purpose pin unlikely to conflict with I2C.
            relayPin: 0,
            statusLedPin: 0,
            coinSlotActiveLow: true,
        });

        await updateSetting('portalHtml', DEFAULT_PORTAL_HTML);
    }
    console.log('[DB] Schema updates applied successfully.');
};

const getSetting = async (key) => {
    const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (res.rows.length === 0) return null;
    const raw = res.rows[0].value;
    // For JSONB, node-postgres returns JS primitives/objects directly.
    // If it's a string (e.g., hashed admin password), return as-is without parsing.
    return raw;
};

const updateSetting = async (key, value) => {
    let jsonValue;
    try {
        jsonValue = JSON.stringify(value);
    } catch (e) {
        console.error(`[DB] Failed to serialize value for key ${key}:`, e.message);
        throw e;
    }
    await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb',
        [key, jsonValue]
    );
};

const createVoucher = async (duration, type = 'VOUCHER') => {
    const code = `SULIT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const res = await pool.query(
        'INSERT INTO vouchers (code, duration, type) VALUES ($1, $2, $3) RETURNING *',
        [code, duration, type]
    );
    return res.rows[0];
};

const getVoucherByCode = async (code) => {
     const res = await pool.query('SELECT * FROM vouchers WHERE code = $1', [code]);
     return res.rows[0];
};

const markVoucherAsUsed = async (code) => {
    await pool.query('UPDATE vouchers SET is_used = TRUE WHERE code = $1', [code]);
};

const getAvailableVouchers = async () => {
    const res = await pool.query('SELECT code, duration FROM vouchers WHERE is_used = FALSE ORDER BY created_at DESC');
    return res.rows;
};

const getActiveSessionCount = async () => {
    // This is a placeholder as session management is handled by nodogsplash
    return 0;
};

const getUsedVoucherCount = async () => {
    const res = await pool.query('SELECT COUNT(*) FROM vouchers WHERE is_used = TRUE');
    return parseInt(res.rows[0].count, 10);
};

const getAvailableVoucherCount = async () => {
    const res = await pool.query('SELECT COUNT(*) FROM vouchers WHERE is_used = FALSE');
    return parseInt(res.rows[0].count, 10);
};

const backupDatabase = async (filepath) => {
    const pgUser = process.env.PGUSER || 'sulituser';
    const pgDb = process.env.PGDATABASE || 'sulitwifi';
    const command = `pg_dump -U ${pgUser} -d ${pgDb} -F c -b -v -f ${filepath}`;
    
    // pg_dump might ask for a password if PGPASSWORD is not set in the shell env
    // So we set it for the child process.
    const env = { ...process.env, PGPASSWORD: process.env.PGPASSWORD };

    await execPromise(command, { env });
};


const restoreDatabase = async (filepath) => {
    const pgUser = process.env.PGUSER || 'sulituser';
    const pgDb = process.env.PGDATABASE || 'sulitwifi';
    const command = `pg_restore -U ${pgUser} -d ${pgDb} --clean --if-exists ${filepath}`;
     const env = { ...process.env, PGPASSWORD: process.env.PGPASSWORD };
    await execPromise(command, { env });
};

const resetPortalHtml = async () => {
    await updateSetting('portalHtml', DEFAULT_PORTAL_HTML);
    return DEFAULT_PORTAL_HTML;
};

const close = async () => {
    await pool.end();
};

module.exports = {
    connect,
    initSchema,
    getSetting,
    updateSetting,
    createVoucher,
    getVoucherByCode,
    markVoucherAsUsed,
    getAvailableVouchers,
    getActiveSessionCount,
    getUsedVoucherCount,
    getAvailableVoucherCount,
    backupDatabase,
    restoreDatabase,
    resetPortalHtml,
    DEFAULT_PORTAL_HTML,
    close,
};