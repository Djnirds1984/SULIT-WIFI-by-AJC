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
const fs = require('fs');
const os = require('os');

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
    const getSysInfo = async () => {
        const info = {
            cpu: { model: 'N/A', cores: 0 },
            ram: { totalMb: 0, usedMb: 0 },
            disk: { totalMb: 0, usedMb: 0 },
        };

        try {
            const { stdout: cpuInfo } = await promiseExec(`echo $(nproc) && lscpu | grep "Model name" | sed 's/Model name:[ \\t]*//'`);
            const cpuLines = cpuInfo.trim().split('\n');
            if (cpuLines.length > 0) info.cpu.cores = parseInt(cpuLines[0], 10) || 0;
            if (cpuLines.length > 1) info.cpu.model = cpuLines[1];
        } catch (e) {
            console.warn('[Admin] Could not get CPU info:', e.message);
        }

        try {
            const { stdout: ramInfo } = await promiseExec(`free -m | awk '/^Mem:/ {print $2, $3}'`);
            const ramParts = ramInfo.trim().split(/\s+/);
            if (ramParts.length === 2) {
                info.ram.totalMb = parseInt(ramParts[0], 10) || 0;
                info.ram.usedMb = parseInt(ramParts[1], 10) || 0;
            }
        } catch (e) {
            console.warn('[Admin] Could not get RAM info:', e.message);
        }

        try {
            const { stdout: diskInfo } = await promiseExec(`df -B1M --output=size,used / | awk 'NR==2 {print $1, $2}'`);
            const diskParts = diskInfo.trim().split(/\s+/);
            if (diskParts.length === 2) {
                info.disk.totalMb = parseInt(diskParts[0], 10) || 0;
                info.disk.usedMb = parseInt(diskParts[1], 10) || 0;
            }
        } catch (e) {
            console.warn('[Admin] Could not get Disk info:', e.message);
        }

        // Use dummy data if everything failed (e.g., for non-Linux dev environments)
        if (info.cpu.cores === 0 && info.ram.totalMb === 0) {
            console.warn('[Admin] System commands failed, returning dummy data.');
            return {
                cpu: { model: 'ARMv7 Processor (Dummy)', cores: 4 },
                ram: { totalMb: 512, usedMb: 128 },
                disk: { totalMb: 15360, usedMb: 4096 },
            };
        }

        return info;
    };

    try {
        const data = await getSysInfo();
        res.json(data);
    } catch (error) {
        console.error('[Admin] Unhandled error in getSystemInfo:', error);
        res.status(500).json({ message: 'Could not retrieve system information.' });
    }
});

adminRouter.get('/network-info', adminAuth, async (req, res) => {
    const parseIpAddr = (stdout) => {
        const blocks = stdout.trim().split(/^\d+:\s/m).slice(1);
        const result = [];
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            const firstLine = lines[0];
            const nameMatch = firstLine.match(/^([\w\d.-]+):/);
            if (!nameMatch) return;
            const name = nameMatch[1];
            if (name === 'lo') return;

            const statusMatch = firstLine.match(/state\s+([A-Z_]+)/);
            const status = statusMatch ? statusMatch[1] : 'UNKNOWN';
            let ip4 = null;
            let ip6 = null;

            lines.slice(1).forEach(line => {
                const ip4Match = line.match(/inet\s+([\d.]+\/\d+)/);
                if (ip4Match && !ip4) ip4 = ip4Match[1];
                const ip6Match = line.match(/inet6\s+([a-f\d:]+\/\d+)/);
                if (ip6Match) {
                    if (!ip6Match[1].startsWith('fe80') || !ip6) {
                        ip6 = ip6Match[1];
                    }
                }
            });
            result.push({ name, status, ip4, ip6 });
        });
        return result;
    };

    try {
        const { stdout } = await promiseExec('ip addr');
        const data = parseIpAddr(stdout);
        res.json(data);
    } catch (error) {
        console.warn('[Admin] Could not get network info, returning dummy data.', error.message);
        res.json([
            { name: 'eth0', status: 'UP', ip4: '192.168.1.10/24', ip6: 'fe80::a00:27ff:fe4d:5536/64' },
            { name: 'wlan0', status: 'UP', ip4: '192.168.200.13/24', ip6: null },
            { name: 'docker0', status: 'DOWN', ip4: '172.17.0.1/16', ip6: null }
        ]);
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

// --- Updater & Backup Routes ---
const BACKUP_DIR = path.join(os.homedir(), 'sulit-wifi-backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const getLatestBackup = () => {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('sulit-wifi-backup-') && file.endsWith('.tar.gz'))
            .map(file => ({
                file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        return files.length > 0 ? files[0] : null;
    } catch (error) {
        console.error('[Backup] Error reading backup directory:', error);
        return null;
    }
};


const gitExec = async (command) => {
    const gitRepoPath = __dirname;
    try {
        const { stdout, stderr } = await promiseExec(`git -C "${gitRepoPath}" ${command}`);
        if (stderr) console.warn(`[Updater] Git command '${command}' produced stderr: ${stderr}`);
        return stdout.trim();
    } catch (error) {
        console.error(`[Updater] Error executing git command '${command}':`, error.stderr || error.message);
        throw new Error(error.stderr || 'A git command failed to execute.');
    }
};

adminRouter.get('/updater/status', adminAuth, async (req, res) => {
    try {
        let updateInfo = {
            isUpdateAvailable: false, localCommit: 'N/A', remoteCommit: 'N/A',
            commitMessage: 'Not available.', statusText: 'This is not a git repository. Cannot check for updates.'
        };

        if (fs.existsSync(path.join(__dirname, '.git'))) {
            console.log('[Updater] Fetching remote updates...');
            await gitExec('fetch origin');
            
            const localCommit = await gitExec('rev-parse HEAD');
            const remoteCommit = await gitExec('rev-parse origin/main');
            
            if (localCommit === remoteCommit) {
                updateInfo = {
                    statusText: 'Your application is up-to-date.', isUpdateAvailable: false,
                    localCommit: localCommit.substring(0, 7), remoteCommit: remoteCommit.substring(0, 7),
                    commitMessage: 'Already on the latest version.'
                };
            } else {
                 const commitMessage = await gitExec('log origin/main -1 --pretty="format:%s (%cr)"');
                 updateInfo = {
                    statusText: 'An update is available.', isUpdateAvailable: true,
                    localCommit: localCommit.substring(0, 7), remoteCommit: remoteCommit.substring(0, 7),
                    commitMessage: commitMessage,
                };
            }
        }

        const backup = getLatestBackup();
        const backupInfo = backup ? {
            backupFile: backup.file,
            backupDate: new Date(backup.time).toISOString(),
        } : {};
        
        res.json({ ...updateInfo, ...backupInfo });

    } catch (error) {
        res.status(500).json({ 
            statusText: 'Error checking for updates. Check server logs.', isUpdateAvailable: false,
            localCommit: 'Error', remoteCommit: 'Error', commitMessage: error.message,
        });
    }
});

adminRouter.post('/updater/update', adminAuth, (req, res) => {
    console.log('[Updater] Starting update process...');
    res.status(202).json({ message: 'Update process started. The server will now pull the latest changes and restart.' });

    (async () => {
        try {
            console.log('[Updater] Pulling latest changes from origin/main...');
            const pullOutput = await gitExec('pull origin main');
            console.log('[Updater] Git pull output:', pullOutput);

            console.log('[Updater] Installing/updating dependencies...');
            const { stdout: npmOut, stderr: npmErr } = await promiseExec('npm install');
            if (npmErr) console.warn('[Updater] NPM install stderr:', npmErr);
            console.log('[Updater] NPM install stdout:', npmOut);
            
            console.log('[Updater] Rebuilding frontend and restarting server via PM2...');
            const { stdout: pm2Out, stderr: pm2Err } = await promiseExec('pm2 restart sulit-wifi');
            if (pm2Err) console.error('[Updater] PM2 restart stderr:', pm2Err);
            console.log('[Updater] PM2 restart stdout:', pm2Out);
            
            console.log('[Updater] Update process completed.');
        } catch (error) {
            console.error('[Updater] UPDATE FAILED:', error.message);
        }
    })();
});

adminRouter.post('/updater/backup', adminAuth, async (req, res) => {
    const now = new Date();
    const dateString = now.toISOString().replace(/[:.]/g, '-');
    const backupFileName = `sulit-wifi-backup-${dateString}.tar.gz`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    const projectDir = __dirname;
    const projectParentDir = path.dirname(projectDir);
    const projectDirName = path.basename(projectDir);
    
    console.log('[Backup] Starting backup process...');

    try {
        // First, remove any old backups to keep only the latest one.
        const existingBackup = getLatestBackup();
        if (existingBackup) {
            console.log(`[Backup] Removing old backup: ${existingBackup.file}`);
            fs.unlinkSync(path.join(BACKUP_DIR, existingBackup.file));
        }

        // Create the new backup
        const command = `tar -czf "${backupFilePath}" -C "${projectParentDir}" "${projectDirName}"`;
        console.log(`[Backup] Executing: ${command}`);
        await promiseExec(command);
        
        console.log(`[Backup] Successfully created backup: ${backupFileName}`);
        res.status(201).json({ message: `Backup created successfully: ${backupFileName}` });
    } catch (error) {
        console.error('[Backup] Backup failed:', error.stderr || error.message);
        res.status(500).json({ message: 'Failed to create backup. Check server logs.' });
    }
});

adminRouter.post('/updater/restore', adminAuth, (req, res) => {
    const backup = getLatestBackup();
    if (!backup) {
        return res.status(404).json({ message: 'No backup file found to restore.' });
    }
    
    console.log(`[Restore] Starting restore from: ${backup.file}`);
    res.status(202).json({ message: `Restore process started from ${backup.file}. The server will restart shortly.` });

    (async () => {
        const backupFilePath = path.join(BACKUP_DIR, backup.file);
        const projectDir = __dirname;

        try {
            console.log(`[Restore] Extracting archive to ${projectDir}...`);
            // The tarball contains the parent directory, so we extract into its parent
            const restoreCommand = `tar -xzf "${backupFilePath}" -C "${path.dirname(projectDir)}"`;
            await promiseExec(restoreCommand);
            
            console.log('[Restore] Installing dependencies from restored files...');
            await promiseExec(`cd "${projectDir}" && npm install`);

            console.log('[Restore] Restarting server via PM2...');
            await promiseExec('pm2 restart sulit-wifi');
            
            console.log('[Restore] Restore process completed.');
        } catch (error) {
            console.error('[Restore] RESTORE FAILED:', error.stderr || error.message);
        }
    })();
});

adminRouter.delete('/updater/backup', adminAuth, (req, res) => {
    const backup = getLatestBackup();
    if (!backup) {
        return res.status(404).json({ message: 'No backup file found to delete.' });
    }
    
    try {
        const backupFilePath = path.join(BACKUP_DIR, backup.file);
        fs.unlinkSync(backupFilePath);
        console.log(`[Backup] Deleted backup file: ${backup.file}`);
        res.json({ message: `Successfully deleted backup: ${backup.file}` });
    } catch (error) {
        console.error('[Backup] Failed to delete backup:', error);
        res.status(500).json({ message: 'Failed to delete backup file.' });
    }
});


// --- Configure Admin App Middleware (Order is important!) ---
adminApp.use(cors());
adminApp.use(bodyParser.json());

// 1. API routes are highest priority.
adminApp.use('/api/admin', adminRouter);

// 2. Then, serve static assets for the frontend.
adminApp.use(express.static(path.join(__dirname)));
adminApp.use(express.static(path.join(__dirname, 'dist')));

// 3. Finally, the catch-all for the React app's client-side routing.
adminApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// ===============================================
// --- PORTAL SERVER API (Port 3001) ---
// ===============================================

// --- Configure Portal App Middleware (Order is important!) ---
portalApp.use(cors());
portalApp.use(bodyParser.json());

// 1. API Routes
// Public endpoint for the portal to get the network name
portalApp.get('/api/public/settings', (req, res) => {
    res.json(db.settings);
});

// User Session Management
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

// Mount the admin router on the portal app as well.
// This allows the admin panel to be accessed from the LAN, where clients
// are pointed to the portal server.
portalApp.use('/api/admin', adminRouter);

// 2. Then, serve static assets for the frontend.
portalApp.use(express.static(path.join(__dirname)));
portalApp.use(express.static(path.join(__dirname, 'dist')));

// 3. Finally, the catch-all for the React app's client-side routing.
portalApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// --- Start Both Servers ---
portalApp.listen(PORTAL_PORT, () => {
  console.log(`SULIT WIFI Portal Server is running on http://localhost:${PORTAL_PORT}`);
});

adminApp.listen(ADMIN_PORT, () => {
    console.log(`SULIT WIFI Admin Server is running on http://localhost:${ADMIN_PORT}`);
});