/**
 * SafeVault Local Wi-Fi Synchronization Server
 * Native Node.js HTTP Server - Zero External Dependencies
 */

const http = require('http');
const os = require('os');
const crypto = require('crypto');

// Native Node.js crypto helpers for E2EE Sync using the pairing PIN
function derivePINKey(pin) {
  return crypto.pbkdf2Sync(pin, 'safevault-sync-salt', 10000, 32, 'sha256');
}

function encryptPayload(text, pin) {
  const key = derivePINKey(pin);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    tag: authTag
  };
}

function decryptPayload(payload, pin) {
  const key = derivePINKey(pin);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

let server = null;
let activePIN = null;
let activeVaultData = null; // Stored local vault database state
let failedAttempts = {}; // Track failed attempts per IP to prevent brute force

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function startSyncServer(vaultData, callback) {
  if (server) {
    stopSyncServer();
  }

  activeVaultData = vaultData;
  activePIN = generatePIN();
  const port = 58241;

  server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-PIN');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/sync') {
      const clientIp = req.socket.remoteAddress || 'unknown';

      // Check if IP is already blocked
      if (failedAttempts[clientIp] && failedAttempts[clientIp] >= 3) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Too many failed pairing attempts. Access Denied.' }));
        return;
      }

      const clientPIN = req.headers['x-sync-pin'];
      if (!clientPIN || clientPIN !== activePIN) {
        failedAttempts[clientIp] = (failedAttempts[clientIp] || 0) + 1;
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid pairing code' }));
        return;
      }

      // Reset on successful pairing authentication
      failedAttempts[clientIp] = 0;

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          const encryptedPayload = JSON.parse(body);
          
          // Decrypt client vault using activePIN
          const decryptedJson = decryptPayload(encryptedPayload, activePIN);
          const decryptedVault = JSON.parse(decryptedJson);
          
          // Securely callback to main process to merge and return updated data
          if (callback && typeof callback === 'function') {
            callback(decryptedVault, (err, mergedVault) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Sync failed on server merge' }));
                return;
              }
              // Update local state
              activeVaultData = mergedVault;
              
              // Encrypt merged data before sending
              const encryptedResponse = encryptPayload(JSON.stringify(mergedVault), activePIN);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, encrypted: encryptedResponse }));
            });
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Main process merge callback missing' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request: Invalid E2EE Payload or PIN' }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Sync server listening on port ${port}`);
  });

  return {
    ips: getLocalIPs(),
    port,
    pin: activePIN
  };
}

function stopSyncServer() {
  if (server) {
    server.close();
    server = null;
  }
  activePIN = null;
  activeVaultData = null;
  failedAttempts = {};
  return true;
}

module.exports = {
  startSyncServer,
  stopSyncServer,
  getLocalIPs
};
