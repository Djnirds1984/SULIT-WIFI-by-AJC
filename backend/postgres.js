
const { Pool } = require('pg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: process.env.PGUSER || 'sulituser',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'sulitwifi',
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432,
});

const query = (text, params) => pool.query(text, params);

const checkConnection = async () => {
    let retries = 5;
    while (retries) {
        try {
            console.log(`[DB] Attempting to connect to database (attempt ${6 - retries}/5)...`);
            const client = await pool.connect();
            client.release();
            return;
        } catch (err) {
            console.error(`[DB] Connection attempt ${6 - retries} failed. Retrying in 5 seconds...`);
            if (err.code === '28P01') {
                console.error('[Reason] Authentication failed. Please check the PGPASSWORD in your .env file.');
            } else if (err.code === '3D000') {
                 console.error(`[Reason] Database "${process.env.PGDATABASE || 'sulitwifi'}" does not exist.`);
            }
            retries -= 1;
            if (retries === 0) {
                console.error('[FATAL] Could not connect to the database after multiple retries.');
                throw err;
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};

const initializeDatabase = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vouchers (
            code TEXT PRIMARY KEY,
            duration INT NOT NULL,
            is_used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sessions (
            ip_address TEXT PRIMARY KEY,
            expires_at TIMESTAMPTZ NOT NULL,
            voucher_code TEXT REFERENCES vouchers(code)
        );
    `);
    
    // Seed default settings if they don't exist
    const defaultSettings = {
        adminPassword: bcrypt.hashSync('admin', 10),
        networkConfig: {
            hotspotInterface: 'wlan0',
            ssid: 'SULIT WIFI by AJC',
            security: 'open',
            password: '',
            hotspotIpAddress: '192.168.10.1',
            hotspotDhcpServer: { enabled: true, start: '192.168.10.100', end: '192.168.10.200', lease: '12h' }
        },
        gpioConfig: {
            coinSlotPin: 7,
            relayPin: null,
            statusLightPin: null
        }
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
        await query(`
            INSERT INTO settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO NOTHING;
        `, [key, JSON.stringify(value)]);
    }
};

const getSetting = async (key) => {
    const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
    return rows.length ? rows[0].value : null;
};

const updateSetting = async (key, value) => {
    if (key === 'adminPassword' && typeof value === 'string') {
        value = bcrypt.hashSync(value, 10);
    }
    await query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2;
    `, [key, JSON.stringify(value)]);
};

const generateVoucherCode = () => 'SULIT-' + Math.random().toString(36).substr(2, 6).toUpperCase();

const createVoucher = async (duration) => {
    const code = generateVoucherCode();
    await query('INSERT INTO vouchers (code, duration) VALUES ($1, $2)', [code, duration]);
    return { code, duration, isUsed: false };
};

const activateVoucher = async (code, ipAddress) => {
    const { rows } = await query('SELECT * FROM vouchers WHERE code = $1', [code]);
    if (!rows.length) throw new Error('Voucher not found.');
    if (rows[0].is_used) throw new Error('Voucher has already been used.');
    
    const { duration } = rows[0];
    await query('UPDATE vouchers SET is_used = TRUE WHERE code = $1', [code]);
    await createSession(ipAddress, duration, code);
    return { duration };
};

const createSession = async (ipAddress, duration, voucherCode = null) => {
    const expiresAt = new Date(Date.now() + duration * 1000);
    await query(`
        INSERT INTO sessions (ip_address, expires_at, voucher_code) VALUES ($1, $2, $3)
        ON CONFLICT (ip_address) DO UPDATE SET expires_at = $2, voucher_code = $3;
    `, [ipAddress, expiresAt, voucherCode]);
    return { duration };
};

const getSessionByIp = async (ipAddress) => {
    const { rows } = await query('SELECT * FROM sessions WHERE ip_address = $1', [ipAddress]);
    if (!rows.length || new Date(rows[0].expires_at) < new Date()) {
        return null;
    }
    return { ipAddress: rows[0].ip_address, expiresAt: new Date(rows[0].expires_at) };
};

const deleteSessionByIp = (ipAddress) => query('DELETE FROM sessions WHERE ip_address = $1', [ipAddress]);
const getActiveSessionCount = async () => {
    const { rows } = await query("SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()");
    return parseInt(rows[0].count, 10);
};
const getUsedVoucherCount = async () => {
    const { rows } = await query("SELECT COUNT(*) FROM vouchers WHERE is_used = TRUE");
    return parseInt(rows[0].count, 10);
};
const getUnusedVoucherCount = async () => {
    const { rows } = await query("SELECT COUNT(*) FROM vouchers WHERE is_used = FALSE");
    return parseInt(rows[0].count, 10);
};
const getUnusedVouchers = async () => {
    const { rows } = await query("SELECT code, duration, is_used FROM vouchers WHERE is_used = FALSE ORDER BY created_at DESC");
    return rows.map(r => ({ ...r, isUsed: r.is_used }));
};

// --- Backup & Restore ---
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

const createBackup = () => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `sulitwifi-backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);
    const command = `pg_dump -U ${process.env.PGUSER || 'sulituser'} -h ${process.env.PGHOST || 'localhost'} -d ${process.env.PGDATABASE || 'sulitwifi'} > "${filepath}"`;
    return new Promise((resolve, reject) => {
        exec(command, { env: { ...process.env } }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const restoreBackup = (filename) => {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) throw new Error('Backup file not found.');
    const command = `psql -U ${process.env.PGUSER || 'sulituser'} -h ${process.env.PGHOST || 'localhost'} -d ${process.env.PGDATABASE || 'sulitwifi'} < "${filepath}"`;
    return new Promise((resolve, reject) => {
        exec(command, { env: { ...process.env } }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const listBackups = () => {
    return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql')).sort().reverse();
};

const deleteBackup = (filename) => {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) throw new Error('Backup file not found.');
    fs.unlinkSync(filepath);
};


module.exports = {
    query,
    checkConnection,
    initializeDatabase,
    getSetting,
    updateSetting,
    createVoucher,
    activateVoucher,
    createSession,
    getSessionByIp,
    deleteSessionByIp,
    getActiveSessionCount,
    getUsedVoucherCount,
    getUnusedVoucherCount,
    getUnusedVouchers,
    createBackup,
    restoreBackup,
    listBackups,
    deleteBackup,
};
