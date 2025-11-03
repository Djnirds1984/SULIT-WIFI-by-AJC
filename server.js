// --- Main Server File for SULIT WIFI Portal ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const db = require('./backend/postgres.js');

// --- Configuration ---
const PORTAL_PORT = 3001;
const ADMIN_PORT = 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key-that-is-long';
const COIN_SLOT_GPIO_PIN = 7;
const COIN_SESSION_DURATION_SECONDS = 15 * 60; // 15 minutes

const portalApp = express();
const adminApp = express();

// --- Middleware ---
portalApp.use(cors());
adminApp.use(cors());
// Apply a global body parser to both apps. This is crucial for the proxy fix.
portalApp.use(express.json());
adminApp.use(express.json());


// --- Helper Functions ---
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command error: ${stderr}`);
                return reject(new Error(stderr || 'Command failed to execute.'));
            }
            resolve(stdout.trim());
        });
    });
};

const ndsctl = async (subcommand, mac) => {
    try {
        await executeCommand(`sudo /usr/bin/ndsctl ${subcommand} ${mac}`);
        console.log(`[NDSCTL] Executed: ${subcommand} for MAC ${mac}`);
    } catch (error) {
        console.error(`[NDSCTL] Failed to execute ${subcommand} for MAC ${mac}:`, error);
        // Don't throw, as some commands might fail if user is already gone
    }
};

const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

// --- GPIO Coin Slot Initialization ---
try {
    const { Gpio } = require('onoff');
    const coinSlot = new Gpio(COIN_SLOT_GPIO_PIN, 'in', 'falling', { debounceTimeout: 50 });

    coinSlot.watch(async (err, value) => {
        if (err) {
            console.error('[GPIO] Error watching coin slot:', err);
            return;
        }
        console.log('[GPIO] Coin inserted! Creating session...');
        
        // Find the most recent unauthenticated user to grant access to.
        try {
            const lastMac = await db.getLastUnauthenticatedMac();
            if (lastMac) {
                console.log(`[Portal] Activating coin session for last seen MAC: ${lastMac}`);
                 await db.createSession(lastMac, 'COIN_INSERT', COIN_SESSION_DURATION_SECONDS);
                 await ndsctl('auth', lastMac);
            } else {
                console.log("[Portal] Coin inserted, but no recent unauthenticated MAC address found.");
            }
        } catch (error) {
             console.error('[Portal] Failed to process coin insertion:', error);
        }
    });

    console.log(`[Portal] GPIO pin ${COIN_SLOT_GPIO_PIN} initialized for coin slot.`);
    process.on('SIGINT', () => coinSlot.unexport());
} catch (error) {
    console.warn('[GPIO] Could not initialize GPIO. Running in dev mode or on unsupported hardware.', error.message);
}


// =================================================================
// --- PORTAL SERVER (Port 3001) - For local hotspot users       ---
// =================================================================

// DEFINITIVE FIX: Configure the proxy to correctly re-stream the request body.
// The body-parser middleware (express.json()) runs BEFORE this proxy. It reads the
// request stream. The onProxyReq event handler is essential to write that
// parsed body back into the proxy request so the admin server can receive it.
const adminProxy = createProxyMiddleware({
    target: `http://localhost:${ADMIN_PORT}`,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        if (req.body) {
            const bodyData = JSON.stringify(req.body);
            // We need to set the content-type and content-length headers so the
            // admin server can parse the request correctly.
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            // Write the body to the proxy request stream.
            proxyReq.write(bodyData);
        }
    },
});

// The proxy must be defined AFTER the body parser but BEFORE other routes.
portalApp.use('/api/admin', adminProxy);


// --- Public API (No Auth) ---
portalApp.get('/api/public/settings', async (req, res) => {
    try {
        const ssidSetting = await db.getSetting('networkSsid');
        res.json({ ssid: ssidSetting?.value || 'SULIT WIFI' });
    } catch (error) {
        res.status(500).json({ message: "Could not fetch settings." });
    }
});

// --- Session Management ---
portalApp.post('/api/sessions/voucher', async (req, res) => {
    const { code } = req.body;
    const { mac } = req.query;
    if (!mac || !code) return res.status(400).json({ message: 'MAC address and voucher code are required.' });

    try {
        const voucher = await db.getVoucher(code.toUpperCase());
        if (!voucher || voucher.used) {
            return res.status(404).json({ message: 'Voucher is invalid or has already been used.' });
        }
        await db.useVoucher(code);
        const session = await db.createSession(mac, code, voucher.duration);
        await ndsctl('auth', mac);
        res.status(201).json(session);
    } catch (error) {
        console.error("Voucher activation error:", error);
        res.status(500).json({ message: 'Server error during voucher activation.' });
    }
});

portalApp.post('/api/sessions/coin', async (req, res) => {
    const { mac } = req.query;
    if (!mac) return res.status(400).json({ message: 'MAC address is required.' });
    try {
        const session = await db.createSession(mac, 'COIN_INSERT', COIN_SESSION_DURATION_SECONDS);
        await ndsctl('auth', mac);
        res.status(201).json(session);
    } catch (error) {
         console.error("Coin session activation error:", error);
        res.status(500).json({ message: 'Server error during coin session activation.' });
    }
});

portalApp.get('/api/sessions/current', async (req, res) => {
    const { mac } = req.query;
    if (!mac) return res.status(400).json({ message: 'MAC address is required.' });

    try {
        // Track unauthenticated users for the coin slot feature
        await db.trackUnauthenticatedMac(mac);
        
        const session = await db.getSession(mac);
        if (session && session.remainingTime > 0) {
             await ndsctl('auth', mac);
            res.json(session);
        } else {
            if (session) {
                await db.deleteSession(mac);
            }
            res.status(404).json({ message: 'No active session found.' });
        }
    } catch (error) {
        console.error("Session check error:", error);
        res.status(500).json({ message: 'Server error checking session.' });
    }
});

portalApp.delete('/api/sessions/current', async (req, res) => {
    const { mac } = req.query;
    if (!mac) return res.status(400).json({ message: 'MAC address is required.' });
    
    try {
        await db.deleteSession(mac);
        await ndsctl('deauth', mac);
        res.sendStatus(204);
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: 'Server error during logout.' });
    }
});

// --- Serve Portal Frontend ---
// Serve static assets from the 'dist' directory
portalApp.use('/dist', express.static(path.join(__dirname, 'dist')));
// Serve the main index.html for any other GET request, enabling SPA routing
portalApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// =================================================================
// --- ADMIN SERVER (Port 3002) - For remote/WAN management      ---
// =================================================================

// --- Admin Auth ---
adminApp.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    try {
        const admin = await db.getAdminUser();
        if (!admin) return res.status(401).json({ message: 'Admin user not configured.' });

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password.' });
        }

        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
});

// All subsequent admin routes are protected
adminApp.use('/api/admin', verifyAdminToken);


// --- Admin Dashboard API ---
adminApp.get('/api/admin/stats', async (req, res) => {
    try {
        const [active, used, available] = await Promise.all([
            db.getActiveSessionCount(),
            db.getUsedVoucherCount(),
            db.getAvailableVoucherCount()
        ]);
        res.json({
            activeSessions: active,
            totalVouchersUsed: used,
            totalVouchersAvailable: available
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get stats.' });
    }
});

adminApp.get('/api/admin/system-info', async (req, res) => {
    try {
        const [cpuInfo, memInfo, diskInfo] = await Promise.all([
            executeCommand("cat /proc/cpuinfo | grep 'model name' | uniq | sed 's/model name\\s*: //'"),
            executeCommand("free -m | awk 'NR==2{print $2,$3}'"),
            executeCommand("df -m / | awk 'NR==2{print $2,$3}'")
        ]);
        const mem = memInfo.split(' ');
        const disk = diskInfo.split(' ');
        const cores = await executeCommand("nproc");
        
        res.json({
            cpu: { model: cpuInfo, cores: parseInt(cores, 10) },
            ram: { totalMb: parseInt(mem[0], 10), usedMb: parseInt(mem[1], 10) },
            disk: { totalMb: parseInt(disk[0], 10), usedMb: parseInt(disk[1], 10) }
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get system info.' });
    }
});

adminApp.get('/api/admin/network-info', async (req, res) => {
     try {
        const output = await executeCommand("ip -j a");
        const allIfaces = JSON.parse(output);
        const relevantIfaces = allIfaces.filter(iface => iface.ifname !== 'lo');

        const result = relevantIfaces.map(iface => {
            const ip4 = iface.addr_info.find(addr => addr.family === 'inet')?.local || null;
            const ip6 = iface.addr_info.find(addr => addr.family === 'inet6' && addr.scope === 'global')?.local || null;
            return {
                name: iface.ifname,
                status: iface.operstate,
                ip4,
                ip6
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get network info.' });
    }
});

// --- Admin Voucher Management ---
adminApp.get('/api/admin/vouchers', async (req, res) => {
    try {
        const vouchers = await db.getVouchers(false); // only available
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get vouchers.' });
    }
});

adminApp.post('/api/admin/vouchers', async (req, res) => {
    const { duration } = req.body;
    if (typeof duration !== 'number' || duration <= 0) {
        return res.status(400).json({ message: 'Invalid duration specified.' });
    }
    try {
        const code = await db.createVoucher(duration);
        res.status(201).json({ code });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create voucher.' });
    }
});

// --- Admin Settings ---
adminApp.get('/api/admin/settings', async (req, res) => {
    try {
        const ssidSetting = await db.getSetting('networkSsid');
        res.json({ ssid: ssidSetting?.value || 'SULIT WIFI' });
    } catch (error) {
        res.status(500).json({ message: "Could not fetch settings." });
    }
});

adminApp.put('/api/admin/settings', async (req, res) => {
    const { ssid } = req.body;
    if (!ssid || ssid.length < 3) {
        return res.status(400).json({ message: 'SSID must be at least 3 characters.' });
    }
    try {
        await db.updateSetting('networkSsid', ssid);
        // Here you would add logic to actually change the system's SSID
        console.log(`[Admin] SSID updated in DB to: ${ssid}. System command to apply change needs to be implemented.`);
        res.sendStatus(204);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update SSID.' });
    }
});

// --- Admin Network Configuration ---
adminApp.get('/api/admin/network-config', async (req, res) => {
    try {
        const config = await db.getSetting('networkConfig');
        res.json(config.value);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get network configuration.' });
    }
});

adminApp.put('/api/admin/network-config', async (req, res) => {
    const config = req.body;
    try {
        await db.updateSetting('networkConfig', config);
        
        // --- Apply settings to the system ---
        const { hotspotInterface, hotspotIpAddress } = config;
        const configFilePath = `/etc/network/interfaces.d/60-sulit-wifi-hotspot`;
        const interfaceConfig = `
auto ${hotspotInterface}
iface ${hotspotInterface} inet static
    address ${hotspotIpAddress}
    netmask 255.255.255.0
`;
        fs.writeFileSync(configFilePath, interfaceConfig);
        console.log(`[Admin] Wrote interface config to ${configFilePath}`);
        
        // Safely apply the new configuration
        await executeCommand(`sudo ifdown ${hotspotInterface} && sudo ifup ${hotspotInterface}`);
        console.log(`[Admin] Network interface ${hotspotInterface} reconfigured.`);
        
        // Here, you would also apply DHCP settings if enabled. This is a complex step.
        // For now, we'll just log it.
        console.log(`[Admin] DHCP config updated in DB. System apply logic needed.`);

        res.sendStatus(204);
    } catch (error) {
        console.error("Network config update error:", error);
        res.status(500).json({ message: 'Failed to update and apply network configuration.' });
    }
});

// --- Admin Portal Editor ---
const PORTAL_HTML_PATH = path.join(__dirname, 'nodogsplash', 'htdocs', 'splash.html');
const DEFAULT_PORTAL_HTML_PATH = path.join(__dirname, 'nodogsplash', 'htdocs', 'splash.html.default');

adminApp.get('/api/admin/portal-html', async (req, res) => {
    try {
        const html = fs.readFileSync(PORTAL_HTML_PATH, 'utf8');
        res.json({ html });
    } catch (error) {
        res.status(500).json({ message: 'Failed to read portal HTML file.' });
    }
});

adminApp.put('/api/admin/portal-html', async (req, res) => {
    const { html } = req.body;
    try {
        fs.writeFileSync(PORTAL_HTML_PATH, html, 'utf8');
        res.sendStatus(204);
    } catch (error) {
        res.status(500).json({ message: 'Failed to save portal HTML file.' });
    }
});

adminApp.post('/api/admin/portal-html/reset', async (req, res) => {
    try {
        const defaultHtml = fs.readFileSync(DEFAULT_PORTAL_HTML_PATH, 'utf8');
        fs.writeFileSync(PORTAL_HTML_PATH, defaultHtml, 'utf8');
        res.json({ html: defaultHtml });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reset portal HTML from default.' });
    }
});


// --- Admin Updater & Backup ---
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_FILE_NAME = 'sulit-wifi-backup.tar.gz';
const BACKUP_FILE_PATH = path.join(BACKUP_DIR, BACKUP_FILE_NAME);

adminApp.get('/api/admin/updater/status', async (req, res) => {
    try {
        await executeCommand('git fetch');
        const localCommit = await executeCommand('git rev-parse HEAD');
        const remoteCommit = await executeCommand("git rev-parse 'origin/main'"); // Adjust if your branch is different
        const commitMessage = await executeCommand("git log -1 --pretty=%B 'origin/main'");

        const isUpdateAvailable = localCommit !== remoteCommit;
        
        const status = {
            isUpdateAvailable,
            localCommit: localCommit.substring(0, 7),
            remoteCommit: remoteCommit.substring(0, 7),
            commitMessage,
            statusText: isUpdateAvailable ? "An update is available." : "You are on the latest version."
        };

        if (fs.existsSync(BACKUP_FILE_PATH)) {
            const stats = fs.statSync(BACKUP_FILE_PATH);
            status.backupFile = BACKUP_FILE_NAME;
            status.backupDate = stats.mtime;
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ message: 'Failed to check for updates. Ensure git is configured.' });
    }
});


adminApp.post('/api/admin/updater/update', async (req, res) => {
    try {
        // Create a backup before updating as a safety measure
        await executeCommand(`mkdir -p ${BACKUP_DIR}`);
        await executeCommand(`tar --exclude='./node_modules' --exclude='./backups' -czf ${BACKUP_FILE_PATH} .`);
        console.log('[Updater] Backup created before update.');
        
        // Pull changes and restart
        await executeCommand('git pull origin main');
        console.log('[Updater] Git pull successful.');
        
        res.json({ message: 'Update started. Server is restarting...' });

        // Tell PM2 to restart the app. It will pull new dependencies on restart.
        executeCommand('pm2 restart sulit-wifi');

    } catch (error) {
        res.status(500).json({ message: 'Update failed during execution.' });
    }
});

adminApp.post('/api/admin/updater/backup', async (req, res) => {
    try {
        await executeCommand(`mkdir -p ${BACKUP_DIR}`);
        await executeCommand(`tar --exclude='./node_modules' --exclude='./backups' -czf ${BACKUP_FILE_PATH} .`);
        res.json({ message: 'Backup created successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create backup.' });
    }
});

adminApp.post('/api/admin/updater/restore', async (req, res) => {
    if (!fs.existsSync(BACKUP_FILE_PATH)) {
        return res.status(404).json({ message: 'No backup file found to restore from.' });
    }
    try {
        await executeCommand(`tar -xzf ${BACKUP_FILE_PATH} -C .`);
        res.json({ message: 'Restore successful. Server is restarting...' });
        executeCommand('pm2 restart sulit-wifi');
    } catch (error) {
        res.status(500).json({ message: 'Failed to restore from backup.' });
    }
});

adminApp.delete('/api/admin/updater/backup', async (req, res) => {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
        fs.unlinkSync(BACKUP_FILE_PATH);
        res.json({ message: 'Backup deleted successfully.' });
    } else {
        res.status(404).json({ message: 'No backup file to delete.' });
    }
});

// --- Serve Admin Frontend ---
adminApp.use('/dist', express.static(path.join(__dirname, 'dist')));
adminApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Server Startup ---
const startServer = async () => {
    try {
        console.log('[DB] Checking database connection...');
        await db.checkConnection();
        console.log('[DB] Database connection successful.');

        console.log('[DB] Initializing database schema...');
        await db.initializeDatabase();
        console.log('[DB] Database schema is ready.');

        portalApp.listen(PORTAL_PORT, () => {
            console.log(`[Portal] Portal Server running on http://localhost:${PORTAL_PORT}`);
        });

        adminApp.listen(ADMIN_PORT, () => {
            console.log(`[Admin] Admin Server running on http://localhost:${ADMIN_PORT}`);
        });

    } catch (error) {
        console.error('[DB] FATAL: Could not connect to or initialize the database.', error);
         if (error.code === '28P01') { // PostgreSQL auth failed
             console.error('[DB] FATAL: Database password authentication failed for user "sulituser".');
             console.error('[DB] Please check that the PGPASSWORD in your .env file is correct.');
        } else if (error.code === '42501') { // Permission denied
            console.error('[DB] FATAL: Database permission denied.');
            console.error('[DB] Please run "GRANT ALL ON SCHEMA public TO sulituser;" in psql.');
        }
        process.exit(1);
    }
};

startServer();