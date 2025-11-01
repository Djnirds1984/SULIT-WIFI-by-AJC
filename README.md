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

---

## Project Overview

This application creates a captive portal for a Wi-Fi hotspot.
- **Frontend**: A user-friendly portal built with React where users can log in with vouchers or a coin insert. It also includes an admin panel for managing the hotspot.
- **Backend**: A Node.js (`server.js`) server that handles session management, voucher validation, admin authentication, and GPIO events.
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
4.  **Install Build Tools**: The GPIO library (`onoff`) needs to be compiled on the Orange Pi. Install the necessary build tools:
    ```bash
    sudo apt-get install -y build-essential
    ```
5.  **Install Node.js & Git**: We'll use NodeSource to get a modern version of Node.js and install Git to clone the repository.
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs git
    ```
    Verify the installation:
    ```bash
    node -v  # Should show v18.x.x or higher
    npm -v
    git --version
    ```

---

## Step 2: Backend & Frontend Setup

The GitHub repository contains all the necessary backend files (`server.js`, `package.json`) and the pre-built frontend files in the `public` directory.

1.  **Clone the Repository**: On your Orange Pi, clone the project from GitHub. This will create a `sulit-wifi-portal` directory with all the required files.
    ```bash
    git clone https://github.com/Djnirds1984/SULIT-WIFI-by-AJC.git sulit-wifi-portal
    cd sulit-wifi-portal
    ```
    
2.  **Install Backend Dependencies**: The `package.json` file lists all the necessary Node.js packages for the server. Install them using npm.
    ```bash
    # Make sure you are in the ~/sulit-wifi-portal directory
    npm install
    ```
    This will read `package.json` and install libraries like Express, onoff, and cors into a `node_modules` folder. The frontend is already built and located in the `public` folder, so no further action is needed for it.

---

## Step 3: GPIO Coin Slot Integration

1.  **Identify GPIO Pin**: The Orange Pi One has a 40-pin header. You need to choose a GPIO pin to connect your coin acceptor's signal wire to. The `server.js` is pre-configured for **GPIO7**. Refer to an Orange Pi One pinout diagram if you need to use a different pin and update the `COIN_SLOT_GPIO_PIN` variable in `server.js`.

2.  **Physical Connection**:
    *   Connect the coin acceptor's **GND** wire to a Ground pin on the Orange Pi.
    *   Connect the coin acceptor's **VCC** wire to a 5V pin on the Orange Pi.
    *   Connect the coin acceptor's **Signal** wire to your chosen GPIO pin (e.g., GPIO7).

3.  **Permissions**: For the Node.js server to access GPIO, add your user to the `gpio` group.
    ```bash
    sudo usermod -aG gpio <your-username>
    ```
    You will need to log out and log back in for this change to take effect.

---

## Step 4: Nginx & Captive Portal Configuration

To make the portal accessible without the `:3001` port and to intercept traffic, we will use Nginx as a reverse proxy and `nodogsplash` as the captive portal software.

### 1. Install Nginx and Nodogsplash
```bash
sudo apt-get install -y nginx nodogsplash
```

### 2. Configure Nginx as a Reverse Proxy
Nginx will listen on the standard HTTP port (80) and forward requests to our Node.js application running on port 3001.

*   **Create an Nginx configuration file**:
    ```bash
    sudo nano /etc/nginx/sites-available/sulit-wifi-portal
    ```
*   **Paste the following configuration** into the file. Replace `192.168.200.13` with your Orange Pi's actual IP address.
    ```nginx
    server {
        listen 80;
        listen [::]:80;

        server_name 192.168.200.13; # Replace with your Pi's IP address

        location / {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
*   **Enable the new site**:
    ```bash
    # First, remove the default config to avoid conflicts
    sudo rm /etc/nginx/sites-enabled/default
    
    # Then, create a symbolic link to enable our new config
    sudo ln -s /etc/nginx/sites-available/sulit-wifi-portal /etc/nginx/sites-enabled/
    ```
*   **Test and restart Nginx**:
    ```bash
    sudo nginx -t  # Should report syntax is ok
    sudo systemctl restart nginx
    ```

### 3. Configure Nodogsplash
Now we configure `nodogsplash` to redirect users to our portal, which is now served by Nginx on port 80.

*   **Edit the main configuration file**:
    ```bash
    sudo nano /etc/nodogsplash/nodogsplash.conf
    ```
*   Find and change the following lines. Note that we no longer need firewall rules for port 3001, as all traffic now goes through Nginx on port 80, which `nodogsplash` handles.
    ```conf
    # GatewayInterface: Set this to your USB Wi-Fi adapter's interface name (e.g., wlan0)
    # Run `ip a` to find the correct name.
    GatewayInterface wlan0
    ```
*   **Edit the splash page for redirection**:
    ```bash
    sudo nano /etc/nodogsplash/htdocs/splash.html
    ```
*   Replace the **entire content** of the file with a meta refresh tag. This redirect passes along crucial client information (`$mac`, `$ip`) to our server. **Note the absence of `:3001` in the URL.**
    ```html
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="0; url=http://<ORANGE_PI_IP_ADDRESS>/?mac=$mac&ip=$ip&gw_id=$gw_id" />
        <title>Connecting...</title>
    </head>
    <body>
        <p>Please wait, you are being redirected to the login page...</p>
    </body>
    </html>
    ```
*   **Enable passwordless `ndsctl` access**: The `server.js` file executes `ndsctl` commands to manage users. Give the server permission to do so without a password.
    *   Run `sudo visudo`.
    *   Add this line at the very bottom, replacing `<your-username>` with your actual username:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 5: Running the Application

1.  **Set Gemini API Key (Optional)**: If you want to use the Wi-Fi name generator, set your API key as an environment variable.
    ```bash
    export API_KEY="your_gemini_api_key_here"
    ```
    **Note**: To make this variable permanent across reboots, add the line above to your user's shell profile file, such as `~/.bashrc` or `~/.profile`, and then run `source ~/.bashrc` or log out and log back in.

2.  **Start the Backend with PM2**: `pm2` is a process manager that will keep your server running and restart it automatically.
    *   **Install PM2**:
        ```bash
        sudo npm install pm2 -g
        ```
    *   **Start the server**:
        ```bash
        # First, navigate to your project directory
        cd ~/sulit-wifi-portal
        
        # CRITICAL: Run the start command from *inside* the project directory.
        # This is required to prevent "ENOENT: no such file or directory" errors,
        # as the server needs to know where to find the 'public' folder.
        pm2 start server.js --name "sulit-wifi"
        ```
    *   **Enable startup on boot**:
        ```bash
        # Save the current process list to run on startup
        pm2 save
        
        # Generate and run the startup script
        pm2 startup
        ```
        Follow the single command instruction provided by `pm2 startup` to complete the setup.

3.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```

You should now have a fully functional Wi-Fi hotspot portal running on your Orange Pi One, accessible at `http://<YOUR_ORANGE_PI_IP>`.