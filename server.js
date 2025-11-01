// SULIT WIFI Backend Server for Orange Pi One
// This server handles API requests from the frontend, manages user sessions,
// validates vouchers, and interacts with the Orange Pi's GPIO pins for a
// physical coin slot. It also executes 'ndsctl' commands to control the
// nodogsplash captive portal.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const { Gpio } = require('onoff');

// --- Basic Server Setup ---
const app = express();
const PORT = 3001; // Port for the backend API

// --- In-memory Database (for demonstration) ---
// In a production environment, you would replace this with a real database like PostgreSQL or SQLite.
const db = {
  vouchers: new Map([
    ['SULIT-FREE-5MIN', { code: 'SULIT-FREE-5MIN', duration: 300, used: false }],
    ['SULIT-1HR-TRIAL', { code: 'SULIT-1HR-TRIAL', duration: 3600, used: true }],
    ['SULIT-GAMER-PACK', { code: 'SULIT-GAMER-PACK', duration: 10800, used: false }],
  ]),
  // For simplicity, we'll track sessions by the client's MAC address.
  sessions: new Map(),
  settings: {
    ssid: 'SULIT WIFI Hotspot',
  },
  admin: {
    passwordHash: 'admin123', // IMPORTANT: In a real app, use bcrypt to hash passwords!
    sessionToken: null,
  }
};


// --- GPIO Setup for Coin Slot ---
// This section initializes the GPIO pin to listen for signals from the coin acceptor.
// IMPORTANT: Change the GPIO pin number if you use a different one.
// The number corresponds to the BCM GPIO number, not the physical pin number.
// Refer to the Orange Pi One pinout diagram to find the correct GPIO number.
const COIN_SLOT_GPIO_PIN = 7; 
let coinSlotPin;

// Gracefully handle server shutdown (Ctrl+C) to release the GPIO pin.
process.on('SIGINT', () => {
    if (coinSlotPin) {
        coinSlotPin.unexport();
    }
    process.exit();
});

try {
    // Check if the GPIO interface is available on the system (i.e., we are on the Orange Pi).
    if (Gpio.accessible) {
        // Initialize the pin as an input.
        // 'falling' edge trigger is common for coin acceptors that send a short pulse to ground.
        // 'debounceTimeout' prevents multiple false readings from a single coin drop.
        coinSlotPin = new Gpio(COIN_SLOT_GPIO_PIN, 'in', 'falling', { debounceTimeout: 50 });
        console.log(`GPIO pin ${COIN_SLOT_GPIO_PIN} initialized for coin slot.`);
    } else {
        console.warn("GPIO not accessible. Coin slot will not function. Running in mock mode.");
        coinSlotPin = null;
    }
} catch (error) {
    console.error(`Failed to initialize GPIO pin ${COIN_SLOT_GPIO_PIN}. Check permissions and pin number.`, error);
    coinSlotPin = null;
}


// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
// Serve the built React frontend from the 'public' directory
app.use(express.static('public'));


// --- Helper Functions ---
const generateVoucherCode = () => `SULIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

// This function tells the nodogsplash captive portal to grant internet access to a user.
const authenticateClient = (macAddress, durationSeconds) => {
    if (!macAddress) {
        console.warn("Authentication skipped: No MAC address provided.");
        return;
    }
    const durationMinutes = Math.ceil(durationSeconds / 60);
    // The `ndsctl auth <mac> <minutes>` command adds a client to the allowed list.
    const command = `sudo ndsctl auth ${macAddress} ${durationMinutes}`;
    
    console.log(`Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error(`Failed to authenticate client ${macAddress}:`, stderr);
        } else {
            console.log(`Client ${macAddress} authenticated for ${durationMinutes} minutes.`);
        }
    });
};

// This function tells nodogsplash to immediately revoke a user's internet access.
const deauthenticateClient = (macAddress) => {
     if (!macAddress) {
        console.warn("Deauthentication skipped: No MAC address provided.");
        return;
    }
    const command = `sudo ndsctl deauth ${macAddress}`;
    console.log(`Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error(`Failed to deauthenticate client ${macAddress}:`, stderr);
        } else {
            console.log(`Client ${macAddress} deauthenticated.`);
        }
    });
};

// --- API Routes ---

// ====== User Session Management ======

// Activate a session using a voucher code
app.post('/api/sessions/voucher', (req, res) => {
  const { code } = req.body;
  // The client's MAC address is passed as a query parameter by the nodogsplash redirect.
  const clientMac = req.query.mac;

  if (!code) {
    return res.status(400).json({ message: 'Voucher code is required.' });
  }

  const voucher = db.vouchers.get(code.toUpperCase());

  if (!voucher) {
    return res.status(404).json({ message: 'Invalid voucher code.' });
  }
  if (voucher.used) {
    return res.status(403).json({ message: 'Voucher has already been used.' });
  }

  voucher.used = true;
  const session = {
    voucherCode: code,
    startTime: Date.now(),
    duration: voucher.duration,
    remainingTime: voucher.duration,
  };
  
  db.sessions.set(clientMac, session);
  authenticateClient(clientMac, session.duration);

  console.log(`Voucher activated for MAC ${clientMac}: ${code}`);
  res.status(201).json(session);
});

// Activate a session via coin insert
app.post('/api/sessions/coin', (req, res) => {
    const clientMac = req.query.mac;
    console.log(`Coin session request initiated for MAC: ${clientMac}. Waiting for coin...`);

    if (!coinSlotPin) {
        return res.status(503).json({ message: 'Coin slot hardware is not available.' });
    }

    // This function is the callback that runs when the GPIO pin state changes (a coin is inserted).
    const handleCoinDrop = (err) => {
        if (err) {
            console.error('GPIO error:', err);
            return;
        }

        console.log(`Coin detected for MAC: ${clientMac}!`);
        const duration = 900; // 15 minutes
        const session = {
            voucherCode: `COIN-${Date.now()}`,
            startTime: Date.now(),
            duration: duration,
            remainingTime: duration,
        };
        db.sessions.set(clientMac, session);
        authenticateClient(clientMac, duration);

        // Respond to the frontend.
        if (!res.headersSent) {
            res.status(201).json(session);
        }
        cleanup();
    };

    // Set a timeout in case the user doesn't insert a coin.
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({ message: 'Request timed out. No coin inserted.' });
        }
        cleanup();
    }, 30000); // 30-second timeout

    // A cleanup function to remove the listener and timeout to prevent memory leaks.
    const cleanup = () => {
        clearTimeout(timeout);
        coinSlotPin.unwatch(handleCoinDrop);
    };

    // Start listening for the coin drop.
    coinSlotPin.watch(handleCoinDrop);
});

// Check current session status
app.get('/api/sessions/current', (req, res) => {
    const clientMac = req.query.mac;
    const session = db.sessions.get(clientMac);

    if (!session) {
        return res.status(404).json({ message: 'No active session found.' });
    }

    const elapsedTime = (Date.now() - session.startTime) / 1000;
    const remainingTime = Math.max(0, session.duration - elapsedTime);

    if (remainingTime <= 0) {
        db.sessions.delete(clientMac);
        // No need to explicitly deauth, as nodogsplash handles the timeout automatically.
        return res.status(404).json({ message: 'Session has expired.' });
    }
    
    res.json({ ...session, remainingTime: Math.round(remainingTime) });
});

// Logout (end session)
app.delete('/api/sessions/current', (req, res) => {
    const clientMac = req.query.mac;
    if (db.sessions.has(clientMac)) {
        db.sessions.delete(clientMac);
        deauthenticateClient(clientMac); // Immediately log the user out.
        console.log(`Session ended for MAC: ${clientMac}`);
    }
    res.status(204).send();
});


// ====== Admin Panel ======

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === db.admin.passwordHash) {
        // In a real app, use a secure token strategy like JWT.
        const token = `mock-token-${Date.now()}`;
        db.admin.sessionToken = token;
        return res.json({ token });
    }
    res.status(401).json({ message: "Invalid password" });
});

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

// Get dashboard stats
app.get('/api/admin/stats', adminAuth, (req, res) => {
    const activeSessions = db.sessions.size;
    const totalVouchersUsed = Array.from(db.vouchers.values()).filter(v => v.used).length;
    const totalVouchersAvailable = Array.from(db.vouchers.values()).filter(v => !v.used).length;
    res.json({ activeSessions, totalVouchersUsed, totalVouchersAvailable });
});

// Get all vouchers
app.get('/api/admin/vouchers', adminAuth, (req, res) => {
    res.json(Array.from(db.vouchers.values()));
});

// Generate a new voucher
app.post('/api/admin/vouchers', adminAuth, (req, res) => {
    const { duration } = req.body;
    if (!duration || typeof duration !== 'number') {
        return res.status(400).json({ message: 'Valid duration in seconds is required.' });
    }
    const newCode = generateVoucherCode();
    const newVoucher = { code: newCode, duration, used: false };
    db.vouchers.set(newCode, newVoucher);
    console.log(`Generated new voucher: ${newCode} for ${duration}s`);
    res.status(201).json({ code: newCode });
});

// Get network settings
app.get('/api/admin/settings', (req, res) => {
    // This is often needed by the frontend before admin login to display the network name,
    // so we don't protect it with the adminAuth middleware.
    res.json(db.settings);
});

// Update network settings (SSID)
app.put('/api/admin/settings', adminAuth, (req, res) => {
    const { ssid } = req.body;
    if (!ssid || ssid.length < 3) {
        return res.status(400).json({ message: "SSID must be at least 3 characters long." });
    }
    db.settings.ssid = ssid;
    console.log(`Network SSID updated to: ${ssid}`);
    res.status(204).send();
});


// --- Final Catch-all for Frontend Routing ---
// This ensures that refreshing a page on the React app (e.g., /#admin) still works
// by always serving the main index.html file for any unknown GET request.
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`SULIT WIFI backend is running on http://localhost:${PORT}`);
  console.log("Serving frontend from the 'public' directory.");
});
