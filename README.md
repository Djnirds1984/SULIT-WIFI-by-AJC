# SULIT WIFI Portal on Orange Pi One

This guide provides step-by-step instructions for deploying the SULIT WIFI hotspot portal on an Orange Pi One running Armbian. The project includes a Node.js backend, a React frontend, and integration with the Orange Pi's GPIO for a physical coin slot.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3.  [Step 1: Orange Pi One Setup](#step-1-orange-pi-one-setup)
4.  [Step 2: PostgreSQL Database Setup](#step-2-postgresql-database-setup)
5.  [Step 3: Backend & Frontend Setup](#step-3-backend--frontend-setup)
6.  [Step 4: GPIO Coin Slot Integration](#step-4-gpio-coin-slot-integration)
7.  [Step 5: Nginx & Captive Portal Configuration](#step-5-nginx--captive-portal-configuration)
8.  [Step 6: Running the Application](#step-6-running-the-application)
9.  [Step 7: Admin Panel WAN Access](#step-7-admin-panel-wan-access)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

This application creates a captive portal for a Wi-Fi hotspot, running on a single, efficient Node.js server.

- **API Server (Port 3001)**: A robust Express.js application serves as a dedicated API backend. It handles all user authentication (voucher/coin), secure admin panel endpoints (dashboard, settings), and hardware integration.
- **Frontend**: A modern React application compiled into a static JavaScript bundle. It is served directly by Nginx for maximum performance and reliability.
- **Database**: A persistent PostgreSQL database stores all vouchers, sessions, and system settings, ensuring data is safe across reboots.

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

## Step 2: PostgreSQL Database Setup

The application requires a PostgreSQL database to store all persistent data.

1.  **Install PostgreSQL**:
    ```bash
    sudo apt-get install -y postgresql postgresql-contrib
    ```

2.  **Create Database and User**:
    *   Switch to the `postgres` user to access the database administrative shell:
        ```bash
        sudo -u postgres psql
        ```
    *   Inside the `psql` shell, run the following SQL commands one by one:
        ```sql
        -- Create a new database named 'sulitwifi'
        CREATE DATABASE sulitwifi;

        -- Create a new user with a secure password (replace 'your_secure_password'!)
        CREATE USER sulituser WITH PASSWORD 'your_secure_password';
        
        -- Make the new user the owner of the database for full permissions
        ALTER DATABASE sulitwifi OWNER TO sulituser;

        -- Exit the psql shell
        \q
        ```
    *   By making `sulituser` the owner, you grant all necessary privileges, including schema permissions, in a single step.

---

## Step 3: Backend & Frontend Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Djnirds1984/SULIT-WIFI-by-AJC.git sulit-wifi-portal
    cd sulit-wifi-portal
    ```
2.  **Configure Database Connection**:
    *   Create a `.env` file in the project root to store your database credentials.
        ```bash
        nano .env
        ```
    *   Add the following lines, replacing `your_secure_password` with the one you created.
        ```
        # PostgreSQL Connection Details
        PGHOST=localhost
        PGUSER=sulituser
        PGPASSWORD=your_secure_password
        PGDATABASE=sulitwifi
        PGPORT=5432
        ```
    *   Press `CTRL+X`, then `Y`, then `Enter` to save and exit.

3.  **Install Dependencies**:
    ```bash
    npm install
    ```

---

## Step 4: GPIO Coin Slot Integration

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

## Step 5: Nginx & Captive Portal Configuration

We use Nginx as a reverse proxy and `nodogsplash` as the captive portal software.

### 1. Install Nginx, Nodogsplash, and Network Tools
```bash
sudo apt-get install -y nginx nodogsplash ifupdown
```

### 2. Configure Nginx (Robust Setup)
This setup is designed for maximum reliability. Nginx, a high-performance web server, will directly serve your portal's user interface. The Node.js application will run as a dedicated API server.

**Why this is important:** If the Node.js server has a problem (e.g., a database connection issue) and fails to start, users will **still see the portal's login page** instead of a "502 Bad Gateway" error. The portal will then show a specific "cannot connect" message, which is a much better user experience and easier to troubleshoot.

*   **Create Nginx config file**: `sudo nano /etc/nginx/sites-available/sulit-wifi-portal`
*   **Paste the following configuration**:

    ```nginx
    server {
        listen 80 default_server;
        listen [::]:80 default_server;

        # --- ⬇️ CRITICAL: UPDATE THIS PATH ⬇️ ---
        # Replace with the ABSOLUTE path to your project's 'public' directory.
        # Example for user 'pi': root /home/pi/sulit-wifi-portal/public;
        # Example for user 'admin': root /home/admin/sulit-wifi-portal/public;
        root /home/YOUR_USERNAME/sulit-wifi-portal/public;
        # --- ⬆️ CRITICAL: UPDATE THIS PATH ⬆️ ---

        index index.html;

        # All requests starting with /api/ are proxied to the Node.js backend server
        location /api/ {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # All other requests are for the frontend Single Page App (SPA).
        # This serves the main index.html file, allowing the React app to handle all routes like /admin.
        location / {
            try_files $uri $uri/ /index.html;
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
Redirect captive portal clients to the portal's static IP address (which you will set in the admin panel).

*   **Edit config**: `sudo nano /etc/nodogsplash/nodogsplash.conf`
    *   Set `GatewayInterface wlan0` (or your Wi-Fi adapter's name).
*   **Enable passwordless `ndsctl` access**: The server needs to manage users.
    *   Run `sudo visudo`.
    *   Add this line at the bottom, replacing `<your-username>`:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 6: Running the Application

1.  **Set Gemini API Key (Optional)**: For the Wi-Fi name generator.
    *   Edit your `.env` file (`nano .env`) and add this line:
        ```
        API_KEY="your_gemini_api_key_here"
        ```
2.  **Start the Server with PM2**:
    *   Install PM2: `sudo npm install pm2 -g`
    *   **Start the server**:
        ```bash
        cd ~/sulit-wifi-portal
        # This command builds the frontend then starts the API server.
        pm2 start npm --name "sulit-wifi" -- start
        ```
    *   **Manage with PM2**:
        *   `pm2 list`: Show running apps.
        *   `pm2 logs sulit-wifi`: View live logs.
        *   `pm2 restart sulit-wifi`: Restart after making code changes.
    *   **Enable on boot**: `pm2 save` then `pm2 startup` (follow the on-screen command).

3.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```

---

## Step 7: Admin Panel WAN Access

With the Nginx configuration, the admin panel is accessible on port `80` from any network connected to the Orange Pi.

1.  **Configure Firewall (UFW)**: If you use `ufw` (Uncomplicated Firewall) on Armbian:
    ```bash
    sudo ufw allow 80/tcp
    sudo ufw enable
    ```
    If you are behind another router, you may also need to set up port forwarding on that router to forward traffic from its WAN IP on port `80` to your Orange Pi's IP on port `80`.

2.  **Access the Admin Panel**:
    `http://<YOUR_ORANGE_PI_IP>/admin`

---

## Troubleshooting

### Error: `listen EADDRINUSE: address already in use :::3001`
Another process is using port 3001. Find it with `sudo lsof -i :3001`, note the PID, and stop it with `sudo kill -9 <PID>`. Then restart the app.

### Error: `error: password authentication failed for user "sulituser"`
The password in your `.env` file is incorrect. Double-check it. If forgotten, reset it in `psql`: `ALTER USER sulituser WITH PASSWORD 'new_password';`

### Error: `error: permission denied for schema public`
The `sulituser` does not have ownership of the database. Fix this in `psql` with: `ALTER DATABASE sulitwifi OWNER TO sulituser;` then restart the app.

### Portal shows "502 Bad Gateway"
This means Nginx is running but the backend Node.js server is not. Check the application logs (`pm2 logs sulit-wifi`) for startup errors, which are most often caused by incorrect database credentials in the `.env` file.

### Portal shows a blank page or 404 Not Found
This means your Nginx configuration is incorrect. Double-check that the `root` path in `/etc/nginx/sites-available/sulit-wifi-portal` is the correct **absolute path** to your project's `public` folder. After fixing it, run `sudo nginx -t` and `sudo systemctl restart nginx`.