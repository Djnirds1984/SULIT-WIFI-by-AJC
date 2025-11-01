# SULIT WIFI Portal on Orange Pi One

This guide provides step-by-step instructions for deploying the SULIT WIFI hotspot portal on an Orange Pi One running Armbian. The project includes a Node.js backend, a React frontend, and integration with the Orange Pi's GPIO for a physical coin slot.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3.  [Step 1: Orange Pi One Setup](#step-1-orange-pi-one-setup)
4.  [Step 2: Backend & Frontend Setup](#step-2-backend--frontend-setup)
5.  [Step 3: GPIO Coin Slot Integration](#step-3-gpio-coin-slot-integration)
6.  [Step 4: Captive Portal Configuration](#step-4-captive-portal-configuration)
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

## Step 4: Captive Portal Configuration

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
        # (running on port 3001) without requiring authentication. This is crucial.
        FirewallRuleSet authenticated-users {
            FirewallRule allow tcp port 3001
        }
        FirewallRuleSet preauthenticated-users {
            FirewallRule allow tcp port 3001
        }
        ```
    *   Nodogsplash has its own web server for the portal page. We need to replace its content to redirect to our Node server.
    *   Edit the splash page: `sudo nano /etc/nodogsplash/htdocs/splash.html`
    *   Replace the entire content of the file with a meta refresh tag. This redirect passes along crucial client information (`$mac`, `$ip`) that our server needs.
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
3.  **Authentication Logic**: The `server.js` file already contains the logic to execute `ndsctl` commands. You just need to give the server permission to do so.
    *   **Permissions**: The user running your Node.js server needs passwordless `sudo` access to `ndsctl`. Edit sudoers with `sudo visudo` and add this line at the bottom, replacing `<your-username>` with your actual username:
        `<your-username> ALL=(ALL) NOPASSWD: /usr/bin/ndsctl`

---

## Step 5: Running the Application

1.  **Set Gemini API Key (Optional)**: If you want to use the Wi-Fi name generator in the admin panel, you must set your API key as an environment variable.
    ```bash
    export API_KEY="your_gemini_api_key_here"
    ```
2.  **Start the Backend**:
    ```bash
    # Navigate to your project directory
    cd ~/sulit-wifi-portal
    node server.js
    ```
3.  **Start Nodogsplash**:
    ```bash
    sudo nodogsplash
    ```
4.  **Run on Boot (PM2)**: To ensure your server runs automatically and stays running after a reboot, use `pm2`.
    ```bash
    sudo npm install pm2 -g
    cd ~/sulit-wifi-portal
    
    # Start the server with PM2. If using the Gemini feature,
    # make sure you've run 'export API_KEY' or include it here.
    API_KEY="your_gemini_api_key_here" pm2 start server.js --name "sulit-wifi"
    
    # Save the current process list to run on startup
    pm2 save
    
    # Generate and run the startup script
    pm2 startup
    ```
    Follow the single command instruction provided by `pm2 startup` to complete the setup.

You should now have a fully functional Wi-Fi hotspot portal running on your Orange Pi One!