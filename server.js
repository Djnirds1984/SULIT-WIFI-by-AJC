
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const si = require('systeminformation');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const db = require('./backend/postgres');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-key-that-should-be-in-env';
const DISABLE_GPIO = process.env.DISABLE_GPIO === 'true';

// --- GPIO Setup ---
let Gpio; // default GPIO class (onoff or mock)
let PigpioGpio; // optional pigpio GPIO class
let coinSlot, relay, statusLed;
let coinPollInterval;

// --- Mock GPIO for non-Linux environments ---
const mockGpio = {
    Gpio: class MockGpio {
        constructor(pin, direction, edge, options) {
            console.log(`[MOCK_GPIO] Initialized pin ${pin} (direction: ${direction}, edge: ${edge})`);
            this.pin = pin;
        }
        watch(callback) {
            console.log(`[MOCK_GPIO] Watching pin ${this.pin}`);
            // Simulate a coin pulse every 15 seconds for testing
            if (this.pin === (mockGpio.coinPin || 4)) { // Default to 4 if not set
                setInterval(() => {
                    console.log('[MOCK_GPIO] Simulating coin pulse...');
                    callback(null, 1);
                }, 15000);
            }
        }
        write(value, callback) {
            console.log(`[MOCK_GPIO] Wrote ${value} to pin ${this.pin}`);
            if (callback) callback(null);
        }
        unexport() {
            console.log(`[MOCK_GPIO] Unexported pin ${this.pin}`);
        }
    },
    coinPin: 4, // Default mock pin
};


const GPIO_BACKEND = process.env.GPIO_BACKEND || 'onoff'; // 'onoff' | 'pigpio'
try {
    if (process.platform === 'linux') {
        if (GPIO_BACKEND === 'pigpio') {
            PigpioGpio = require('pigpio').Gpio;
            console.log('[GPIO] pigpio backend selected.');
        } else {
            Gpio = require('onoff').Gpio;
            console.log('[GPIO] onoff backend selected.');
        }
    } else {
        console.warn('[DEV_MODE] Not on Linux. Using mock GPIO for development.');
        Gpio = mockGpio.Gpio;
    }
} catch (err) {
    console.error('[FATAL] Could not load GPIO backend. Error:', err);
    process.exit(1);
}

const setupGpio = async () => {
    // If Gpio isn't available (even the mock), do nothing.
    if (!Gpio) {
        console.log('[GPIO] GPIO setup skipped.');
        return;
    }
    if (!Gpio) return;

    // Allow forced disable via env var
    if (DISABLE_GPIO) {
        console.warn('[GPIO] DISABLE_GPIO=true; skipping all GPIO initialization.');
        if (coinSlot) coinSlot.unexport();
        if (coinPollInterval) {
            clearInterval(coinPollInterval);
            coinPollInterval = null;
        }
        if (relay) relay.unexport();
        if (statusLed) statusLed.unexport();
        return;
    }

    // Get config once
    const gpioConfig = await db.getSetting('gpioConfig');
    if (!gpioConfig) {
        console.error('[GPIO] GPIO config not found in database.');
        return;
    }

    // Cleanup old pins before re-initializing. This makes the function safe to call multiple times.
    if (coinSlot) coinSlot.unexport();
    if (relay) relay.unexport();
    if (statusLed) statusLed.unexport();
    
    // --- Setup Coin Slot Individually ---
    if (gpioConfig.coinPin > 0) {
        const coinSlotPin = gpioConfig.coinPin;
        const activeLow = gpioConfig.coinSlotActiveLow !== false; // Default to true

        // Special handling for pin 2 conflicts
        if (coinSlotPin === 2) {
            console.warn(`[GPIO] Pin 2 selected for coin slot. This may conflict with I2C.`);
            console.log(`[GPIO_FIX] To use pin 2, disable I2C: sudo raspi-config > Interface Options > I2C > Disable`);
            console.log(`[GPIO_FIX] Or edit /boot/config.txt and comment out: dtparam=i2c_arm=on`);
        }

        // Clear previous poller if any
        if (coinPollInterval) {
            clearInterval(coinPollInterval);
            coinPollInterval = null;
        }
        const settingsForPulse = async () => {
            const settings = await db.getSetting('portalSettings');
            const duration = (settings?.coinPulseValue || 15);
            const voucher = await db.createVoucher(duration * 60, 'COIN');
            console.log(`[COIN] Generated ${duration}-minute voucher: ${voucher.code}`);
        };

        if (PigpioGpio) {
            try {
                coinSlot = new PigpioGpio(coinSlotPin, { mode: PigpioGpio.INPUT });
                // Default pull-up for activeLow pulses (typical coin acceptor to GND)
                coinSlot.pullUpDown(activeLow ? PigpioGpio.PUD_UP : PigpioGpio.PUD_DOWN);
                // Debounce/glitch filter ~10ms
                coinSlot.glitchFilter(10000);
                coinSlot.on('interrupt', async (level) => {
                    // For activeLow, a coin pulse goes low then high; trigger on rising to 1
                    if ((activeLow && level === 1) || (!activeLow && level === 1)) {
                        console.log('[COIN] Coin pulse detected (pigpio)!');
                        await settingsForPulse();
                    }
                });
                console.log(`[GPIO] Coin slot configured via pigpio on BCM pin ${coinSlotPin} (Active Low: ${activeLow}).`);
            } catch (err) {
                console.error(`[GPIO] pigpio setup failed on pin ${coinSlotPin}: ${err.message}`);
            }
        } else {
            // onoff path: try edges then polling
            const edgeCandidates = ['rising', 'both', 'none'];
            let lastErr = null;
            for (const edge of edgeCandidates) {
                try {
                    coinSlot = new Gpio(coinSlotPin, 'in', edge, {
                        debounceTimeout: 100,
                        activeLow: activeLow
                    });
                    console.log(`[GPIO] Coin slot configured on BCM pin ${coinSlotPin} with edge '${edge}' (Active Low: ${activeLow}).`);
                    lastErr = null;
                    break;
                } catch (err) {
                    lastErr = err;
                    console.warn(`[GPIO] Edge '${edge}' failed for coin slot pin ${coinSlotPin}: ${err.message}`);
                }
            }

            if (!coinSlot) {
                console.error(`[GPIO] Failed to initialize coin slot on pin ${coinSlotPin}. Reason: ${lastErr?.message || 'Unknown'}`);
                if (lastErr?.code === 'EINVAL') {
                    console.error(`[GPIO_FIX] Edge interrupts may be unsupported or the pin is reserved. Ensure BCM numbering and try another general-purpose pin.`);
                }
            } else {
                try {
                    coinSlot.watch(async (err, value) => {
                        if (err) {
                            console.error(`[GPIO] Error watching coin slot pin ${coinSlotPin}:`, err);
                            return;
                        }
                        if (value === 1) {
                            console.log('[COIN] Coin pulse detected!');
                            await settingsForPulse();
                        }
                    });
                } catch (err) {
                    console.warn(`[GPIO] watch() failed on pin ${coinSlotPin}. Falling back to polling. Reason: ${err.message}`);
                }

                if (!coinPollInterval) {
                    try {
                        let prev = 0;
                        coinPollInterval = setInterval(async () => {
                            try {
                                const current = coinSlot.readSync();
                                if (prev === 0 && current === 1) {
                                    console.log('[COIN] Coin pulse detected via polling!');
                                    await settingsForPulse();
                                }
                                prev = current;
                            } catch (e) {
                                console.error(`[GPIO] Polling read failed on pin ${coinSlotPin}: ${e.message}`);
                                clearInterval(coinPollInterval);
                                coinPollInterval = null;
                            }
                        }, 100);
                        console.log('[GPIO] Coin slot polling enabled at 100ms interval.');
                    } catch (e) {
                        console.error(`[GPIO] Failed to start polling on pin ${coinSlotPin}: ${e.message}`);
                    }
                }
            }
        }
    }

    // --- Setup Relay Individually ---
    if (gpioConfig.relayPin > 0) {
        try {
            const relayPin = gpioConfig.relayPin;
            relay = new Gpio(relayPin, 'out');
            await relay.write(1); // Turn on relay
            console.log(`[GPIO] Relay configured and activated on BCM pin ${relayPin}.`);
        } catch (err) {
            console.error(`[GPIO] Failed to setup Relay on pin ${gpioConfig.relayPin}. Reason: ${err.message}`);
            if (err.code === 'EINVAL') {
                console.error(`[GPIO_FIX] This pin may be in use by another service. Please check your SBC's pinout and kernel configuration.`);
            }
        }
    }

    // --- Setup Status LED Individually ---
    if (gpioConfig.statusLedPin > 0) {
        try {
            const statusLedPin = gpioConfig.statusLedPin;
            statusLed = new Gpio(statusLedPin, 'out');
            await statusLed.write(1); // Turn on LED
            console.log(`[GPIO] Status LED configured and activated on BCM pin ${statusLedPin}.`);
        } catch (err) {
            console.error(`[GPIO] Failed to setup Status LED on pin ${gpioConfig.statusLedPin}. Reason: ${err.message}`);
             if (err.code === 'EINVAL') {
                console.error(`[GPIO_FIX] This pin may be in use by another service. Please check your SBC's pinout and kernel configuration.`);
            }
        }
    }
};

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('[AUTH] Token verification failed:', err.name, '-', err.message);
        return res.status(403).json({ error: `Forbidden: ${err.message}` });
    }
};


// --- API Routes ---

// Public/Portal Routes
app.get('/api/settings/public', async (req, res) => {
    try {
        const networkConfig = await db.getSetting('networkConfig');
        const portalSettings = await db.getSetting('portalSettings');
        res.json({ 
            ssid: networkConfig?.ssid || 'SULIT WIFI',
            coinSlotEnabled: portalSettings?.coinSlotEnabled ?? true,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get public settings' });
    }
});

app.post('/api/connect/voucher', async (req, res) => {
    // Placeholder: This would integrate with nodogsplash
    res.status(501).json({ error: 'Voucher connection not implemented yet' });
});

app.post('/api/connect/coin', async (req, res) => {
    // Placeholder: This would integrate with nodogsplash using a generated voucher
    const settings = await db.getSetting('portalSettings');
    const durationMins = settings?.coinPulseValue || 15;
    res.json({ remainingTime: durationMins * 60 });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    try {
        const storedHash = await db.getSetting('adminPassword');
        if (!storedHash) {
            return res.status(500).json({ error: "Admin password not set." });
        }
        const isMatch = await bcrypt.compare(password, storedHash);
        if (isMatch) {
            const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- Authenticated Admin Routes ---

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    try {
        const [activeSessions, used, available] = await Promise.all([
            db.getActiveSessionCount(),
            db.getUsedVoucherCount(),
            db.getAvailableVoucherCount(),
        ]);
        res.json({ activeSessions, totalVouchersUsed: used, totalVouchersAvailable: available });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

app.get('/api/admin/system-info', authMiddleware, async (req, res) => {
     try {
        const [cpu, mem, fsSize] = await Promise.all([si.cpu(), si.mem(), si.fsSize()]);
        const mainDisk = fsSize[0];
        res.json({
            cpu: { model: cpu.manufacturer + ' ' + cpu.brand, cores: cpu.cores },
            ram: { usedMb: Math.round((mem.total - mem.available) / 1024 / 1024), totalMb: Math.round(mem.total / 1024 / 1024) },
            disk: { usedMb: Math.round(mainDisk.used / 1024 / 1024), totalMb: Math.round(mainDisk.size / 1024 / 1024) },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get system info' });
    }
});

app.get('/api/admin/vouchers', authMiddleware, async (req, res) => {
    try {
        const vouchers = await db.getAvailableVouchers();
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get vouchers' });
    }
});

app.post('/api/admin/vouchers', authMiddleware, async (req, res) => {
    const { duration } = req.body; // duration in seconds
    try {
        const voucher = await db.createVoucher(duration);
        res.status(201).json(voucher);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create voucher' });
    }
});

// Settings routes
app.get('/api/admin/settings/portal', authMiddleware, async (req, res) => {
    const settings = await db.getSetting('portalSettings');
    res.json(settings);
});

app.post('/api/admin/settings/portal', authMiddleware, async (req, res) => {
    const { adminPassword, ...portalSettings } = req.body;
    try {
        await db.updateSetting('portalSettings', portalSettings);
        if (adminPassword) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            await db.updateSetting('adminPassword', hashedPassword);
        }
        res.json({ message: 'Portal settings updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

app.get('/api/admin/settings/gpio', authMiddleware, async (req, res) => {
    const config = await db.getSetting('gpioConfig');
    res.json(config);
});

app.post('/api/admin/settings/gpio', authMiddleware, async (req, res) => {
    try {
        await db.updateSetting('gpioConfig', req.body);
        // DYNAMIC RE-INITIALIZATION: Call setupGpio() immediately after saving.
        await setupGpio(); 
        res.json({ message: 'GPIO settings applied successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save GPIO config' });
    }
});

// Network routes
app.get('/api/admin/network/config', authMiddleware, async (req, res) => {
    const config = await db.getSetting('networkConfig');
    res.json(config);
});

app.post('/api/admin/network/config', authMiddleware, async(req, res) => {
    // Save the settings to the database
    await db.updateSetting('networkConfig', req.body);
    // Respond with a success status code and an informational message
    res.status(200).json({ message: 'Network settings saved. Applying them requires a manual restart of networking services.' });
});

app.get('/api/admin/network/info', authMiddleware, async (req, res) => {
    const interfaces = await si.networkInterfaces();
    res.json(interfaces.map(i => ({ name: i.iface, ip4: i.ip4, status: i.operstate })));
});

app.get('/api/admin/network/wan', authMiddleware, async (req, res) => {
    const defaultGateway = await si.networkGatewayDefault();
    res.json({ name: defaultGateway || 'eth0' });
});


// Updater and Backup Routes
app.get('/api/admin/backups', authMiddleware, (req, res) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) return res.json([]);
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.backup'));
    res.json(files);
});

app.post('/api/admin/backups', authMiddleware, async (req, res) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `sulitwifi_backup_${timestamp}.backup`;
    const filepath = path.join(backupDir, filename);
    try {
        await db.backupDatabase(filepath);
        res.json({ message: `Backup created successfully: ${filename}` });
    } catch (error) {
        res.status(500).json({ error: 'Backup failed: ' + error.message });
    }
});

app.delete('/api/admin/backups', authMiddleware, (req, res) => {
    const { filename } = req.body;
    const backupDir = path.join(__dirname, 'backups');
    const filepath = path.join(backupDir, filename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.json({ message: 'Backup deleted.' });
    } else {
        res.status(404).json({ error: 'File not found.' });
    }
});

app.post('/api/admin/backups/restore', authMiddleware, async (req, res) => {
     const { filename } = req.body;
    const backupDir = path.join(__dirname, 'backups');
    const filepath = path.join(backupDir, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup file not found.' });
    }
    try {
        await db.restoreDatabase(filepath);
        // We probably need to restart the server after a restore
        res.json({ message: 'Restore successful! Server is restarting...' });
        // Give time for response to be sent before restarting
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        res.status(500).json({ error: 'Restore failed: ' + error.message });
    }
});

app.get('/api/admin/updater/status', authMiddleware, async (req, res) => {
    try {
        await execPromise('git fetch'); // Fetch latest data from remote
        const { stdout: localCommit } = await execPromise('git rev-parse HEAD');
        const { stdout: remoteCommit } = await execPromise('git rev-parse @{u}'); // Get upstream commit

        const isUpdateAvailable = localCommit.trim() !== remoteCommit.trim();
        res.json({
            statusText: isUpdateAvailable ? 'A new version is available.' : 'You are up to date.',
            isUpdateAvailable,
            localCommit: localCommit.trim(),
            remoteCommit: remoteCommit.trim()
        });
    } catch (error) {
        console.error('[UPDATER] Error checking status:', error);
        res.status(500).json({ 
            statusText: 'Could not check for updates. Is git installed and configured?', 
            isUpdateAvailable: false, 
            localCommit: 'N/A', 
            remoteCommit: 'N/A' 
        });
    }
});

app.post('/api/admin/updater/start', authMiddleware, (req, res) => {
    console.log('[UPDATER] Starting update process...');
    // Execute update script without waiting for it to complete
    exec('git pull && npm install && pm2 restart sulit-wifi', (error, stdout, stderr) => {
        if (error) {
            console.error(`[UPDATER] Exec error: ${error.message}`);
            return;
        }
        if (stdout) console.log(`[UPDATER] stdout: ${stdout}`);
        if (stderr) console.error(`[UPDATER] stderr: ${stderr}`);
    });

    res.json({ message: 'Update process started in the background. The server will restart shortly. Check `pm2 logs` for details.' });
});


app.get('/api/admin/portal/html', authMiddleware, async (req, res) => {
    try {
        const html = await db.getSetting('portalHtml');
        res.json({ html: html || db.DEFAULT_PORTAL_HTML });
    } catch (error) {
        console.error('[PORTAL_EDITOR] Error getting HTML:', error);
        res.status(500).json({ error: 'Could not load portal HTML.' });
    }
});

app.post('/api/admin/portal/html', authMiddleware, async (req, res) => {
    const { html } = req.body;
    if (typeof html !== 'string') {
        return res.status(400).json({ error: 'Invalid HTML content provided.' });
    }
    try {
        await db.updateSetting('portalHtml', html);
        res.json({ message: 'Portal HTML saved successfully.' });
    } catch (error) {
        console.error('[PORTAL_EDITOR] Error saving HTML:', error);
        res.status(500).json({ error: 'Could not save portal HTML.' });
    }
});

app.post('/api/admin/portal/reset', authMiddleware, async (req, res) => {
    try {
        const defaultHtml = await db.resetPortalHtml();
        res.json({ message: 'Portal has been reset to default.', html: defaultHtml });
    } catch (error) {
        console.error('[PORTAL_EDITOR] Error resetting HTML:', error);
        res.status(500).json({ error: 'Could not reset portal HTML.' });
    }
});


// --- SPA Fallback ---
// This should be the last route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Server Start ---
const startServer = async () => {
    try {
        await db.connect();
        await db.initSchema();
        await setupGpio(); // Initialize GPIO after DB is ready
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[Portal] Server listening on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('[FATAL] Could not start server.');
        if (err) {
            console.error('[FATAL] Reason:', err.message || err);
            if (err.stack) console.error('[FATAL] Stack:', err.stack);
        }
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('[Portal] Shutting down...');
    if (coinSlot) coinSlot.unexport();
    if (coinPollInterval) {
        clearInterval(coinPollInterval);
        coinPollInterval = null;
    }
    if (relay) relay.unexport();
    if (statusLed) statusLed.unexport();
    db.close().then(() => {
        console.log('[DB] Database connection closed.');
        process.exit(0);
    });
});
