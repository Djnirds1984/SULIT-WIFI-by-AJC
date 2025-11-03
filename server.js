
// SULIT WIFI Backend Server for Orange Pi One
// This server handles API requests from the frontend, manages user sessions,
// validates vouchers, and interacts with the Orange Pi's GPIO pins for a
// physical coin slot. It now uses a persistent PostgreSQL database.

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const { Gpio } = require('onoff');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('./backend/postgres.js');

const promiseExec = util.promisify(exec);
const projectRoot = __dirname;

// --- Server Setup ---
const portalApp = express();
const adminApp = express();
const PORTAL_PORT = 3001;
const ADMIN_PORT = 3002;

// --- System configuration paths ---
const isProd = fs.existsSync('/etc/nodogsplash');
const DNSMASQ_HOTSPOT_CONF_PATH = isProd ? '/etc/dnsmasq.d/99-sulit-wifi-hotspot.conf' : path.join(__dirname, '99-sulit-wifi-hotspot.conf.mock');
const SPLASH_HTML_PATH = isProd ? '/etc/nodogsplash/htdocs/splash.html' : path.join(__dirname, 'splash.html.mock');


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
    if (!macAddress || !isProd) return;
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const command = `sudo ndsctl auth ${macAddress} ${durationMinutes}`;
    console.log(`[Portal] Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) console.error(`[Portal] Failed to auth client ${macAddress}:`, stderr);
        else console.log(`[Portal] Client ${macAddress} authenticated for ${durationMinutes} minutes.`);
    });
};

const deauthenticateClient = (macAddress) => {
    if (!macAddress || !isProd) return;
    const command = `sudo ndsctl deauth ${macAddress}`;
    console.log(`[Portal] Executing: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) console.error(`[Portal] Failed to deauth client ${macAddress}:`, stderr);
        else console.log(`[Portal] Client ${macAddress} deauthenticated.`);
    });
};

const getDefaultSplashContent = async () => {
    const settings = await db.getSettings();
    const ipAddress = settings.networkConfiguration.hotspotIpAddress || '192.168.200.13';
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=http://${ipAddress}/?mac=$mac&ip=$ip&gw_id=$gw_id" />
    <title>Connecting...</title>
</head>
<body>
    <p>Please wait, you are being redirected...</p>
</body>
</html>`;
};


// ===============================================
// --- ADMIN SERVER API (Port 3002) ---
// ===============================================

// --- Admin Authentication Middleware ---
const adminAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token is required.' });
    }
    const token = authHeader.split(' ')[1];
    const adminUser = await db.getAdminUser();
    
    if (token && adminUser && token === adminUser.session_token) {
        next();
    } else {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

// --- Admin API Router ---
const adminRouter = express.Router();

adminRouter.post('/login', async (req, res) => {
    const { password } = req.body;
    try {
        const adminUser = await db.getAdminUser();
        if (!adminUser) {
            return res.status(500).json({ message: "Admin user not configured in database." });
        }
        
        const match = await bcrypt.compare(password, adminUser.password_hash);

        if (match) {
            const token = `mock-token-${crypto.randomBytes(16).toString('hex')}`;
            await db.updateAdminToken(token);
            return res.json({ token });
        }
        res.status(401).json({ message: "Invalid password" });
    } catch(err) {
        console.error('[Admin] Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

adminRouter.get('/stats', adminAuth, async (req, res) => {
    try {
        const stats = await db.getDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('[Admin] Error fetching stats:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats.' });
    }
});

adminRouter.get('/system-info', adminAuth, async (req, res) => {
    const getSysInfo = async () => {
        const info = { cpu: { model: 'N/A', cores: 0 }, ram: { totalMb: 0, usedMb: 0 }, disk: { totalMb: 0, usedMb: 0 }};
        if (!isProd) {
            console.warn('[Admin] Not in production, returning dummy system info.');
            return { cpu: { model: 'ARMv7 Processor (Dummy)', cores: 4 }, ram: { totalMb: 512, usedMb: 128 }, disk: { totalMb: 15360, usedMb: 4096 } };
        }
        try {
            const { stdout: cpuInfo } = await promiseExec(`echo $(nproc) && lscpu | grep "Model name" | sed 's/Model name:[ \\t]*//'`);
            const cpuLines = cpuInfo.trim().split('\n');
            if (cpuLines.length > 0) info.cpu.cores = parseInt(cpuLines[0], 10) || 0;
            if (cpuLines.length > 1) info.cpu.model = cpuLines[1];
        } catch (e) { console.warn('[Admin] Could not get CPU info:', e.message); }
        try {
            const { stdout: ramInfo } = await promiseExec(`free -m | awk '/^Mem:/ {print $2, $3}'`);
            const ramParts = ramInfo.trim().split(/\s+/);
            if (ramParts.length === 2) { info.ram.totalMb = parseInt(ramParts[0], 10) || 0; info.ram.usedMb = parseInt(ramParts[1], 10) || 0; }
        } catch (e) { console.warn('[Admin] Could not get RAM info:', e.message); }
        try {
            const { stdout: diskInfo } = await promiseExec(`df -B1M --output=size,used / | awk 'NR==2 {print $1, $2}'`);
            const diskParts = diskInfo.trim().split(/\s+/);
            if (diskParts.length === 2) { info.disk.totalMb = parseInt(diskParts[0], 10) || 0; info.disk.usedMb = parseInt(diskParts[1], 10) || 0; }
        } catch (e) { console.warn('[Admin] Could not get Disk info:', e.message); }
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
        return blocks.map(block => {
            const lines = block.trim().split('\n');
            const firstLine = lines[0];
            const nameMatch = firstLine.match(/^([\w\d.-]+):/);
            if (!nameMatch) return null;
            const name = nameMatch[1];
            if (name === 'lo') return null;
            const statusMatch = firstLine.match(/state\s+([A-Z_]+)/);
            const status = statusMatch ? statusMatch[1] : 'UNKNOWN';
            let ip4 = null, ip6 = null;
            lines.slice(1).forEach(line => {
                const ip4Match = line.match(/inet\s+([\d.]+\/\d+)/); if (ip4Match && !ip4) ip4 = ip4Match[1];
                const ip6Match = line.match(/inet6\s+([a-f\d:]+\/\d+)/); if (ip6Match && (!ip6Match[1].startsWith('fe80') || !ip6)) ip6 = ip6Match[1];
            });
            return { name, status, ip4, ip6 };
        }).filter(Boolean);
    };
    if (!isProd) {
        return res.json([
            { name: 'eth0 (dummy)', status: 'UP', ip4: '192.168.1.10/24', ip6: 'fe80::a00:27ff:fe4d:5536/64' },
            { name: 'wlan0 (dummy)', status: 'UP', ip4: '192.168.200.13/24', ip6: null }
        ]);
    }
    try {
        const { stdout } = await promiseExec('ip addr');
        res.json(parseIpAddr(stdout));
    } catch (error) {
        console.error('[Admin] Could not get network info.', error.message);
        res.status(500).json({ message: 'Failed to retrieve network interface data.' });
    }
});


adminRouter.get('/vouchers', adminAuth, async (req, res) => {
    try {
        const vouchers = await db.getAllVouchers();
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve vouchers.'});
    }
});

adminRouter.post('/vouchers', adminAuth, async (req, res) => {
    const { duration } = req.body;
    if (!duration || typeof duration !== 'number') {
        return res.status(400).json({ message: 'Valid duration in seconds is required.' });
    }
    try {
        const newCode = generateVoucherCode();
        await db.createNewVoucher(newCode, duration);
        console.log(`[Admin] Generated new voucher: ${newCode} for ${duration}s`);
        res.status(201).json({ code: newCode });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate voucher.' });
    }
});

adminRouter.get('/settings', adminAuth, async (req, res) => {
    const settings = await db.getSettings();
    res.json({ ssid: settings.ssid });
});

adminRouter.put('/settings', adminAuth, async (req, res) => {
    const { ssid } = req.body;
    if (!ssid || ssid.length < 3) {
        return res.status(400).json({ message: "SSID must be at least 3 characters long." });
    }
    try {
        const settings = await db.getSettings();
        settings.ssid = ssid;
        await db.updateSettings(settings);
        console.log(`[Admin] Network SSID updated to: ${ssid}`);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Failed to update SSID." });
    }
});

adminRouter.get('/network-config', adminAuth, async (req, res) => {
    const settings = await db.getSettings();
    res.json(settings.networkConfiguration);
});

adminRouter.put('/network-config', adminAuth, async (req, res) => {
    const newNetConfig = req.body;
    const { wanInterface, hotspotInterface, hotspotIpAddress, hotspotDhcpServer } = newNetConfig;
    if (wanInterface === hotspotInterface) {
        return res.status(400).json({ message: 'CRITICAL ERROR: WAN and Hotspot interfaces cannot be the same.' });
    }
    
    try {
        const settings = await db.getSettings();
        settings.networkConfiguration = newNetConfig;
        await db.updateSettings(settings);
        console.log(`[Admin] Network config saved to DB.`);
    } catch (error) {
        console.error('[Admin] Failed to save network config to DB:', error);
        return res.status(500).json({ message: "Failed to save network configuration to database." });
    }
    
    (async () => {
        try {
            const HOTSPOT_INTERFACE_CONF_PATH = isProd ? '/etc/network/interfaces.d/60-sulit-wifi-hotspot' : path.join(__dirname, '60-sulit-wifi-hotspot.mock');
            const interfaceConfig = `auto ${hotspotInterface}\nallow-hotspot ${hotspotInterface}\niface ${hotspotInterface} inet static\n    address ${hotspotIpAddress}\n    netmask 255.255.255.0`;
            if (isProd) await promiseExec(`echo "${interfaceConfig}" | sudo tee ${HOTSPOT_INTERFACE_CONF_PATH}`); else fs.writeFileSync(HOTSPOT_INTERFACE_CONF_PATH, interfaceConfig);
            if (isProd) { await promiseExec(`sudo ifdown ${hotspotInterface}`).catch(e => {}); await promiseExec(`sudo ifup ${hotspotInterface}`); }
            if (hotspotDhcpServer.enabled) {
                const dnsmasqConfig = `interface=${hotspotInterface}\ndhcp-range=${hotspotDhcpServer.start},${hotspotDhcpServer.end},${hotspotDhcpServer.lease}\ndhcp-option=3,${hotspotIpAddress}\ndhcp-option=6,${hotspotIpAddress}`;
                fs.writeFileSync(DNSMASQ_HOTSPOT_CONF_PATH, dnsmasqConfig);
            } else { if(fs.existsSync(DNSMASQ_HOTSPOT_CONF_PATH)) fs.unlinkSync(DNSMASQ_HOTSPOT_CONF_PATH); }
            if (isProd) await promiseExec('sudo systemctl restart dnsmasq');
            const splashContent = await getDefaultSplashContent();
            if (isProd) await promiseExec(`echo '${splashContent}' | sudo tee ${SPLASH_HTML_PATH}`); else fs.writeFileSync(SPLASH_HTML_PATH, splashContent);
            if (isProd) {
                 await promiseExec(`sudo sed -i 's/^#* *GatewayInterface .*/GatewayInterface ${hotspotInterface}/' /etc/nodogsplash/nodogsplash.conf`);
                 await promiseExec('sudo pkill nodogsplash').catch(e => {});
                 await promiseExec('sudo nodogsplash');
            }
            console.log("[Admin] Successfully applied network changes to the system.");
        } catch (error) {
            console.error('[Admin] FAILED to apply network configuration changes:', error.stderr || error.message);
        }
    })();

    res.status(204).send();
});

adminRouter.get('/portal-html', adminAuth, async (req, res) => {
    try {
        const content = await fs.promises.readFile(SPLASH_HTML_PATH, 'utf-8');
        res.json({ html: content });
    } catch (error) { res.status(500).json({ message: 'Could not read portal HTML file.' }); }
});

adminRouter.put('/portal-html', adminAuth, async (req, res) => {
    const { html } = req.body;
    if (typeof html !== 'string') {
        return res.status(400).json({ message: 'HTML content must be a string.' });
    }
    try {
        if (isProd) {
            const escapedHtml = html.replace(/'/g, "'\\''");
            await promiseExec(`echo '${escapedHtml}' | sudo tee ${SPLASH_HTML_PATH}`);
        } else {
            await fs.promises.writeFile(SPLASH_HTML_PATH, html);
        }
        res.status(204).send();
    } catch (error) {
        console.error('[Admin] Error updating portal HTML:', error);
        res.status(500).json({ message: 'Could not write to portal HTML file.' });
    }
});

adminRouter.post('/portal-html/reset', adminAuth, async (req, res) => {
    try {
        const defaultHtml = await getDefaultSplashContent();
        if (isProd) {
            const escapedHtml = defaultHtml.replace(/'/g, "'\\''");
            await promiseExec(`echo '${escapedHtml}' | sudo tee ${SPLASH_HTML_PATH}`);
        } else {
            await fs.promises.writeFile(SPLASH_HTML_PATH, defaultHtml);
        }
        res.json({ html: defaultHtml });
    } catch (error) {
        console.error('[Admin] Error resetting portal HTML:', error);
        res.status(500).json({ message: 'Could not reset portal HTML file.' });
    }
});

const BACKUP_DIR = path.join(os.homedir(), 'sulit-wifi-backups');
if (!fs.existsSync(BACKUP_DIR)) { fs.mkdirSync(BACKUP_DIR, { recursive: true }); }

const getLatestBackup = () => {
    if (!fs.existsSync(BACKUP_DIR)) return null;
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.tar.gz'))
        .map(f => ({ name: f, stat: fs.statSync(path.join(BACKUP_DIR, f)) }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
    return files.length > 0 ? files[0] : null;
};

const createBackupProcess = async () => {
    const backupFile = `sulit-wifi-backup-${new Date().toISOString().replace(/:/g, '-')}.tar.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFile);
    const command = `tar --exclude='./node_modules' --exclude='./.git' --exclude='${BACKUP_DIR}' -czf ${backupPath} .`;
    await promiseExec(command, { cwd: projectRoot });
    return { backupFile, backupPath };
};

const gitExec = (command) => promiseExec(command, { cwd: projectRoot });

adminRouter.get('/updater/status', adminAuth, async (req, res) => {
    try {
        await gitExec('git fetch');
        const { stdout: local } = await gitExec('git rev-parse HEAD');
        const { stdout: remote } = await gitExec('git rev-parse @{u}');
        const { stdout: message } = await gitExec('git log -1 --pretty=%B @{u}');

        const latestBackup = getLatestBackup();
        const status = {
            localCommit: local.trim().slice(0, 7),
            remoteCommit: remote.trim().slice(0, 7),
            commitMessage: message.trim(),
            isUpdateAvailable: local.trim() !== remote.trim(),
            statusText: local.trim() !== remote.trim() ? 'A new update is available.' : 'Your application is up-to-date.',
            backupFile: latestBackup ? latestBackup.name : undefined,
            backupDate: latestBackup ? latestBackup.stat.mtime.toISOString() : undefined,
        };
        res.json(status);
    } catch (error) {
        console.error('[Admin] Updater status check failed:', error);
        res.status(500).json({ message: 'Failed to check for updates. Ensure git is configured correctly.' });
    }
});

adminRouter.post('/updater/update', adminAuth, async (req, res) => {
    res.status(202).json({ message: 'Update process started. The server will restart shortly.' });
    (async () => {
        try {
            console.log('[Updater] Starting safe update process...');
            await createBackupProcess();
            console.log('[Updater] Backup created. Pulling latest changes...');
            await gitExec('git pull');
            console.log('[Updater] Changes pulled. Installing dependencies...');
            await promiseExec('npm install');
            console.log('[Updater] Dependencies installed. Restarting application via PM2...');
            await promiseExec('pm2 restart sulit-wifi');
        } catch (error) {
            console.error('[Updater] FATAL: Update process failed.', error);
        }
    })();
});

adminRouter.post('/updater/backup', adminAuth, async (req, res) => {
    try {
        const { backupFile } = await createBackupProcess();
        res.json({ message: `Backup created successfully: ${backupFile}` });
    } catch (error) {
        console.error('[Admin] Backup creation failed:', error);
        res.status(500).json({ message: 'Failed to create backup.' });
    }
});

adminRouter.post('/updater/restore', adminAuth, (req, res) => {
    res.status(202).json({ message: 'Restore process started. The server will restart shortly.' });
    (async () => {
        try {
            console.log('[Updater] Starting restore from backup...');
            const latestBackup = getLatestBackup();
            if (!latestBackup) throw new Error('No backup file found to restore from.');
            const backupPath = path.join(BACKUP_DIR, latestBackup.name);
            console.log(`[Updater] Restoring from ${backupPath}`);
            await promiseExec(`tar -xzf ${backupPath} -C ${projectRoot}`);
            console.log('[Updater] Files restored. Installing dependencies...');
            await promiseExec('npm install');
            console.log('[Updater] Dependencies installed. Restarting application via PM2...');
            await promiseExec('pm2 restart sulit-wifi');
        } catch (error) {
            console.error('[Updater] FATAL: Restore process failed.', error);
        }
    })();
});

adminRouter.delete('/updater/backup', adminAuth, (req, res) => {
    try {
        const latestBackup = getLatestBackup();
        if (latestBackup) {
            fs.unlinkSync(path.join(BACKUP_DIR, latestBackup.name));
            res.json({ message: `Backup ${latestBackup.name} deleted.` });
        } else {
            res.status(404).json({ message: 'No backup file to delete.' });
        }
    } catch (error) {
        console.error('[Admin] Could not delete backup:', error);
        res.status(500).json({ message: 'Failed to delete backup file.' });
    }
});

adminApp.use(cors()); adminApp.use(bodyParser.json());
adminApp.use('/api/admin', adminRouter);
adminApp.use(express.static(path.join(__dirname)));
adminApp.use(express.static(path.join(__dirname, 'dist')));
adminApp.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===============================================
// --- PORTAL SERVER API (Port 3001) ---
// ===============================================
portalApp.use(cors()); portalApp.use(bodyParser.json());

portalApp.get('/api/public/settings', async (req, res) => {
    const settings = await db.getSettings();
    res.json({ ssid: settings.ssid });
});

portalApp.post('/api/sessions/voucher', async (req, res) => {
    const { code } = req.body;
    const clientMac = req.query.mac;
    if (!code || !clientMac) return res.status(400).json({ message: 'Voucher code and MAC address are required.' });
    try {
        const voucher = await db.getVoucherByCode(code.toUpperCase());
        if (!voucher) return res.status(404).json({ message: 'Invalid voucher code.' });
        if (voucher.is_used) return res.status(403).json({ message: 'Voucher has already been used.' });

        await db.useVoucher(code.toUpperCase());
        await db.createSession(clientMac, code.toUpperCase(), voucher.duration_seconds);
        authenticateClient(clientMac, voucher.duration_seconds);
        
        const session = { voucherCode: code, startTime: Date.now(), duration: voucher.duration_seconds, remainingTime: voucher.duration_seconds };
        console.log(`[Portal] Voucher activated for MAC ${clientMac}: ${code}`);
        res.status(201).json(session);
    } catch(err) {
        res.status(500).json({ message: "Server error activating voucher." });
    }
});

portalApp.post('/api/sessions/coin', async (req, res) => {
    const clientMac = req.query.mac;
    if (!clientMac) return res.status(400).json({ message: 'MAC address is required.' });
    if (!coinSlotPin) return res.status(503).json({ message: 'Coin slot hardware is not available.' });

    let watcher;
    const cleanup = () => {
        clearTimeout(timeout);
        if (watcher) coinSlotPin.unwatch(watcher);
    };

    const timeout = setTimeout(() => {
        if (!res.headersSent) res.status(408).json({ message: 'Request timed out. No coin inserted.' });
        cleanup();
    }, 30000);
    
    watcher = async (err) => {
        if (err) { console.error('[Portal] GPIO error:', err); return; }
        console.log(`[Portal] Coin detected for MAC: ${clientMac}!`);
        const duration = 900; // 15 minutes
        await db.createSession(clientMac, `COIN-${Date.now()}`, duration);
        authenticateClient(clientMac, duration);
        const session = { voucherCode: `COIN-${Date.now()}`, startTime: Date.now(), duration, remainingTime: duration };
        if (!res.headersSent) res.status(201).json(session);
        cleanup();
    };

    coinSlotPin.watch(watcher);
});

portalApp.get('/api/sessions/current', async (req, res) => {
    const clientMac = req.query.mac;
    if (!clientMac) return res.status(400).json({ message: 'MAC address is required.' });
    
    try {
        const session = await db.getSession(clientMac);
        if (!session) return res.status(404).json({ message: 'No active session found.' });
        
        const startTime = new Date(session.start_time).getTime();
        const elapsedTime = (Date.now() - startTime) / 1000;
        const remainingTime = Math.max(0, session.duration_seconds - elapsedTime);

        if (remainingTime <= 0) {
            await db.deleteSession(clientMac);
            deauthenticateClient(clientMac);
            return res.status(404).json({ message: 'Session has expired.' });
        }
        res.json({ voucherCode: session.voucher_code, startTime, duration: session.duration_seconds, remainingTime: Math.round(remainingTime) });
    } catch(err) {
        res.status(500).json({ message: "Server error checking session." });
    }
});

portalApp.delete('/api/sessions/current', async (req, res) => {
    const clientMac = req.query.mac;
    if (clientMac) {
        await db.deleteSession(clientMac);
        deauthenticateClient(clientMac);
        console.log(`[Portal] Session ended for MAC: ${clientMac}`);
    }
    res.status(204).send();
});

portalApp.use(express.static(path.join(__dirname)));
portalApp.use(express.static(path.join(__dirname, 'dist')));
portalApp.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Start Both Servers ---
const startServer = async () => {
    try {
        // First, check the database connection explicitly
        await db.checkConnection();
        console.log('[DB] Database connection successful.');
        
        // Then initialize the schema
        await db.initializeDatabase();
        
        portalApp.listen(PORTAL_PORT, () => {
          console.log(`SULIT WIFI Portal Server is running on http://localhost:${PORTAL_PORT}`);
        });

        adminApp.listen(ADMIN_PORT, () => {
            console.log(`SULIT WIFI Admin Server is running on http://localhost:${ADMIN_PORT}`);
        });
    } catch (error) {
        if (error.code === '28P01') { // PostgreSQL password authentication error code
            console.error('\n================================================================');
            console.error('[DB] FATAL: Database password authentication failed for user "sulituser".');
            console.error('Please check that the PGPASSWORD in your .env file is correct.');
            console.error('================================================================\n');
        } else {
            console.error('[SERVER] FATAL: Could not start server. An unexpected error occurred.', error);
        }
        process.exit(1); // Exit with an error code
    }
};

startServer();