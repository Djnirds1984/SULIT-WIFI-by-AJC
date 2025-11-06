
require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const si = require('systeminformation');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./backend/postgres');

// --- PRE-FLIGHT CHECKS ---
if (!process.env.PGPASSWORD) {
    console.error('[FATAL] The PGPASSWORD environment variable is not set.');
    console.error('Please check your .env file in the project root and ensure it contains a line like: PGPASSWORD=your_secure_password');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'default_super_secret_key_for_dev';

// --- GPIO SETUP ---
let gpio;
const GPIO_DEBOUNCE_MS = 50;
let lastCoinDropTime = 0;

try {
    gpio = require('rpi-gpio');
} catch (err) {
    gpio = null;
    console.log('[Portal] GPIO module not found or failed to load. Running in dev mode (no coin slot/relay/light).');
}

// --- UTILITY FUNCTIONS ---
const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command error for "${command}": ${stderr}`);
                return reject(new Error(stderr || error.message));
            }
            resolve(stdout.trim());
        });
    });
};

const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',').shift() || req.socket.remoteAddress;
};

// --- NODOGSPLASH (NDS) UTILS ---
const ndsctl = async (action, clientIp) => {
    // Note: Use the MAC address from ndsctl status in a real implementation
    // For simplicity, we'll use IP, which works for basic cases.
    try {
        const stdout = await runCommand(`sudo /usr/bin/ndsctl ${action} ${clientIp}`);
        return stdout;
    } catch (error) {
        console.error(`ndsctl command failed: ${error.message}`);
        throw new Error('Failed to communicate with the captive portal service.');
    }
};

const authenticateClient = (clientIp) => ndsctl('auth', clientIp);
const deauthenticateClient = (clientIp) => ndsctl('deauth', clientIp);

// --- AUTH MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};


// --- MAIN SERVER LOGIC ---
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- PUBLIC API ROUTES ---
app.get('/api/session', async (req, res) => {
    const clientIp = getClientIp(req);
    const session = await db.getSessionByIp(clientIp);
    if (session && session.expiresAt > new Date()) {
        const remainingTime = Math.floor((session.expiresAt.getTime() - new Date().getTime()) / 1000);
        res.json({ remainingTime });
    } else {
        res.status(404).json({ message: 'No active session found.' });
    }
});

app.post('/api/logout', async (req, res) => {
    const clientIp = getClientIp(req);
    await db.deleteSessionByIp(clientIp);
    await deauthenticateClient(clientIp);
    res.json({ message: 'Successfully logged out.' });
});

app.get('/api/settings/public', async (req, res) => {
     try {
        const networkConfig = await db.getSetting('networkConfig');
        const ssid = networkConfig?.ssid || 'SULIT WIFI';
        res.json({ ssid });
    } catch (error) {
        console.error("Error fetching public settings:", error);
        res.status(500).json({ message: 'Could not load portal settings.' });
    }
});

app.post('/api/voucher/activate', async (req, res) => {
    const { code } = req.body;
    const clientIp = getClientIp(req);
    try {
        const session = await db.activateVoucher(code, clientIp);
        await authenticateClient(clientIp);
        res.json({ remainingTime: session.duration });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post('/api/session/coin', async (req, res) => {
    const clientIp = getClientIp(req);
    try {
        const session = await db.createSession(clientIp, 15 * 60); // 15 minutes
        await authenticateClient(clientIp);
        res.json({ remainingTime: session.duration });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ADMIN API ROUTES ---
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    const storedHash = await db.getSetting('adminPassword');
    if (storedHash && bcrypt.compareSync(password, storedHash)) {
        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid password.' });
    }
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    const [activeSessions, totalVouchersUsed, totalVouchersAvailable] = await Promise.all([
        db.getActiveSessionCount(),
        db.getUsedVoucherCount(),
        db.getUnusedVoucherCount()
    ]);
    res.json({ activeSessions, totalVouchersUsed, totalVouchersAvailable });
});

app.get('/api/admin/system-info', authMiddleware, async (req, res) => {
    try {
        const [cpu, mem, fsSize] = await Promise.all([si.cpu(), si.mem(), si.fsSize()]);
        const rootDisk = fsSize.find(d => d.mount === '/');
        res.json({
            cpu: { model: cpu.manufacturer + ' ' + cpu.brand, cores: cpu.cores },
            ram: { totalMb: Math.round(mem.total / 1024 / 1024), usedMb: Math.round(mem.used / 1024 / 1024) },
            disk: { totalMb: rootDisk ? Math.round(rootDisk.size / 1024 / 1024) : 0, usedMb: rootDisk ? Math.round(rootDisk.used / 1024 / 1024) : 0 }
        });
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch system info.' });
    }
});

app.get('/api/admin/vouchers', authMiddleware, async (req, res) => {
    res.json(await db.getUnusedVouchers());
});

app.post('/api/admin/vouchers', authMiddleware, async (req, res) => {
    res.status(201).json(await db.createVoucher(req.body.duration));
});

// Update & Backup
app.get('/api/admin/updater/status', authMiddleware, async(req, res) => {
    try {
        await runCommand('git fetch');
        const local = await runCommand('git rev-parse HEAD');
        const remote = await runCommand('git rev-parse @{u}');
        const isUpdateAvailable = local !== remote;
        res.json({ statusText: isUpdateAvailable ? 'Update available' : 'Up to date', localCommit: local.slice(0, 7), remoteCommit: remote.slice(0, 7), isUpdateAvailable });
    } catch (error) {
        res.status(500).json({ statusText: `Error: ${error.message}`, localCommit: 'N/A', remoteCommit: 'N/A', isUpdateAvailable: false });
    }
});

app.post('/api/admin/updater/start', authMiddleware, (req, res) => {
    res.json({ message: 'Update process started in background. The server will restart automatically.' });
    exec('git pull && npm install && pm2 restart sulit-wifi', (err, stdout, stderr) => {
        if (err) console.error('Update failed:', stderr);
        else console.log('Update successful:', stdout);
    });
});

app.get('/api/admin/backups', authMiddleware, async (req, res) => {
    res.json(await db.listBackups());
});

app.post('/api/admin/backups', authMiddleware, async (req, res) => {
    await db.createBackup();
    res.json({ message: 'Backup created successfully.' });
});

app.post('/api/admin/backups/restore', authMiddleware, async (req, res) => {
    await db.restoreBackup(req.body.filename);
    res.json({ message: `Restored from ${req.body.filename}. Server is restarting.` });
    setTimeout(() => process.exit(0), 1000); // Restart via PM2
});

app.delete('/api/admin/backups', authMiddleware, async (req, res) => {
    await db.deleteBackup(req.body.filename);
    res.json({ message: `Deleted backup ${req.body.filename}.` });
});

// Network Config
app.get('/api/admin/network/info', authMiddleware, async (req, res) => {
    try {
        const interfaces = await si.networkInterfaces();
        res.json(interfaces.map(i => ({ name: i.iface, ip4: i.ip4, status: i.operstate.toUpperCase() })));
    } catch(e) { res.status(500).json({ message: 'Could not get network info.'}) }
});

app.get('/api/admin/network/wan', authMiddleware, async (req, res) => {
    try {
        const defaultIface = await si.networkInterfaceDefault();
        res.json({ name: defaultIface });
    } catch(e) { res.status(500).json({ message: 'Could not get WAN interface.'}) }
});

app.get('/api/admin/network/config', authMiddleware, async (req, res) => {
    res.json(await db.getSetting('networkConfig'));
});

app.post('/api/admin/network/config', authMiddleware, async (req, res) => {
    try {
        const config = req.body;
        await db.updateSetting('networkConfig', config);
        // Apply hostapd settings
        const hostapdConf = `
interface=${config.hotspotInterface}
driver=nl80211
ssid=${config.ssid}
hw_mode=g
channel=7
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
${config.security === 'wpa2' ? `
wpa=2
wpa_passphrase=${config.password}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
` : ''}
`;
        fs.writeFileSync('/etc/hostapd/hostapd.conf', hostapdConf);
        await runCommand('sudo systemctl restart hostapd');

        res.json({ message: 'Network settings applied successfully. Wi-Fi services have been restarted.' });
    } catch (err) {
        res.status(500).json({ message: `Failed to apply settings: ${err.message}` });
    }
});


// System Settings (Password & GPIO)
app.get('/api/admin/settings', authMiddleware, async (req, res) => {
    // Only return non-sensitive settings.
    res.json({});
});

app.post('/api/admin/settings', authMiddleware, async (req, res) => {
    if (req.body.adminPassword) {
        await db.updateSetting('adminPassword', req.body.adminPassword);
    }
    res.json({ message: 'Admin password updated successfully.' });
});

app.get('/api/admin/gpio/config', authMiddleware, async (req, res) => {
    res.json(await db.getSetting('gpioConfig'));
});

app.post('/api/admin/gpio/config', authMiddleware, async (req, res) => {
    await db.updateSetting('gpioConfig', req.body);
    res.json({ message: 'GPIO config updated. Please restart the server to apply changes.' });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- SERVER INITIALIZATION ---
const startServer = async () => {
    try {
        console.log('[DB] Attempting to connect to database...');
        await db.checkConnection();
        console.log('[DB] Database connection successful.');
        await db.initializeDatabase();

        // Initialize GPIO pins if configured
        if (gpio) {
            const gpioConfig = await db.getSetting('gpioConfig');
            if (gpioConfig) {
                gpio.setMode(gpio.MODE_BCM);

                // Setup Coin Slot
                if (gpioConfig.coinSlotPin) {
                    const coinPin = gpioConfig.coinSlotPin;
                    gpio.setup(coinPin, gpio.DIR_IN, gpio.EDGE_FALLING, (err) => {
                        if (err) return console.error(`[GPIO] Failed to setup coin slot pin ${coinPin}`, err);
                        console.log(`[GPIO] Coin slot initialized on BCM pin ${coinPin}.`);
                        gpio.on('change', (channel, value) => {
                            const now = Date.now();
                            if (channel === coinPin && !value && (now - lastCoinDropTime > GPIO_DEBOUNCE_MS)) {
                                lastCoinDropTime = now;
                                console.log('[GPIO] Coin detected!');
                                // Here you would typically use websockets to notify the frontend
                                // or handle credit logic. For now, we just log it.
                            }
                        });
                    });
                }

                // Setup Relay
                if (gpioConfig.relayPin) {
                    const relayPin = gpioConfig.relayPin;
                    gpio.setup(relayPin, gpio.DIR_HIGH, (err) => {
                        if (err) return console.error(`[GPIO] Failed to setup relay pin ${relayPin}`, err);
                        console.log(`[GPIO] Relay activated on BCM pin ${relayPin}.`);
                    });
                }

                // Setup Status Light
                if (gpioConfig.statusLightPin) {
                    const lightPin = gpioConfig.statusLightPin;
                    gpio.setup(lightPin, gpio.DIR_HIGH, (err) => {
                        if (err) return console.error(`[GPIO] Failed to setup status light pin ${lightPin}`, err);
                        console.log(`[GPIO] Status light ON for BCM pin ${lightPin}.`);
                    });
                }
            }
        }

        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`[Portal] Server listening on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('[FATAL] Could not start server.', error);
        process.exit(1);
    }
};

startServer();
