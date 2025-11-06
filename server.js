
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./backend/postgres');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const si = require('systeminformation');
const fs = require('fs');
const os = require('os');

// --- Pre-flight Checks & Setup ---
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-default-key-that-should-be-changed';
let Gpio;
let coinSlotPin, relayPin, statusLedPin; // GPIO pin objects
let activeCoinVouchers = {}; // In-memory store for coin-generated vouchers

try {
    Gpio = require('onoff').Gpio;
    console.log('[Portal] GPIO module loaded successfully.');
} catch (err) {
    console.warn('[Portal] GPIO module (onoff) not found. Running in dev mode (no coin slot/hardware).');
    Gpio = null;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Middleware ---
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Helper Functions ---
const restartNetworkingServices = (res) => {
    // This is a placeholder for a more robust script.
    // In a real implementation, you would trigger a shell script to handle this.
    console.log('[Network] Simulating restart of hostapd, dnsmasq, and networking...');
     exec('sudo systemctl restart hostapd && sudo systemctl restart dnsmasq', (error, stdout, stderr) => {
        if (error) {
            console.error(`[Network] Service restart error: ${stderr}`);
            return res.status(500).json({ message: `Failed to restart network services: ${stderr}` });
        }
        res.json({ message: 'Network configuration applied. Services are restarting.' });
    });
};

const setupGpio = async () => {
    if (!Gpio) return;

    try {
        const gpioConfig = await db.getSetting('gpioConfig');
        if (!gpioConfig) {
            console.warn('[GPIO] GPIO configuration not found in database. Hardware disabled.');
            return;
        }
        
        // Unexport pins if they are already initialized
        if (coinSlotPin) coinSlotPin.unexport();
        if (relayPin) relayPin.unexport();
        if (statusLedPin) statusLedPin.unexport();

        // --- Status LED ---
        if (gpioConfig.statusLedPin) {
            try {
                statusLedPin = new Gpio(gpioConfig.statusLedPin, 'out');
                await statusLedPin.write(1); // Turn on LED to show server is ready
                console.log(`[GPIO] Status LED initialized on BCM pin ${gpioConfig.statusLedPin} and turned ON.`);
            } catch (err) {
                console.error(`[GPIO] Failed to setup status LED on BCM pin ${gpioConfig.statusLedPin}. Reason:`, err.message);
            }
        }
        
        // --- Relay ---
        if (gpioConfig.relayPin) {
             try {
                relayPin = new Gpio(gpioConfig.relayPin, 'out');
                await relayPin.write(1); // Activate relay
                console.log(`[GPIO] Relay initialized on BCM pin ${gpioConfig.relayPin} and set to HIGH.`);
            } catch (err)                {
                 console.error(`[GPIO] Failed to setup relay on BCM pin ${gpioConfig.relayPin}. Reason:`, err.message);
            }
        }

        // --- Coin Slot ---
        if (gpioConfig.coinPin) {
            try {
                const coinOptions = {
                    direction: 'in',
                    edge: 'rising',
                    debounceTimeout: 20, // Debounce to prevent multiple triggers for one coin
                    activeLow: gpioConfig.coinSlotActiveLow, // CRITICAL: Use active-low if needed
                };
                
                coinSlotPin = new Gpio(gpioConfig.coinPin, coinOptions.direction, coinOptions.edge, { 
                    debounceTimeout: coinOptions.debounceTimeout, 
                    activeLow: coinOptions.activeLow 
                });
                
                coinSlotPin.watch(async (err, value) => {
                    if (err) {
                        console.error('[GPIO] Error watching coin slot pin:', err);
                        return;
                    }
                    if (value === 1) { // Trigger on rising edge
                        console.log('[CoinSlot] Coin pulse detected!');
                        const settings = await db.getSetting('portalSettings');
                        const duration = (settings.coinPulseValue || 15) * 60; // Use setting or default to 15 mins
                        const voucher = await db.createVoucher(duration, 'COIN');
                        console.log(`[CoinSlot] Generated ${duration/60}-minute voucher: ${voucher.code}`);
                        activeCoinVouchers[voucher.code] = true; // Mark as a coin voucher
                    }
                });
                
                console.log(`[GPIO] Coin slot watcher initialized on BCM pin ${gpioConfig.coinPin} (ActiveLow: ${!!gpioConfig.coinSlotActiveLow}).`);

            } catch (err) {
                 console.error(`[GPIO] Failed to setup coin slot on BCM pin ${gpioConfig.coinPin}. Reason:`, err.message);
                 if (err.code === 'EINVAL') {
                    console.error('---');
                    console.error('[GPIO_FIX] This error is common on Raspberry Pi / SBCs.');
                    console.error('[GPIO_FIX] SOLUTION: Ensure the "libgpiod-dev" package is installed.');
                    console.error('[GPIO_FIX] Run: sudo apt-get install -y libgpiod-dev');
                    console.error('[GPIO_FIX] And ensure you have created the udev rule as per the README.');
                    console.error('---');
                 }
            }
        }
        
    } catch (dbErr) {
        console.error('[GPIO] Could not fetch GPIO config from database:', dbErr);
    }
};

// --- Public API Routes ---
app.get('/api/session', (req, res) => {
    // This is a placeholder. A real implementation would check the user's MAC address
    // against an active session list managed by nodogsplash or iptables.
    // For now, we simulate no session.
    res.status(404).json({ message: 'No active session found.' });
});

app.post('/api/logout', (req, res) => {
    // Placeholder for logout logic
    res.json({ message: 'Logged out successfully.' });
});

app.get('/api/settings/public', async (req, res) => {
    try {
        const networkConfig = await db.getSetting('networkConfig');
        res.json({ ssid: networkConfig?.ssid || 'SULIT WIFI' });
    } catch (error) {
        res.status(500).json({ message: "Could not fetch public settings." });
    }
});

app.post('/api/voucher/activate', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ message: 'Voucher code is required.' });
    }
    try {
        const voucher = await db.getVoucherByCode(code);
        if (!voucher || voucher.is_used) {
            return res.status(404).json({ message: 'Voucher is invalid or has already been used.' });
        }

        await db.markVoucherAsUsed(code);
        
        // In a real system, you'd grant access via nodogsplash here
        // execSync(`ndsctl auth <user_ip> <duration_in_seconds>`);
        
        res.json({ remainingTime: voucher.duration });
    } catch (error) {
        console.error('Voucher activation error:', error);
        res.status(500).json({ message: 'Server error during voucher activation.' });
    }
});

app.post('/api/session/coin', async (req, res) => {
    try {
        const settings = await db.getSetting('portalSettings');
        const duration = (settings.coinPulseValue || 15) * 60; // Use setting or default to 15 mins
        
        // In a real system, you'd grant access via nodogsplash here
        // execSync(`ndsctl auth <user_ip> ${duration}`);
        
        res.json({ remainingTime: duration });
    } catch (error) {
        console.error('Coin session error:', error);
        res.status(500).json({ message: 'Could not start timed session.' });
    }
});


// --- Admin API Routes ---
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    try {
        const adminPasswordHash = await db.getSetting('adminPassword');
        if (!adminPasswordHash) {
             return res.status(500).json({ message: 'Admin password not set.' });
        }
        const isMatch = await bcrypt.compare(password, adminPasswordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const [activeSessions, totalVouchersUsed, totalVouchersAvailable] = await Promise.all([
            db.getActiveSessionCount(),
            db.getUsedVoucherCount(),
            db.getAvailableVoucherCount()
        ]);
        res.json({ activeSessions, totalVouchersUsed, totalVouchersAvailable });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ message: "Failed to get stats." });
    }
});

app.get('/api/admin/system-info', authenticateAdmin, async (req, res) => {
    try {
        const [cpu, mem, fsSize] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.fsSize()
        ]);
        const rootDisk = fsSize.find(d => d.mount === '/');
        res.json({
            cpu: { model: cpu.manufacturer + ' ' + cpu.brand, cores: cpu.cores },
            ram: { usedMb: Math.round(mem.used / 1024 / 1024), totalMb: Math.round(mem.total / 1024 / 1024) },
            disk: { usedMb: Math.round(rootDisk.used / 1024 / 1024), totalMb: Math.round(rootDisk.size / 1024 / 1024) }
        });
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch system info.' });
    }
});

app.get('/api/admin/vouchers', authenticateAdmin, async (req, res) => {
    try {
        const vouchers = await db.getAvailableVouchers();
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch vouchers.' });
    }
});

app.post('/api/admin/vouchers', authenticateAdmin, async (req, res) => {
    const { duration } = req.body; // in seconds
    try {
        const voucher = await db.createVoucher(duration);
        res.status(201).json(voucher);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create voucher.' });
    }
});

// Settings, Network, Updater, Backups...
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = await db.getSetting('portalSettings');
        res.json(settings);
    } catch (error) {
         res.status(500).json({ message: 'Could not fetch settings.' });
    }
});

app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
    const { adminPassword, ...portalSettings } = req.body;
    try {
        await db.updateSetting('portalSettings', portalSettings);
        if (adminPassword) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            await db.updateSetting('adminPassword', hashedPassword);
        }
        res.json({ message: 'Settings updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update settings.' });
    }
});

app.get('/api/admin/gpio/config', authenticateAdmin, async (req, res) => {
    try {
        const config = await db.getSetting('gpioConfig');
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch GPIO config.' });
    }
});

app.post('/api/admin/gpio/config', authenticateAdmin, async (req, res) => {
    try {
        await db.updateSetting('gpioConfig', req.body);
        // Re-initialize GPIO with new settings after saving
        await setupGpio();
        res.json({ message: 'GPIO config updated. Restart server to apply changes.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update GPIO config.' });
    }
});


app.get('/api/admin/network/config', authenticateAdmin, async (req, res) => {
    try {
        const config = await db.getSetting('networkConfig');
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch network config.' });
    }
});

app.post('/api/admin/network/config', authenticateAdmin, async (req, res) => {
    const config = req.body;
    try {
        // 1. Save config to DB
        await db.updateSetting('networkConfig', config);
        
        // 2. Generate hostapd.conf
        const hostapdConf = `
interface=${config.hotspotInterface}
driver=nl80211
ssid=${config.ssid}
hw_mode=g
channel=7
ieee80211n=1
wmm_enabled=1
${config.security === 'wpa2' ? `
wpa=2
wpa_passphrase=${config.password}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
` : ''}
`;
        fs.writeFileSync('/etc/hostapd/hostapd.conf', hostapdConf);
        console.log("[Network] Wrote /etc/hostapd/hostapd.conf");

        // 3. (Placeholder) Generate dnsmasq.conf changes
        // This is complex and depends on the base OS setup.
        console.log("[Network] NOTE: dnsmasq and interface static IP configuration is not yet implemented.");

        // 4. Restart services
        restartNetworkingServices(res);

    } catch (error) {
        console.error("[Network] Config update error:", error);
        res.status(500).json({ message: `Failed to update network config: ${error.message}` });
    }
});


app.get('/api/admin/network/info', authenticateAdmin, async (req, res) => {
     try {
        const interfaces = await si.networkInterfaces();
        const formatted = interfaces.map(iface => ({
            name: iface.iface,
            ip4: iface.ip4,
            status: iface.operstate
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: "Could not get network info." });
    }
});

app.get('/api/admin/network/wan', authenticateAdmin, async (req, res) => {
    try {
        const defaultIface = await si.networkInterfaceDefault();
        res.json({ name: defaultIface });
    } catch (error) {
        res.status(500).json({ message: "Could not determine WAN interface." });
    }
});


app.get('/api/admin/updater/status', authenticateAdmin, (req, res) => {
    // This is a simplified updater for a git-based deployment
    exec('git rev-parse HEAD', (err, localCommit) => {
        if (err) return res.status(500).json({ message: "Could not get local version." });
        exec('git fetch && git rev-parse origin/main', (err, remoteCommit) => {
            if (err) return res.json({ statusText: "Could not check for updates.", isUpdateAvailable: false, localCommit: localCommit.trim() });
            const isUpdateAvailable = localCommit.trim() !== remoteCommit.trim();
            res.json({
                statusText: isUpdateAvailable ? "Update available" : "Up to date",
                isUpdateAvailable,
                localCommit: localCommit.trim(),
                remoteCommit: remoteCommit.trim()
            });
        });
    });
});

app.post('/api/admin/updater/start', authenticateAdmin, (req, res) => {
    // WARNING: This is a simple implementation. A real-world updater should be more robust.
    res.json({ message: "Update process started in background. The server will restart." });
    exec('git pull && npm install && pm2 restart sulit-wifi', (err, stdout, stderr) => {
        if (err) {
            console.error("Update failed:", stderr);
        } else {
            console.log("Update successful:", stdout);
        }
    });
});

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

app.get('/api/admin/backups', authenticateAdmin, (req, res) => {
    res.json(fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql')));
});

app.post('/api/admin/backups', authenticateAdmin, async (req, res) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const filename = `sulitwifi_backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);
    try {
        await db.backupDatabase(filepath);
        res.json({ message: `Backup created: ${filename}` });
    } catch (error) {
        res.status(500).json({ message: `Backup failed: ${error.message}` });
    }
});

app.post('/api/admin/backups/restore', authenticateAdmin, async (req, res) => {
    const { filename } = req.body;
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "Backup file not found." });
    }
    try {
        await db.restoreDatabase(filepath);
        res.json({ message: "Database restored. Server is restarting." });
        // Restart to apply restored settings
        setTimeout(() => process.exit(0), 1000); 
    } catch (error) {
        res.status(500).json({ message: `Restore failed: ${error.message}` });
    }
});

app.delete('/api/admin/backups', authenticateAdmin, (req, res) => {
    const { filename } = req.body;
    const filepath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.json({ message: "Backup deleted." });
    } else {
        res.status(404).json({ message: "Backup file not found." });
    }
});


// --- Serve Frontend ---
// This catch-all route ensures that navigating directly to /admin or any other
// client-side route works correctly.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Server Startup ---
const PORT = process.env.PORT || 3001;
const startServer = async () => {
    try {
        await db.connect();
        await db.initSchema();
        await setupGpio();
        app.listen(PORT, () => {
            console.log(`[Portal] Server listening on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('[FATAL] Could not start server.', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('[Portal] Shutting down...');
    if (coinSlotPin) coinSlotPin.unexport();
    if (relayPin) relayPin.unexport();
    if (statusLedPin) statusLedPin.unexport();
    db.close().then(() => {
        console.log('[DB] Database connection closed.');
        process.exit(0);
    });
});
