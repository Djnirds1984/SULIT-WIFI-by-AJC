#!/bin/bash

# Script to disable I2C for GPIO pin 2 usage
# Run this on your SBC (Raspberry Pi/Orange Pi)

echo "=== GPIO Pin 2 I2C Disable Script ==="
echo "This script will disable I2C to free up GPIO pin 2 for coin slot usage."
echo ""

# Detect SBC type
if [ -f /proc/device-tree/model ]; then
    MODEL=$(cat /proc/device-tree/model)
    echo "Detected: $MODEL"
fi

# Raspberry Pi
if [[ "$MODEL" == *"Raspberry Pi"* ]]; then
    echo "Detected Raspberry Pi"
    
    # Check current I2C status
    if [ -f /dev/i2c-1 ]; then
        echo "I2C is currently enabled"
        
        # Backup config.txt
        sudo cp /boot/config.txt /boot/config.txt.backup
        echo "Backed up /boot/config.txt to /boot/config.txt.backup"
        
        # Disable I2C in config.txt
        sudo sed -i 's/^dtparam=i2c_arm=on/#dtparam=i2c_arm=on/' /boot/config.txt
        sudo sed -i 's/^dtoverlay=i2c-gpio/#dtoverlay=i2c-gpio/' /boot/config.txt
        
        echo "I2C disabled in /boot/config.txt"
        echo ""
        echo "You need to reboot for changes to take effect:"
        echo "sudo reboot"
        
    else
        echo "I2C appears to be disabled already"
    fi

# Orange Pi/Armbian
elif [[ "$MODEL" == *"Allwinner"* ]] || [[ "$MODEL" == *"Orange Pi"* ]]; then
    echo "Detected Orange Pi/Allwinner board"
    
    # Check armbian configuration
    if [ -f /boot/armbianEnv.txt ]; then
        echo "Found /boot/armbianEnv.txt"
        
        # Backup
        sudo cp /boot/armbianEnv.txt /boot/armbianEnv.txt.backup
        echo "Backed up /boot/armbianEnv.txt"
        
        # Disable I2C overlays
        sudo sed -i 's/overlays=i2c[0-9]* //g' /boot/armbianEnv.txt
        sudo sed -i 's/ i2c[0-9]*//g' /boot/armbianEnv.txt
        
        echo "I2C overlays disabled in /boot/armbianEnv.txt"
        echo ""
        echo "You need to reboot for changes to take effect:"
        echo "sudo reboot"
    fi
else
    echo "Unknown SBC type. Please manually disable I2C in your system configuration."
fi

echo ""
echo "After reboot, GPIO pin 2 should be available for coin slot usage."
echo "You can verify by running: pinout or gpio readall"