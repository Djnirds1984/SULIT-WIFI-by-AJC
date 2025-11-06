# SULIT WIFI Portal on Orange Pi & Raspberry Pi

This guide provides step-by-step instructions for deploying the SULIT WIFI hotspot portal on ARM-based Single Board Computers (SBCs) like the Orange Pi One or Raspberry Pi 3B+/4, running a Debian-based OS like Armbian or Raspberry Pi OS.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3.  [Step 1: SBC Setup (Armbian / Raspberry Pi OS)](#step-1-sbc-setup-armbian--raspberry-pi-os)
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
*   Orange Pi One, Raspberry Pi 3B+, 4, or newer
*   A reliable 5V/2A (or 3A for Raspberry Pi) power supply
*   A high-quality microSD Card (16GB or more recommended)
*   A USB Wi-Fi Adapter
*   A physical coin acceptor/slot mechanism
*   Jumper wires for connecting the coin slot

### Software
*   [Armbian](https://www.armbian.com/orange-pi-one/) (for Orange Pi) or [Raspberry Pi OS](https://www.raspberrypi.com/software/) (for Raspberry Pi)
*   An SSH client (like PuTTY)
*   [BalenaEtcher](https://www.balena.io/etcher/)

---

## Step 1: SBC Setup (Armbian / Raspberry Pi OS)

1.  **Flash OS**: Download and flash the appropriate OS image onto your microSD card.
2.  **First Boot & Config**: Boot the SBC, connect it via Ethernet, and SSH in. For Raspberry Pi OS, the default user is `pi`. For Armbian, you will set up a user on first boot.
3.  **System Update**:
    ```bash
    sudo apt-get update && sudo apt-get upgrade -y
    ```
4.  **Install Build Tools**: **(CRITICAL)** This is required for multiple components, including the coin slot and Nodogsplash.
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
2.  **Configure Environment Variables**:
    *   The project uses a `.env` file to store sensitive information like your database password. A template file named `.env.example` is included to make setup easy.
    *   **First, copy the template file**:
        ```bash
        cp .env.example .env
        ```
    *   **Next, edit the new `.env` file**:
        ```bash
        nano .env
        ```
    *   Inside the editor, replace `your_secure_password_here` with the actual password you created for the `sulituser` in Step 2.
    *   **(Optional)** If you want to use the AI Wi-Fi name generator, uncomment the `API_KEY` line and add your Google Gemini API key.
    *   Press `CTRL+X`, then `Y`, then `Enter` to save and exit.

3.  **Install Dependencies**:
    ```bash
    npm install
    ```
    > **Note:** You may see errors related to `epoll` or `onoff` during this step. This is expected if you haven't installed `build-essential` yet. The installation will still complete successfully, but the coin slot feature will be disabled. See Step 4 for details.

---

## Step 4: GPIO Coin Slot Integration

### 4.1. IMPORTANT: About `onoff` Installation Errors

The `onoff` package is used for the physical coin slot. It is an **optional dependency**.
-   If `npm install` shows errors related to `epoll` or `onoff`, it means the native module failed to compile.
-   **The server will still run perfectly fine**, but the coin slot feature will be disabled.
-   To fix this, ensure you have installed the build tools from Step 1: `sudo apt-get install -y build-essential`. Then, run `npm install` again.

### 4.2. Physical Connection

*   Connect the coin acceptor's **GND** to a Ground pin on your SBC.
*   Connect its **VCC** wire to a 5V pin.
*   Connect its **Signal** wire to **GPIO7**.
    *   **Note**: The `onoff` library uses **BCM pin numbering**. On a Raspberry Pi, GPIO7 is physical pin 26 on the header.
    *   If you use a different pin, update the `COIN_SLOT_GPIO_PIN` variable in `server.js`.

### 4.3. Permissions

The user running the application needs permission to access the GPIO hardware.

1.  **Create the `gpio` Group**: On some systems, the `gpio` group may not exist by default. Run the following command to create it if it's missing.
    ```bash
    sudo groupadd --force gpio
    ```
    > The `--force` flag prevents an error if the group already exists.

2.  **Add User to Group**: Add your user to the group. Replace `<your-username>` with your actual username (e.g., `pi`).
    ```bash
    sudo usermod -aG gpio <your-username>
    ```

3.  **Reboot**: A reboot is required for the group changes to take full effect.
    ```bash
    sudo reboot
    ```

---

## Step 5: Nginx & Captive Portal Configuration

We use Nginx as a reverse proxy and `nodogsplash` as the captive portal software.

### 1. Install Networking Services
Install all the required networking tools. `hostapd` creates the Wi-Fi access point, `dnsmasq` provides DHCP and DNS services to users, `nginx` serves the web portal, and `ifupdown` helps manage network interfaces.
```bash
sudo apt-get install -y nginx ifupdown hostapd dnsmasq
```

### 2. Install Nodogsplash (Compile from Source)

The `nodogsplash` package is often not available in default OS repositories. The most reliable way to install it is by compiling it from source.

1.  **Install Build Dependencies**:
    Nodogsplash requires a few development libraries to be compiled from source. This command installs the C++ compiler (`build-essential`), a web server library (`libmicrohttpd-dev`), and a JSON parsing library (`libjson-c-dev`).
    ```bash
    sudo apt-get update
    sudo apt-get install -y build-essential libmicrohttpd-dev libjson-c-dev
    ```

2.  **Clone the Official Repository**:
    ```bash
    # IMPORTANT: Run this from your home directory (~), NOT from the sulit-wifi-portal directory.
    cd ~ 
    git clone https://github.com/nodogsplash/nodogsplash.git
    ```

3.  **Compile and Install**:
    ```bash
    cd nodogsplash
    make
    sudo make install
    ```

4.  **Return to the Portal Directory**:
    ```bash
    cd ~/sulit-wifi-portal
    ```

### 3. Configure Nginx (Robust Setup)
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
        # Example for user 'ajc': root /home/ajc/sulit-wifi-portal/public;
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

### 4. Configure Nodogsplash
Redirect captive portal clients to the portal's static IP address (which you will set in the admin panel).

*   **Edit config**: `sudo nano /etc/nodogsplash/nodogsplash.conf`
    *   Set `GatewayInterface wlan0` (or your Wi-Fi adapter's name).
*   **Enable passwordless `ndsctl` access**: The server needs to manage users.
    *   Run `sudo visudo`.
    *   Add this line at the bottom, replacing `<your-username>`:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 6: Running the Application

1.  **Start the Server with PM2**:
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

2.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```

---

## Step 7: Admin Panel WAN Access

With the Nginx configuration, the admin panel is accessible on port `80` from any network connected to the SBC.

1.  **Configure Firewall (UFW)**: If you use `ufw` (Uncomplicated Firewall):
    ```bash
    sudo ufw allow 80/tcp
    sudo ufw enable
    ```
    If you are behind another router, you may also need to set up port forwarding on that router to forward traffic from its WAN IP on port `80` to your SBC's IP on port `80`.

2.  **Access the Admin Panel**:
    `http://<YOUR_SBC_IP>/admin`

---

## Troubleshooting

### Error: `FATAL: The PGPASSWORD environment variable is not set.`
This is the most common setup error.
*   **Cause**: The application started but could not find the database password. This means the `.env` file is either missing, named incorrectly, or does not contain the `PGPASSWORD` line.
*   **Solution**:
    1.  Navigate to your project directory: `cd ~/sulit-wifi-portal`
    2.  Ensure the file `.env` exists. You can check with `ls -a`.
    3.  If it doesn't exist, create it by copying the template: `cp .env.example .env`.
    4.  Open the file for editing: `nano .env`.
    5.  Make sure the line `PGPASSWORD=your_secure_password_here` is present and that you have replaced the placeholder with your actual password.
    6.  Restart the application: `pm2 restart sulit-wifi`.

### Error: `password authentication failed for user "sulituser"` or `Authentication failed`
This critical error means the password in your `.env` file does not match the password in the PostgreSQL database for the `sulituser`.

*   **Cause**: A typo in the `.env` file or you've forgotten the password you set during Step 2.
*   **Solution**: Reset the password in the database.
    1.  Open the PostgreSQL administrative shell:
        ```bash
        sudo -u postgres psql
        ```
    2.  Inside the `psql` shell, run the following command to set a new password. **Replace `new_secure_password` with your desired password**:
        ```sql
        ALTER USER sulituser WITH PASSWORD 'new_secure_password';
        ```
    3.  Exit the `psql` shell by typing `\q` and pressing Enter.
    4.  Update your `.env` file with the `new_secure_password`.
    5.  Restart the application to apply the changes: `pm2 restart sulit-wifi`.

### Error: `Failed to initialize GPIO pin ... EINVAL: invalid argument`
This error occurs when the server starts, especially on Raspberry Pi.
*   **Cause**: On recent versions of Raspberry Pi OS, the legacy `/sys/class/gpio` interface, which is required by the `onoff` library, is disabled by default. The operating system rejects the attempt to use the pin.
*   **Solution**: You need to re-enable this interface.
    1.  Edit the boot configuration file:
        ```bash
        sudo nano /boot/config.txt
        ```
    2.  Add the following line at the very bottom of the file:
        ```
        dtoverlay=gpio-sysfs
        ```
    3.  Press `CTRL+X`, then `Y`, then `Enter` to save and exit.
    4.  Reboot your Raspberry Pi for the change to take effect:
        ```bash
        sudo reboot
        ```
    5.  The server should now start without the GPIO error.

### Error: `npm ERR! epoll@... install: node-gyp rebuild`
This error occurs when installing the optional `onoff` dependency for the coin slot.
*   **Cause**: Your system is missing the necessary C++ compiler and build tools.
*   **Solution**: Install the `build-essential` package: `sudo apt-get install -y build-essential`, then run `npm install` again.
*   **Alternative**: You can ignore this error. The application will run correctly, but the physical coin slot feature will be disabled.

### Error: `listen EADDRINUSE: address already in use :::3001`
Another process is using port 3001. Find it with `sudo lsof -i :3001`, note the PID, and stop it with `sudo kill -9 <PID>`. Then restart the app.

### Error: `error: permission denied for schema public`
The `sulituser` does not have ownership of the database. Fix this in `psql` with: `ALTER DATABASE sulitwifi OWNER TO sulituser;` then restart the app.

### Portal shows "502 Bad Gateway"
This means Nginx is running but the backend Node.js server is not. Check the application logs (`pm2 logs sulit-wifi`) for startup errors, which are most often caused by incorrect database credentials in the `.env` file.

### Portal shows a blank page or 404 Not Found
This means your Nginx configuration is incorrect. Double-check that the `root` path in `/etc/nginx/sites-available/sulit-wifi-portal` is the correct **absolute path** to your project's `public` folder. After fixing it, run `sudo nginx -t` and `sudo systemctl restart nginx`.