# SULIT WIFI Portal on Orange Pi One

This guide provides step-by-step instructions for deploying the SULIT WIFI hotspot portal on an Orange Pi One running Armbian. The project includes a Node.js backend, a React frontend, and integration with the Orange Pi's GPIO for a physical coin slot.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3.  [Step 1: Orange Pi One Setup](#step-1-orange-pi-one-setup)
4.  [Step 2: Backend & Frontend Setup](#step-2-backend--frontend-setup)
5.  [Step 3: GPIO Coin Slot Integration](#step-3-gpio-coin-slot-integration)
6.  [Step 4: Nginx & Captive Portal Configuration](#step-4-nginx--captive-portal-configuration)
7.  [Step 5: Running the Application](#step-5-running-the-application)
8.  [Step 6: Admin Panel WAN Access](#step-6-admin-panel-wan-access)
9.  [Troubleshooting](#troubleshooting)

---

## Project Overview

This application creates a captive portal for a Wi-Fi hotspot. It features a unique two-server architecture for enhanced security and manageability.

- **Portal Server (Port 3001)**: Handles all user-facing interactions for the local Wi-Fi network. This includes the voucher/coin login page, session management, and hardware integration. It is designed to be private and only accessible to clients connected to the hotspot.
- **Admin Server (Port 3002)**: A separate, dedicated server for the admin panel. This allows for secure remote management of the hotspot (dashboard, voucher generation, settings) over the WAN, without exposing the user portal to the internet.
- **Frontend**: A single React application that is compiled into a static JavaScript bundle for performance and reliability. It communicates with the appropriate backend server depending on whether it's rendering the user portal or the admin panel.

## Hardware & Software Prerequisites

### Hardware
*   Orange Pi One
*   A reliable 5V/2A power supply
*   A high-quality microSD Card (16GB or more recommended)
*   A USB Wi-Fi Adapter
*   A physical coin acceptor/slot mechanism
*   Jumper wires for connecting the coin slot

### Software
*   [Armbian](https://www.armbian.com/orange-pi-one/) (Debian-based version recommended)
*   An SSH client (like PuTTY)
*   [BalenaEtcher](https://www.balena.io/etcher/)

---

## Step 1: Orange Pi One Setup

1.  **Flash Armbian**: Download and flash the Armbian image onto your microSD card.
2.  **First Boot & Config**: Boot the Orange Pi, connect it via Ethernet, and SSH in (`ssh root@<ORANGE_PI_IP_ADDRESS>`). Change the default password (`1234`) and create a new user.
3.  **System Update**:
    ```bash
    sudo apt-get update && sudo apt-get upgrade -y
    ```
4.  **Install Build Tools**: Required for the `onoff` GPIO library.
    ```bash
    sudo apt-get install -y build-essential
    ```
5.  **Install Node.js & Git**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs git
    ```

---

## Step 2: Backend & Frontend Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Djnirds1984/SULIT-WIFI-by-AJC.git sulit-wifi-portal
    cd sulit-wifi-portal
    ```
2.  **Install Dependencies**: This installs all required Node.js packages, including the `esbuild` compiler for the frontend.
    ```bash
    npm install
    ```

---

## Step 3: GPIO Coin Slot Integration

1.  **Physical Connection**:
    *   Connect the coin acceptor's **GND** to a Ground pin on the Orange Pi.
    *   Connect its **VCC** wire to a 5V pin.
    *   Connect its **Signal** wire to **GPIO7**. If you use a different pin, update the `COIN_SLOT_GPIO_PIN` variable in `server.js`.

2.  **Permissions**: Add your user to the `gpio` group and reboot.
    ```bash
    sudo usermod -aG gpio <your-username>
    sudo reboot
    ```

---

## Step 4: Nginx & Captive Portal Configuration

We use Nginx as a reverse proxy for both servers and `nodogsplash` as the captive portal software. This setup isolates traffic: the portal is only visible on the local Wi-Fi network, while the admin panel is visible on the WAN.

### 1. Install Nginx and Nodogsplash
```bash
sudo apt-get install -y nginx nodogsplash
```

### 2. Configure Nginx
Nginx will route traffic based on the IP address it's accessed from.

*   **Create Nginx config file**: `sudo nano /etc/nginx/sites-available/sulit-wifi-portal`
*   **Paste the following configuration**, replacing `192.168.200.13` with your Pi's LAN IP address.
    ```nginx
    # Server block for the User Portal (Captive Portal)
    # Listens ONLY on the local network interface.
    server {
        listen 192.168.200.13:80; # IMPORTANT: Replace with your Pi's LAN IP
        server_name 192.168.200.13;

        location / {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Server block for the Admin Panel
    # Listens on all other interfaces (including WAN) as the default server.
    server {
        listen 80 default_server;
        listen [::]:80 default_server;

        location / {
            proxy_pass http://localhost:3002;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
*   **Enable the site**:
    ```bash
    sudo rm /etc/nginx/sites-enabled/default
    sudo ln -s /etc/nginx/sites-available/sulit-wifi-portal /etc/nginx/sites-enabled/
    ```
*   **Test and restart Nginx**: `sudo nginx -t` followed by `sudo systemctl restart nginx`.

### 3. Configure Nodogsplash
Redirect captive portal clients to the Nginx proxy on the LAN IP.

*   **Edit config**: `sudo nano /etc/nodogsplash/nodogsplash.conf`
    *   Set `GatewayInterface wlan0` (or your Wi-Fi adapter's name).
*   **Edit splash page for redirection**: `sudo nano /etc/nodogsplash/htdocs/splash.html`
    *   Replace the **entire file** with this, replacing `<ORANGE_PI_IP_ADDRESS>` with the Pi's LAN IP.
    ```html
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="0; url=http://<ORANGE_PI_IP_ADDRESS>/?mac=$mac&ip=$ip&gw_id=$gw_id" />
        <title>Connecting...</title>
    </head>
    <body>
        <p>Please wait, you are being redirected...</p>
    </body>
    </html>
    ```
*   **Enable passwordless `ndsctl` access**: The server needs to manage users.
    *   Run `sudo visudo`.
    *   Add this line at the bottom, replacing `<your-username>`:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 5: Running the Application

1.  **Set Gemini API Key (Optional)**: For the Wi-Fi name generator.
    ```bash
    export API_KEY="your_gemini_api_key_here"
    # Add this to ~/.bashrc or ~/.profile to make it permanent
    ```
2.  **Start the Backend with PM2**:
    *   Install PM2: `sudo npm install pm2 -g`
    *   **Start the server**:
        ```bash
        cd ~/sulit-wifi-portal
        # This command runs the `start` script from package.json, which builds the frontend then starts the server.
        pm2 start npm --name "sulit-wifi" -- start
        ```
    *   **Manage with PM2**:
        *   `pm2 list`: Show all running applications.
        *   `pm2 logs sulit-wifi`: View live logs.
        *   `pm2 stop sulit-wifi`: Stop the application.
        *   `pm2 delete sulit-wifi`: Remove the application from PM2's list.
    *   **Applying Changes**: If you modify any frontend (`.tsx`, `.ts`) or backend (`server.js`) files, you must restart the application to rebuild the code and apply the changes.
        ```bash
        pm2 restart sulit-wifi
        ```
    *   **Enable on boot**: `pm2 save` then `pm2 startup` (follow the on-screen command).

3.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```

---

## Step 6: Admin Panel WAN Access

The Admin Server is proxied by Nginx on port `80`. To access it from outside your local hotspot network (e.g., from your main home network or the internet), you need to allow HTTP traffic through the firewall.

1.  **Configure Firewall (UFW)**: If you use `ufw` (Uncomplicated Firewall) on Armbian:
    ```bash
    # Allow incoming HTTP traffic on port 80
    sudo ufw allow 80/tcp
    
    # Enable the firewall if it's not already running
    sudo ufw enable
    ```
    If you are behind another router, you may also need to set up port forwarding on that router to forward traffic from its WAN IP on port `80` to your Orange Pi's IP on port `80`.

2.  **Access the Admin Panel**: You can now access the admin panel using your Orange Pi's WAN-facing IP address without a port:
    `http://<YOUR_ORANGE_PI_WAN_IP>/admin`

---

## Troubleshooting

### Error: `listen EADDRINUSE: address already in use :::3001` or `:::3002`

This means another process is already using one of the required ports.

**How to Fix:**

1.  **Find the conflicting process**:
    ```bash
    # Check for port 3001
    sudo lsof -i :3001
    # Check for port 3002
    sudo lsof -i :3002
    ```
    Note the Process ID (PID) from the output.

2.  **Stop the process**:
    ```bash
    # Replace <PID> with the number you found
    sudo kill -9 <PID>
    ```

3.  **Restart with PM2**:
    ```bash
    cd ~/sulit-wifi-portal
    pm2 restart sulit-wifi
    ```