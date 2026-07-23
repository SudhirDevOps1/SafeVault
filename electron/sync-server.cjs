/**
 * SafeVault Local Wi-Fi Synchronization Server
 * Native Node.js HTTP Server - Zero External Dependencies
 */

const http = require('http');
const os = require('os');

let server = null;
let activePIN = null;
let activeVaultData = null; // Stored local vault database state

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
      const clientPIN = req.headers['x-sync-pin'];
      if (!clientPIN || clientPIN !== activePIN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid pairing code' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          
          // Securely callback to main process to merge and return updated data
          if (callback && typeof callback === 'function') {
            callback(payload.vault, (err, mergedVault) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Sync failed on server merge' }));
                return;
              }
              // Update local state
              activeVaultData = mergedVault;
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, vault: mergedVault }));
            });
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Main process merge callback missing' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request: Invalid JSON' }));
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
  return true;
}

module.exports = {
  startSyncServer,
  stopSyncServer,
  getLocalIPs
};
