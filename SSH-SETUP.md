# SSH Remote Setup Guide

This document contains the SSH configuration needed to connect to the Raspberry Pi servers from any system.

---

## SSH Hosts

| Host        | IP Address   | User | SSH Key File            | Port         |
| ----------- | ------------ | ---- | ----------------------- | ------------ |
| `sunny-pi`  | 192.168.1.19 | pi   | `~/.ssh/sunny-stack-pi` | 22 (default) |
| `rinoa-pi5` | 192.168.1.50 | pi   | `~/.ssh/rinoa-pi5`      | 22           |

---

## SSH Config

Add the following to `~/.ssh/config` on the new system:

```
# sunny-pi config
Host sunny-pi
    HostName 192.168.1.19
    User pi
    IdentityFile ~/.ssh/sunny-stack-pi
    IdentitiesOnly yes

# rinoa-pi5 config
Host rinoa-pi5
    HostName 192.168.1.50
    User pi
    IdentityFile ~/.ssh/rinoa-pi5
    port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

---

## Required Files

Copy these files from the original system to the new system's `~/.ssh/` directory:

### Private Keys (Required)

- `~/.ssh/sunny-stack-pi`
- `~/.ssh/rinoa-pi5`

### Public Keys (Optional, for reference)

- `~/.ssh/sunny-stack-pi.pub`
- `~/.ssh/rinoa-pi5.pub`

---

## Setup Steps on New System

1. **Create SSH directory** (if it doesn't exist):

   ```bash
   mkdir -p ~/.ssh
   ```

2. **Copy private key files** to `~/.ssh/`

3. **Add config entries** to `~/.ssh/config` (create if it doesn't exist)

4. **Set correct permissions**:

   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/sunny-stack-pi
   chmod 600 ~/.ssh/rinoa-pi5
   chmod 644 ~/.ssh/config
   ```

5. **Test connections**:
   ```bash
   ssh sunny-pi
   ssh rinoa-pi5
   ```

---

## Notes

- Both keys are **passphrase-protected** - you'll need the passphrase when connecting
- The Pis must be on the same network (192.168.1.x) or accessible via the configured IPs
- Public keys are already installed on the Pis in `/home/pi/.ssh/authorized_keys`
