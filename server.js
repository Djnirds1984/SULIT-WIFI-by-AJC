// --- SULIT WIFI Unified Server ---
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const DB = require('./backend/postgres.js');

// --- Server Configuration ---
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-and-secure-key-for-jwt';
const COIN_SLOT_GPIO_PIN = 7;
const COIN_SESSION_DURATION_SECONDS = 15 * 60; // 15 minutes
const BACKUP_DIR = path.join(__dirname, 'backups');

const app = express();
app.use(express.json());

// --- Helper Functions ---
const ndsctl = async (command) => {
    return new Promise((resolve, reject) => {
        exec(`sudo /usr/bin/ndsctl ${command}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`ndsctl error: ${stderr}`);
                return reject(new Error(stderr || 'Failed to execute ndsctl command.'));
            }
            resolve(stdout.trim());
        });
    });
};

const executeSystemCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                const errorMessage = stderr || stdout || error.message;
                console.error(`Command error: ${errorMessage}`);
                return reject(new Error(errorMessage));
            }
            resolve(stdout.trim());
        });
    });
};

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// --- GPIO Coin Slot Integration ---
let Gpio;
try {
    Gpio = require('onoff').Gpio;
} catch (e) {
    console.warn('[Portal] GPIO module not found. Running in dev mode (no coin slot).');
    Gpio = null;
}

if (Gpio && Gpio.accessible) {
    try {
        const coinSlot = new Gpio(COIN_SLOT_GPIO_PIN, 'in', 'falling', { debounceTimeout: 100 });
        coinSlot.watch(async (err) => {
            if (err) {
                console.error('[Portal] Error watching coin slot:', err);
                return;
            }
            console.log('[Portal] Coin inserted!');
            try {
                const mac = await DB.getLastUnauthenticatedMac();
                if (mac) {
                    console.log(`[Portal] Activating coin session for last seen MAC: ${mac}`);
                    await DB.createSession(mac, 'COIN_INSERT', COIN_SESSION_DURATION_SECONDS);
                    await ndsctl(`auth ${mac} ${COIN_SESSION_DURATION_SECONDS}`);
                } else {
                    console.warn('[Portal] Coin inserted, but no recent unauthenticated MAC address found.');
                }
            } catch (e) {
                console.error('[Portal] Failed to process coin insertion:', e);
            }
        });
        console.log(`[Portal] GPIO pin ${COIN_SLOT_GPIO_PIN} initialized for coin slot.`);

        process.on('SIGINT', () => {
            coinSlot.unexport();
            process.exit();
        });
    } catch (gpioError) {
        console.error(`[Portal] Failed to initialize GPIO pin ${COIN_SLOT_GPIO_PIN}. Please check permissions. Error:`, gpioError);
    }
}


// --- API Routes ---

// --- Public / User Portal API ---
app.get('/api/public/settings', async (req, res) => {
    try {
        const ssidSetting = await DB.getSetting('networkSsid');
        res.json({
            ssid: ssidSetting?.value ? JSON.parse(ssidSetting.value) : 'SULIT WIFI',
            geminiApiKey: process.env.API_KEY || null
        });
    } catch (error) {
        res.status(500).json({ message: 'Could not load network settings.' });
    }
});

app.post('/api/sessions/voucher', async (req, res) => {
    const { code } = req.body;
    const mac = req.query.mac;

    if (!code || !mac) {
        return res.status(400).json({ message: 'Voucher code and MAC address are required.' });
    }

    try {
        const voucher = await DB.getVoucher(code);
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found.' });
        }
        if (voucher.used) {
            return res.status(400).json({ message: 'Voucher has already been used.' });
        }

        await ndsctl(`auth ${mac} ${voucher.duration}`);
        await DB.useVoucher(code);
        const session = await DB.createSession(mac, code, voucher.duration);

        res.json(session);
    } catch (error) {
        console.error('Voucher activation error:', error);
        res.status(500).json({ message: 'Failed to activate voucher.' });
    }
});

app.post('/api/sessions/coin', async (req, res) => {
    const mac = req.query.mac;
    if (!mac) {
        return res.status(400).json({ message: 'MAC address is required.' });
    }
    try {
        await ndsctl(`auth ${mac} ${COIN_SESSION_DURATION_SECONDS}`);
        const session = await DB.createSession(mac, 'COIN_WEB', COIN_SESSION_DURATION_SECONDS);
        res.json(session);
    } catch (error) {
        console.error('Coin session error:', error);
        res.status(500).json({ message: 'Failed to start coin session.' });
    }
});


app.get('/api/sessions/current', async (req, res) => {
    const mac = req.query.mac;
    if (!mac) {
        return res.status(400).json({ message: 'MAC address is required.' });
    }
    try {
        // Track the MAC address to associate with a physical coin drop
        await DB.trackUnauthenticatedMac(mac);
        
        const session = await DB.getSession(mac);
        if (session) {
            res.json(session);
        } else {
            res.status(404).json({ message: 'No active session found.' });
        }
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({ message: 'Failed to check session.' });
    }
});

app.delete('/api/sessions/current', async (req, res) => {
    const mac = req.query.mac;
    if (!mac) {
        return res.status(400).json({ message: 'MAC address is required.' });
    }
    try {
        await ndsctl(`deauth ${mac}`);
        await DB.deleteSession(mac);
        res.status(204).send();
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Failed to logout.' });
    }
});


// --- Admin API ---
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    try {
        const admin = await DB.getAdminUser();
        if (!admin) {
            return res.status(500).json({ message: "Admin account not found." });
        }
        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password." });
        }
        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    try {
        const [activeSessions, totalVouchersUsed, totalVouchersAvailable] = await Promise.all([
            DB.getActiveSessionCount(),
            DB.getUsedVoucherCount(),
            DB.getAvailableVoucherCount()
        ]);
        res.json({ activeSessions, totalVouchersUsed, totalVouchersAvailable });
    } catch (error) {
        console.error('[API /stats] Failed to fetch dashboard stats:', error);
        res.status(500).json({ message: "Failed to fetch dashboard stats." });
    }
});

app.get('/api/admin/system-info', authMiddleware, async (req, res) => {
     try {
        const [cpuInfo, memInfo, diskInfo] = await Promise.all([
            executeSystemCommand("lscpu | grep 'Model name:' | sed 's/Model name:[[:space:]]*//'"),
            executeSystemCommand("free -m | grep Mem | awk '{print $2,$3}'"),
            executeSystemCommand("df -m / | tail -n 1 | awk '{print $2,$3}'")
        ]);
        
        const cores = await executeSystemCommand("nproc");
        const [totalMem, usedMem] = memInfo.split(' ');
        const [totalDisk, usedDisk] = diskInfo.split(' ');

        res.json({
            cpu: { model: cpuInfo.trim(), cores: parseInt(cores, 10) },
            ram: { totalMb: parseInt(totalMem, 10), usedMb: parseInt(usedMem, 10) },
            disk: { totalMb: parseInt(totalDisk, 10), usedMb: parseInt(usedDisk, 10) },
        });
    } catch (error) {
        console.error("Failed to fetch system info:", error);
        res.status(500).json({ message: "Could not load system info." });
    }
});

app.get('/api/admin/network-info', authMiddleware, async (req, res) => {
     try {
        const output = await executeSystemCommand("ip -j a");
        const interfaces = JSON.parse(output);
        const result = interfaces.map(iface => {
            const ip4 = iface.addr_info.find(addr => addr.family === 'inet');
            const ip6 = iface.addr_info.find(addr => addr.family === 'inet6');
            return {
                name: iface.ifname,
                status: iface.operstate,
                ip4: ip4 ? `${ip4.local}/${ip4.prefixlen}` : null,
                ip6: ip6 ? `${ip6.local}/${ip6.prefixlen}` : null,
            };
        });
        res.json(result);
    } catch (error) {
        console.error("Failed to fetch network info:", error);
        res.status(500).json({ message: "Could not load network interfaces." });
    }
});

app.get('/api/admin/network-wan-info', authMiddleware, async (req, res) => {
    try {
        // This command reliably finds the interface used for the default route (i.e., the WAN interface).
        const wanInterface = await executeSystemCommand("ip route | grep default | awk '{print $5}'");
        res.json({ name: wanInterface || 'Unknown' });
    } catch (error) {
        console.error("Failed to detect WAN interface:", error);
        res.status(500).json({ message: "Could not detect WAN interface." });
    }
});


app.get('/api/admin/vouchers', authMiddleware, async (req, res) => {
    try {
        const vouchers = await DB.getVouchers(false);
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch vouchers.' });
    }
});

app.post('/api/admin/vouchers', authMiddleware, async (req, res) => {
    const { duration } = req.body;
    if (!duration || typeof duration !== 'number') {
        return res.status(400).json({ message: 'Invalid duration provided.' });
    }
    try {
        const code = await DB.createVoucher(duration);
        res.status(201).json({ code });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate voucher.' });
    }
});

app.get('/api/admin/settings', authMiddleware, async (req, res) => {
    try {
        const ssidSetting = await DB.getSetting('networkSsid');
        res.json({ ssid: ssidSetting?.value ? JSON.parse(ssidSetting.value) : 'SULIT WIFI' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load settings.' });
    }
});

app.put('/api/admin/settings', authMiddleware, async (req, res) => {
    const { ssid } = req.body;
    try {
        await DB.updateSetting('networkSsid', ssid);
        // Note: Changing the SSID in the database doesn't automatically change the system's Wi-Fi config.
        // This requires integration with hostapd or similar, which is complex and OS-dependent.
        // For now, this setting is cosmetic for the portal UI.
        res.json({ message: 'SSID updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save settings.' });
    }
});

app.get('/api/admin/network-config', authMiddleware, async(req, res) => {
    try {
        const setting = await DB.getSetting('networkConfig');
        if (setting && setting.value) {
            res.json(JSON.parse(setting.value));
        } else {
            // If setting is not found, return a default configuration.
            // This prevents a crash if the DB row is missing and allows the admin to set it.
            console.warn('[Admin] networkConfig setting not found in DB. Returning default.');
            res.json({
                hotspotInterface: "wlan0",
                hotspotIpAddress: "192.168.200.13",
                hotspotDhcpServer: {
                    enabled: true,
                    start: "192.168.200.100",
                    end: "192.168.200.200",
                    lease: "12h"
                }
            });
        }
    } catch (error) {
        console.error('[API /network-config] Error loading network config:', error);
        res.status(500).json({ message: 'Failed to load network configuration.' });
    }
});

app.put('/api/admin/network-config', authMiddleware, async (req, res) => {
    const config = req.body;
    try {
        await DB.updateSetting('networkConfig', config);

        // --- Persist network config for reboot ---
        const configPath = '/etc/network/interfaces.d/60-sulit-wifi-hotspot';
        const { hotspotInterface, hotspotIpAddress } = config;

        // Ensure directory exists
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            console.log(`[Admin] Creating network config directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const fileContent = `
# SULIT WIFI Hotspot Configuration (managed by admin panel)
auto ${hotspotInterface}
iface ${hotspotInterface} inet static
    address ${hotspotIpAddress}
    netmask 255.255.255.0
`;
        fs.writeFileSync(configPath, fileContent.trim());
        console.log(`[Admin] Wrote interface config to ${configPath}`);
        
        // --- Apply network changes live ---
        // This is a more robust sequence to avoid "already assigned" errors.
        const applyCommand = `
            sudo ip addr flush dev ${hotspotInterface} && 
            sudo ifdown ${hotspotInterface} || true && 
            sudo ifup ${hotspotInterface}
        `;
        await executeSystemCommand(applyCommand);
        
        res.json({ message: 'Configuration saved and applied.' });
    } catch (error) {
        console.error('Network config update error:', error);
        res.status(500).json({ message: `Failed to update and apply network configuration.` });
    }
});

app.post('/api/admin/database/reset', authMiddleware, async (req, res) => {
    try {
        await DB.resetDatabase();
        res.json({ message: "Database has been reset. Server is restarting..." });

        // Use PM2 to restart the app after a short delay
        setTimeout(() => {
            exec('pm2 restart sulit-wifi', (err) => {
                if (err) {
                    console.error("Failed to restart with PM2:", err);
                }
            });
        }, 1000);

    } catch (error) {
        console.error("Database reset error:", error);
        res.status(500).json({ message: "Failed to reset database." });
    }
});


// --- Backup and Restore API ---
app.get('/api/admin/backups/list', authMiddleware, async (req, res) => {
    try {
        const files = await fs.promises.readdir(BACKUP_DIR);
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .sort()
            .reverse(); // Show newest first
        res.json(backupFiles);
    } catch (error) {
        if (error.code === 'ENOENT') { // Directory doesn't exist yet
            return res.json([]);
        }
        console.error("Failed to list backups:", error);
        res.status(500).json({ message: "Could not list backups." });
    }
});

app.post('/api/admin/backups/create', authMiddleware, async (req, res) => {
    try {
        const backupData = await DB.createBackupData();
        const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
        const filename = `sulitwifi_backup_${timestamp}.json`;
        const filepath = path.join(BACKUP_DIR, filename);
        
        await fs.promises.writeFile(filepath, JSON.stringify(backupData, null, 2));
        
        res.status(201).json({ message: `Backup created successfully: ${filename}` });
    } catch (error) {
        console.error("Failed to create backup:", error);
        res.status(500).json({ message: "Failed to create backup." });
    }
});

app.post('/api/admin/backups/restore', authMiddleware, async (req, res) => {
    const { filename } = req.body;
    if (!filename || !filename.endsWith('.json') || filename.includes('..')) {
        return res.status(400).json({ message: "Invalid filename." });
    }
    try {
        const filepath = path.join(BACKUP_DIR, filename);
        const fileContent = await fs.promises.readFile(filepath, 'utf-8');
        const backupData = JSON.parse(fileContent);
        await DB.restoreFromBackup(backupData);
        res.json({ message: `Restored from ${filename}. Server is restarting...` });
        setTimeout(() => {
            exec('pm2 restart sulit-wifi', (err) => {
                if (err) console.error("Failed to restart with PM2:", err);
            });
        }, 1000);
    } catch (error) {
        console.error(`Failed to restore backup ${filename}:`, error);
        res.status(500).json({ message: `Failed to restore from backup. Error: ${error.message}` });
    }
});

app.delete('/api/admin/backups/delete', authMiddleware, async (req, res) => {
    const { filename } = req.body;
    if (!filename || !filename.endsWith('.json') || filename.includes('..')) {
        return res.status(400).json({ message: "Invalid filename." });
    }
    try {
        const filepath = path.join(BACKUP_DIR, filename);
        await fs.promises.unlink(filepath);
        res.json({ message: `Deleted backup: ${filename}` });
    } catch (error) {
        console.error(`Failed to delete backup ${filename}:`, error);
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: "Backup file not found." });
        }
        res.status(500).json({ message: "Failed to delete backup." });
    }
});

// Placeholder routes for features not yet implemented on backend
app.get('/api/admin/portal-html', authMiddleware, (req, res) => res.json({ html: `<h1>SULIT WIFI Portal</h1><p>Placeholder</p>` }));
app.put('/api/admin/portal-html', authMiddleware, (req, res) => res.json({ message: 'Saved successfully.' }));
app.post('/api/admin/portal-html/reset', authMiddleware, (req, res) => res.json({ html: `<h1>SULIT WIFI Portal</h1><p>Placeholder</p>` }));
app.get('/api/admin/updater/status', authMiddleware, (req, res) => res.json({ isUpdateAvailable: false, statusText: 'Updater not implemented.', localCommit: 'N/A' }));
app.post('/api/admin/updater/update', authMiddleware, (req, res) => res.status(501).json({ message: 'Not Implemented' }));


// --- Static File Serving & SPA Fallback ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// For any route not matched by API or static files, serve the SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// --- Server Startup ---
const startServer = async () => {
    try {
        console.log('[DB] Connecting to database...');
        await DB.checkConnection();
        console.log('[DB] Database connection successful.');

        console.log('[DB] Initializing database schema...');
        await DB.initializeDatabase();
        console.log('[DB] Database schema is up to date.');

        console.log('[Server] Ensuring backup directory exists...');
        await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
        console.log(`[Server] Backup directory is ready at ${BACKUP_DIR}`);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[Server] SULIT WIFI Portal listening on http://0.0.0.0:${PORT}`);
        });

    } catch (error) {
        console.error('\n[FATAL] A critical error occurred during startup:');
        if (error.code === '28P01') { // PostgreSQL password auth failed
             console.error('[DB] Could not connect to database. Please check that the PGPASSWORD in your .env file is correct.\n');
        } else if (error.code === '42501') { // PostgreSQL permission denied
            console.error('[DB] The database user does not have permission. Please run:');
            console.error(`[DB] "ALTER DATABASE ${process.env.PGDATABASE} OWNER TO ${process.env.PGUSER};" in psql.\n`);
        } else {
             console.error('[Details]:', error);
        }
        process.exit(1);
    }
};

startServer();