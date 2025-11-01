// SULIT WIFI Backend Server for Orange Pi One
// This server handles API requests from the frontend, manages user sessions,
// validates vouchers, and interacts with the Orange Pi's GPIO pins for a
// physical coin slot. It also executes 'ndsctl' commands to control the
// nodogsplash captive portal.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const { Gpio } = require('onoff');
const path = require('path');

const promiseExec = util.promisify(exec);

// --- Server Setup ---
// We will run two separate Express apps in one Node process.
// 1. portalApp: For the user-facing captive portal (vouchers, coin-slot, session status).
// 2. adminApp: For the admin panel (login, stats, settings).
const portalApp = express();
const adminApp = express();

const PORTAL_PORT = 3001;
const ADMIN_PORT = 3002;

// --- In-memory Database (shared between both apps) ---
const db = {
  vouchers: new Map([
    ['SULIT-FREE-5MIN', { code: 'SULIT-FREE-5MIN', duration: 300, used: false }],
    ['SULIT-1HR-TRIAL', { code: 'SULIT-1HR-TRIAL', duration: 3600, used: true }],
    ['SULIT-GAMER-PACK', { code: 'SULIT-GAMER-PACK', duration: 10800, used: false }],
  ]),
  sessions: new Map(), // Keyed by client's MAC address
  settings: {
    ssid: 'SULIT WIFI Hotspot',
  },
  admin: {
    passwordHash: 'admin123', // IMPORTANT: In a real app, use bcrypt!
    sessionToken: null,
  }
};

// --- GPIO Setup for Coin Slot (Portal Server only) ---
const COIN_SLOT_GPIO_PIN = 7;
let coinSlotPin;

process.on('SIGINT', () => {
    if (coinSlotPin) {
        coinSlotPin.unexport();
    }
    process.exit();
});

try {
    if (Gpio.accessible) {
        coinSlotPin = new Gpio(COIN_SLOT_GPIO_PIN, 'in', 'falling', { debounceTimeout: 50 });
        console.log(`[Portal] GPIO pin ${COIN_SLOT_GPIO_PIN} initialized for coin slot.`);
    } else {
        console.warn("[Portal] GPIO not accessible. Coin slot will not function.");
        coinSlotPin = null;
    }
} catch (error) {
    console.error(`[Portal] Failed to initialize GPIO pin ${COIN_SLOT_GPIO_PIN}.`, error);
    coinSlotPin = null;
}

// --- Common Middleware ---
const commonMiddleware = [
    cors(),
    bodyParser.json(),
    express.static(path.join(__dirname)), // Serve index.html, etc from root
    express.static(path.join(__dirname, 'dist')), // Serve the bundled JS
];
portalApp.use(commonMiddleware);
adminApp.use(commonMiddleware);

// --- Helper Functions ---
const generateVoucherCode = () => `SULIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

const authenticateClient = (macAddress, durationSeconds) => {
    if (!macAddress) return;
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const command = `sudo ndsctl auth ${macAddress} ${durationMinutes}`;
    console.log(`[Portal] Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) console.error(`[Portal] Failed to auth client ${macAddress}:`, stderr);
        else console.log(`[Portal] Client ${macAddress} authenticated for ${durationMinutes} minutes.`);
    });
};

const deauthenticateClient = (macAddress) => {
    if (!macAddress) return;
    const command = `sudo ndsctl deauth ${macAddress}`;
    console.log(`[Portal] Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) console.error(`[Portal] Failed to deauth client ${macAddress}:`, stderr);
        else console.log(`[Portal] Client ${macAddress} deauthenticated.`);
    });
};

// ===============================================
// --- PORTAL SERVER API (Port 3001) ---
// ===============================================

// --- Public Routes (for user portal) ---

// Public endpoint for the portal to get the network name
portalApp.get('/api/public/settings', (req, res) => {
    res.json(db.settings);
});

// --- User Session Management ---

portalApp.post('/api/sessions/voucher', (req, res) => {
  const { code } = req.body;
  const clientMac = req.query.mac;
  if (!code) return res.status(400).json({ message: 'Voucher code is required.' });

  const voucher = db.vouchers.get(code.toUpperCase());
  if (!voucher) return res.status(404).json({ message: 'Invalid voucher code.' });
  if (voucher.used) return res.status(403).json({ message: 'Voucher has already been used.' });

  voucher.used = true;
  const session = {
    voucherCode: code, startTime: Date.now(), duration: voucher.duration, remainingTime: voucher.duration,
  };
  db.sessions.set(clientMac, session);
  authenticateClient(clientMac, session.duration);
  console.log(`[Portal] Voucher activated for MAC ${clientMac}: ${code}`);
  res.status(201).json(session);
});

portalApp.post('/api/sessions/coin', (req, res) => {
    const clientMac = req.query.mac;
    console.log(`[Portal] Coin session request for MAC: ${clientMac}. Waiting for coin...`);
    if (!coinSlotPin) return res.status(503).json({ message: 'Coin slot hardware is not available.' });

    const handleCoinDrop = (err) => {
        if (err) { console.error('[Portal] GPIO error:', err); return; }
        console.log(`[Portal] Coin detected for MAC: ${clientMac}!`);
        const duration = 900; // 15 minutes
        const session = { voucherCode: `COIN-${Date.now()}`, startTime: Date.now(), duration, remainingTime: duration };
        db.sessions.set(clientMac, session);
        authenticateClient(clientMac, duration);
        if (!res.headersSent) res.status(201).json(session);
        cleanup();
    };

    const timeout = setTimeout(() => {
        if (!res.headersSent) res.status(408).json({ message: 'Request timed out. No coin inserted.' });
        cleanup();
    }, 30000);

    const cleanup = () => { clearTimeout(timeout); coinSlotPin.unwatch(handleCoinDrop); };
    coinSlotPin.watch(handleCoinDrop);
});

portalApp.get('/api/sessions/current', (req, res) => {
    const clientMac = req.query.mac;
    const session = db.sessions.get(clientMac);
    if (!session) return res.status(404).json({ message: 'No active session found.' });

    const elapsedTime = (Date.now() - session.startTime) / 1000;
    const remainingTime = Math.max(0, session.duration - elapsedTime);
    if (remainingTime <= 0) {
        db.sessions.delete(clientMac);
        return res.status(404).json({ message: 'Session has expired.' });
    }
    res.json({ ...session, remainingTime: Math.round(remainingTime) });
});

portalApp.delete('/api/sessions/current', (req, res) => {
    const clientMac = req.query.mac;
    if (db.sessions.has(clientMac)) {
        db.sessions.delete(clientMac);
        deauthenticateClient(clientMac);
        console.log(`[Portal] Session ended for MAC: ${clientMac}`);
    }
    res.status(204).send();
});

// Catch-all for Portal Frontend Routing
portalApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// ===============================================
// --- ADMIN SERVER API (Port 3002) ---
// ===============================================

// --- Admin Authentication Middleware ---
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token is required.' });
    }
    const token = authHeader.split(' ')[1];
    if (token && token === db.admin.sessionToken) {
        next();
    } else {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

// --- Admin API Router ---
// This router consolidates all admin API endpoints.
const adminRouter = express.Router();

adminRouter.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === db.admin.passwordHash) {
        const token = `mock-token-${Date.now()}`;
        db.admin.sessionToken = token;
        return res.json({ token });
    }
    res.status(401).json({ message: "Invalid password" });
});

adminRouter.get('/stats', adminAuth, (req, res) => {
    const activeSessions = db.sessions.size;
    const totalVouchersUsed = Array.from(db.vouchers.values()).filter(v => v.used).length;
    const totalVouchersAvailable = Array.from(db.vouchers.values()).filter(v => !v.used).length;
    res.json({ activeSessions, totalVouchersUsed, totalVouchersAvailable });
});

adminRouter.get('/system-info', adminAuth, async (req, res) => {
    try {
        const [cpuInfo, ramInfo, diskInfo] = await Promise.all([
            promiseExec(`echo $(nproc) && lscpu | grep "Model name" | sed 's/Model name:[ \\t]*//'`),
            promiseExec(`free -m | awk '/^Mem:/ {print $2, $3}'`),
            promiseExec(`df -B1M --output=size,used / | awk 'NR==2 {print $1, $2}'`)
        ]).catch(e => {
            // Handle case where commands might not be available
            console.warn("[Admin] Could not execute a system command. Returning dummy data. Error:", e.message);
            // Provide dummy data for non-Linux environments or if a command fails
            return [
                { stdout: '4\nARMv7 Processor rev 5 (v7l)' },
                { stdout: '512 128' },
                { stdout: '15360 4096' }
            ];
        });

        const [cores, model] = cpuInfo.stdout.trim().split('\n');
        const [totalMb, usedMb] = ramInfo.stdout.trim().split(' ');
        const [totalDiskMb, usedDiskMb] = diskInfo.stdout.trim().split(/\s+/);

        res.json({
            cpu: { model, cores: parseInt(cores, 10) },
            ram: { totalMb: parseInt(totalMb, 10), usedMb: parseInt(usedMb, 10) },
            disk: { totalMb: parseInt(totalDiskMb, 10), usedMb: parseInt(usedDiskMb, 10) }
        });
    } catch (error) {
        console.error('[Admin] Failed to get system info:', error);
        res.status(500).json({ message: 'Could not retrieve system information.' });
    }
});

adminRouter.get('/vouchers', adminAuth, (req, res) => {
    res.json(Array.from(db.vouchers.values()));
});

adminRouter.post('/vouchers', adminAuth, (req, res) => {
    const { duration } = req.body;
    if (!duration || typeof duration !== 'number') {
        return res.status(400).json({ message: 'Valid duration in seconds is required.' });
    }
    const newCode = generateVoucherCode();
    const newVoucher = { code: newCode, duration, used: false };
    db.vouchers.set(newCode, newVoucher);
    console.log(`[Admin] Generated new voucher: ${newCode} for ${duration}s`);
    res.status(201).json({ code: newCode });
});

adminRouter.get('/settings', adminAuth, (req, res) => {
    res.json(db.settings);
});

adminRouter.put('/settings', adminAuth, (req, res) => {
    const { ssid } = req.body;
    if (!ssid || ssid.length < 3) {
        return res.status(400).json({ message: "SSID must be at least 3 characters long." });
    }
    db.settings.ssid = ssid;
    console.log(`[Admin] Network SSID updated to: ${ssid}`);
    res.status(204).send();
});

// Mount the admin router on BOTH apps.
// This makes the admin API available on the admin server (for WAN access)
// and on the portal server (as a fallback for LAN/misconfigured access),
// fixing the 404 error when accessing the admin panel from the LAN.
portalApp.use('/api/admin', adminRouter);
adminApp.use('/api/admin', adminRouter);

// Catch-all for Admin Frontend Routing
adminApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Both Servers ---
portalApp.listen(PORTAL_PORT, () => {
  console.log(`SULIT WIFI Portal Server is running on http://localhost:${PORTAL_PORT}`);
});

adminApp.listen(ADMIN_PORT, () => {
    console.log(`SULIT WIFI Admin Server is running on http://localhost:${ADMIN_PORT}`);
});