# SULIT WIFI Portal on Orange Pi One

This guide provides step-by-step instructions for deploying the SULIT WIFI hotspot portal on an Orange Pi One running Armbian. The project includes a Node.js backend, a React frontend, and integration with the Orange Pi's GPIO for a physical coin slot.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3.  [Step 1: Orange Pi One Setup](#step-1-orange-pi-one-setup)
4.  [Step 2: Backend Setup (Node.js)](#step-2-backend-setup-nodejs)
5.  [Step 3: Frontend Build](#step-3-frontend-build)
6.  [Step 4: GPIO Coin Slot Integration](#step-4-gpio-coin-slot-integration)
7.  [Step 5: Captive Portal Configuration](#step-5-captive-portal-configuration)
8.  [Step 6: Running the Application](#step-6-running-the-application)

---

## Project Overview

This application creates a captive portal for a Wi-Fi hotspot.
- **Frontend**: A user-friendly portal built with React where users can log in with vouchers or a coin insert. It also includes an admin panel for managing the hotspot.
- **Backend**: A Node.js (Express) server that handles session management, voucher validation, admin authentication, and GPIO events.
- **Hardware Integration**: Connects to a physical coin acceptor via the Orange Pi's GPIO pins.

## Hardware & Software Prerequisites

### Hardware
*   Orange Pi One
*   A reliable 5V/2A power supply
*   A high-quality microSD Card (16GB or more recommended)
*   A USB Wi-Fi Adapter (the Orange Pi One has no built-in Wi-Fi)
*   A physical coin acceptor/slot mechanism
*   Jumper wires for connecting the coin slot

### Software
*   [Armbian](https://www.armbian.com/orange-pi-one/) (Debian-based version recommended)
*   An SSH client (like PuTTY or your terminal's `ssh` command)
*   Software to flash the OS image to the microSD card (e.g., [BalenaEtcher](https://www.balena.io/etcher/))

---

## Step 1: Orange Pi One Setup

1.  **Flash Armbian**: Download the Armbian image for the Orange Pi One and flash it onto your microSD card using BalenaEtcher.
2.  **First Boot & Configuration**: Insert the microSD card into your Orange Pi, connect it to your network via Ethernet, and power it on.
    *   Find the Pi's IP address from your router's admin page.
    *   SSH into the device: `ssh root@<ORANGE_PI_IP_ADDRESS>`.
    *   The default password is `1234`. You will be prompted to change it and create a new user account. Complete this setup.
3.  **System Update**: Once logged in as your new user, update the system:
    ```bash
    sudo apt-get update
    sudo apt-get upgrade -y
    ```
4.  **Install Node.js**: We'll use NodeSource to get a modern version of Node.js.
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```
    Verify the installation:
    ```bash
    node -v  # Should show v18.x.x or higher
    npm -v
    ```

---

## Step 2: Backend Setup (Node.js)

The frontend is designed to communicate with a backend API. You need to create this server on your Orange Pi.

1.  **Create Project Directory**:
    ```bash
    mkdir ~/sulit-wifi-backend
    cd ~/sulit-wifi-backend
    ```
2.  **Initialize Node.js Project**:
    ```bash
    npm init -y
    ```
3.  **Install Dependencies**: We need Express to run the server, `cors` for cross-origin requests, `body-parser` to handle JSON, and `onoff` to control GPIO.
    ```bash
    npm install express cors body-parser onoff
    ```
4.  **Create the Server File**: Create a file named `server.js`. This file will contain your API logic. You can use the logic from the `backend/api.ts` and `backend/db.ts` files as a starting point.

    **Example `server.js`:**
    ```javascript
    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors');

    const app = express();
    const port = 3001; // Port for the backend API

    // In-memory database (from your backend/db.ts)
    const db = {
      vouchers: new Map([
        ['SULIT-FREE-5MIN', { code: 'SULIT-FREE-5MIN', duration: 300, used: false }],
        ['SULIT-1HR-TRIAL', { code: 'SULIT-1HR-TRIAL', duration: 3600, used: true }],
      ]),
      sessions: new Map(),
      settings: { ssid: 'SULIT WIFI Hotspot' },
      admin: { passwordHash: 'admin123' } // IMPORTANT: Use bcrypt in a real app!
    };

    app.use(cors());
    app.use(bodyParser.json());

    // --- API Endpoints ---
    
    // POST /api/sessions/voucher - Activate a voucher
    app.post('/api/sessions/voucher', (req, res) => {
        const { code } = req.body;
        const voucher = db.vouchers.get(code);

        if (!voucher) return res.status(404).json({ message: 'Invalid voucher code.' });
        if (voucher.used) return res.status(403).json({ message: 'Voucher has already been used.' });
        
        voucher.used = true;
        const session = {
            voucherCode: code,
            startTime: Date.now(),
            duration: voucher.duration,
            remainingTime: voucher.duration,
        };
        db.sessions.set('currentUser', session); // Mocking a single user
        
        console.log(`Voucher activated: ${code}`);
        res.json(session);
    });

    // Add all other API endpoints from your `services/wifiService.ts` here...
    // Examples: GET /api/sessions/current, POST /api/admin/login, etc.
    // GET /api/admin/settings
    app.get('/api/admin/settings', (req, res) => {
        // NOTE: In a real app, you would add authentication middleware here
        res.json(db.settings);
    });

    // Serve the built React app (we'll set this up in the next step)
    app.use(express.static('public'));

    app.listen(port, () => {
        console.log(`SULIT WIFI backend listening at http://localhost:${port}`);
    });
    ```
    > **Note**: This is a simplified server. You will need to implement all the endpoints defined in `services/wifiService.ts` and add proper authentication and error handling.

---

## Step 3: Frontend Build

The React application needs to be "built" into static HTML, CSS, and JavaScript files that can be served by our Express server.

1.  **Build on your Development Machine**: It's faster to build the frontend on your main computer rather than the Orange Pi.
    *   Make sure you have Node.js installed.
    *   Navigate to your project directory.
    *   Install dependencies: `npm install`
    *   Run the build command (this may vary based on your project setup, but is often one of these):
        ```bash
        npm run build
        # OR
        vite build
        ```
    *   This will create a `dist` or `build` folder containing the static files.

2.  **Transfer Files to Orange Pi**:
    *   Use `scp` (secure copy) to transfer the contents of the build folder to the Orange Pi.
    *   Create a `public` directory inside your backend project folder on the Pi:
        ```bash
        # On the Orange Pi
        cd ~/sulit-wifi-backend
        mkdir public
        ```
    *   From your development machine, run:
        ```bash
        # Replace <path-to-build> and <user>@<pi-ip>
        scp -r <path-to-your-project>/dist/* <user>@<ORANGE_PI_IP_ADDRESS>:~/sulit-wifi-backend/public/
        ```

Your Express server is already configured with `app.use(express.static('public'))` to serve these files.

---

## Step 4: GPIO Coin Slot Integration

1.  **Identify GPIO Pin**: The Orange Pi One has a 40-pin header. You need to choose a GPIO pin to connect your coin acceptor's signal wire to. Refer to a pinout diagram for the Orange Pi One. Let's assume we use **GPIO7**.

2.  **Physical Connection**:
    *   Connect the coin acceptor's **GND** wire to a Ground pin on the Orange Pi.
    *   Connect the coin acceptor's **VCC** wire to a 5V pin on the Orange Pi.
    *   Connect the coin acceptor's **Signal** wire to your chosen GPIO pin (e.g., GPIO7).

3.  **Update `server.js`**: Use the `onoff` library to listen for a signal from the coin acceptor.

    ```javascript
    // Add this to the top of server.js
    const { Gpio } = require('onoff');

    // Setup the GPIO pin for input
    // The pin number corresponds to the GPIO number, not the physical pin number.
    const coinSlotPin = new Gpio(7, 'in', 'falling'); // 'falling' edge is often used for pulses

    // POST /api/sessions/coin
    app.post('/api/sessions/coin', (req, res) => {
        console.log("Awaiting coin insertion...");

        // This function will be called when the GPIO state changes
        const handleCoinDrop = (err) => {
            if (err) {
                console.error('GPIO error:', err);
                return;
            }

            console.log("Coin detected!");
            
            const duration = 900; // 15 minutes
            const session = {
                voucherCode: `COIN-${Date.now()}`,
                startTime: Date.now(),
                duration: duration,
                remainingTime: duration,
            };
            db.sessions.set('currentUser', session);
            
            // Send response back to the client
            if (!res.headersSent) {
              res.json(session);
            }

            // Stop watching after one coin drop to prevent multiple triggers for one request
            coinSlotPin.unwatch(handleCoinDrop);
        };
        
        // Watch for a pulse from the coin acceptor
        coinSlotPin.watch(handleCoinDrop);

        // Add a timeout in case no coin is inserted
        setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({ message: 'Request timed out. No coin inserted.' });
            }
            coinSlotPin.unwatch(handleCoinDrop);
        }, 30000); // 30 second timeout
    });
    ```
    > **Permissions**: You might need to add your user to the `gpio` group: `sudo usermod -aG gpio <your-username>`

---

## Step 5: Captive Portal Configuration

To make this a real hotspot, you need software to intercept traffic and redirect users to your portal. `nodogsplash` is a great choice.

1.  **Install Nodogsplash**:
    ```bash
    sudo apt-get install nodogsplash
    ```
2.  **Configure Nodogsplash**:
    *   Edit the configuration file: `sudo nano /etc/nodogsplash/nodogsplash.conf`
    *   Find and change the following lines:
        ```conf
        # GatewayInterface: Set this to your USB Wi-Fi adapter's interface name (e.g., wlan0)
        # Run `ip a` to find the correct name.
        GatewayInterface wlan0

        # This tells nodogsplash to allow traffic to your backend API server
        # without authentication.
        FirewallRuleSet authenticated-users {
            FirewallRule allow tcp port 3001
        }
        ```
    *   Nodogsplash has its own web server for the portal page. We need to replace its content with our app. For simplicity, you can have it redirect to your Node server.
    *   Edit the splash page: `sudo nano /etc/nodogsplash/htdocs/splash.html`
    *   Replace the entire content of the file with a meta refresh tag that redirects to your portal, passing along client information:
        ```html
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="refresh" content="0; url=http://<ORANGE_PI_IP_ADDRESS>:3001/?mac=$mac&ip=$ip&gw_id=$gw_id" />
            <title>Connecting...</title>
        </head>
        <body>
            <p>Please wait, you are being redirected to the login page...</p>
        </body>
        </html>
        ```
3.  **Authentication Logic**: When a user activates a voucher, your backend must tell `nodogsplash` to grant them internet access. This is typically done via the `ndsctl` command.
    *   Your `/api/sessions/voucher` and `/api/sessions/coin` handlers should execute this command upon success:
        ```javascript
        const { exec } = require('child_process');

        // Inside your successful activation logic:
        const sessionDurationInMinutes = Math.ceil(session.duration / 60);
        const clientMacAddress = req.query.mac; // Get MAC from query params passed by splash.html

        if (clientMacAddress) {
            const command = `sudo ndsctl auth ${clientMacAddress} ${sessionDurationInMinutes}`;
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    console.error("Failed to authenticate client:", stderr);
                } else {
                    console.log(`Client ${clientMacAddress} authenticated for ${sessionDurationInMinutes} minutes.`);
                }
            });
        }
        ```
    *   **Permissions**: The user running your Node.js server needs passwordless `sudo` access to `ndsctl`. Edit sudoers with `sudo visudo` and add this line at the bottom:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 6: Running the Application

1.  **Set Gemini API Key**: The Wi-Fi name generator needs your API key.
    ```bash
    export API_KEY="your_gemini_api_key_here"
    ```
2.  **Start the Backend**:
    ```bash
    cd ~/sulit-wifi-backend
    node server.js
    ```
3.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```
4.  **Run on Boot (PM2)**: To ensure your server runs automatically after a reboot, use `pm2`.
    ```bash
    sudo npm install pm2 -g
    cd ~/sulit-wifi-backend
    
    # Start the server with PM2 and pass the API key
    API_KEY="your_gemini_api_key_here" pm2 start server.js --name "sulit-wifi"
    
    # Save the current process list to run on startup
    pm2 save
    pm2 startup
    ```
    Follow the instructions provided by `pm2 startup` to complete the setup.

You should now have a fully functional Wi-Fi hotspot portal running on your Orange Pi One!
