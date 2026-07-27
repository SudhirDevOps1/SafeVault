/**
 * SafeVault Local Wi-Fi Synchronization Server
 * Native Node.js HTTP Server - Zero External Dependencies
 */

const http = require('http');
const os = require('os');
const crypto = require('crypto');

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Hash, X-Sync-Timestamp');

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

      const clientHash = req.headers['x-sync-hash'];
      const clientTimestampStr = req.headers['x-sync-timestamp'];

      if (!clientHash || !clientTimestampStr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request: Missing authentication headers' }));
        return;
      }

      const clientTimestamp = parseInt(clientTimestampStr, 10);
      const currentTime = Date.now();

      // Prevent replay attacks (allow maximum 5 minutes clock drift)
      if (isNaN(clientTimestamp) || Math.abs(currentTime - clientTimestamp) > 300000) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Session expired or clock out of sync' }));
        return;
      }

      // Compute expected signature locally on the server
      const expectedHash = crypto.createHash('sha256')
        .update(activePIN + clientTimestampStr)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      let match = false;
      try {
        match = crypto.timingSafeEqual(Buffer.from(clientHash, 'hex'), Buffer.from(expectedHash, 'hex'));
      } catch (e) {
        match = false;
      }

      if (!match) {
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
          
          // Securely callback to main process to merge and return updated data
          if (callback && typeof callback === 'function') {
            // Pass the encrypted payload to the renderer callback
            callback(encryptedPayload, (err, encryptedResponse) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Sync failed on server merge' }));
                return;
              }
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, encrypted: encryptedResponse }));
            });
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Main process merge callback missing' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request: Invalid JSON Payload' }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.on('error', (err) => {
    console.error('Sync server error:', err);
    stopSyncServer();
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
    try {
      server.close();
    } catch (e) {
      console.error('Error closing sync server:', e);
    }
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
