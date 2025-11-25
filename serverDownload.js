import JSZip from 'jszip';
import * as FileSaver from 'file-saver';
import forge from 'node-forge';

export function setupServerDownload({ btnServer }) {
    btnServer.addEventListener('click', () => {
        // UI Feedback
        const originalText = btnServer.innerHTML;
        btnServer.innerHTML = '<i class="fas fa-cog fa-spin"></i> Generating...';
        btnServer.disabled = true;

        // Allow UI to update before blocking operation
        setTimeout(async () => {
            try {
                const zip = new JSZip();

                // 1. Generate Self-Signed Certs (Client-side)
                const ssl = generateSSLCert();
                zip.file("localhost.key", ssl.key);
                zip.file("localhost.crt", ssl.cert);

                const serverJs = `
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

// SSL Options
const options = {
    key: fs.readFileSync('localhost.key'),
    cert: fs.readFileSync('localhost.crt')
};

const requestHandler = (request, response) => {
    console.log('request ', request.url);

    let filePath = '.' + request.url;
    if (filePath == './') {
        filePath = './panel.html';
    }

    // Remove query strings
    filePath = filePath.split('?')[0];

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Basic CORS headers for Twitch Extension
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        'Content-Type': contentType
    };

    if (request.method === 'OPTIONS') {
        response.writeHead(204, headers);
        response.end();
        return;
    }

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT'){
                // Try serving 404 or just error
                response.writeHead(404, headers);
                response.end('File not found');
            }
            else {
                response.writeHead(500, headers);
                response.end('Error: '+error.code);
            }
        }
        else {
            response.writeHead(200, headers);
            response.end(content, 'utf-8');
        }
    });
};

https.createServer(options, requestHandler).listen(PORT, () => {
    console.log(\`HTTPS Server running at https://localhost:\${PORT}/\`);
    console.log(\`To test in Twitch Console:\`);
    console.log(\`1. Set "Testing Base URI" to https://localhost:\${PORT}/\`);
    console.log(\`2. Open https://localhost:\${PORT}/ in a browser tab and accept the "Not Secure" warning (because it is self-signed).\`);
});
                `;

                const readme = `
# Local Twitch Extension Server (HTTPS)

This server uses auto-generated self-signed certificates to run locally over HTTPS, which is required for many Twitch Extension features.

## Setup
1. Unzip all files.
2. Install Node.js (https://nodejs.org/).
3. Open a terminal in this folder.
4. Run: \`node server.js\`

## Important
- **Browser Warning**: When you first visit \`https://localhost:8080\`, your browser will warn you that the connection is not secure. This is normal because the certificate is self-generated. You must click "Advanced" -> "Proceed to localhost" (or similar) to allow the assets to load.
- **Twitch Console**: Set your Extension's "Testing Base URI" to \`https://localhost:8080/\`.
                `;

                zip.file("server.js", serverJs);
                zip.file("README.md", readme);

                const content = await zip.generateAsync({ type: "blob" });
                FileSaver.saveAs(content, "server.zip");

            } catch (e) {
                console.error(e);
                alert("Error generating server: " + e.message);
            } finally {
                btnServer.innerHTML = originalText;
                btnServer.disabled = false;
            }
        }, 50); // Small delay to let UI render the spinner
    });
}

function generateSSLCert() {
    // Generate a self-signed cert for localhost using node-forge
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 year validity

    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'US' },
        { shortName: 'ST', value: 'Local' },
        { name: 'localityName', value: 'TwitchDev' },
        { name: 'organizationName', value: 'Twitch Extension Builder' },
        { shortName: 'OU', value: 'Dev' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Extensions
    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }
    ]);

    // Sign
    cert.sign(keys.privateKey, forge.md.sha256.create());

    return {
        key: forge.pki.privateKeyToPem(keys.privateKey),
        cert: forge.pki.certificateToPem(cert)
    };
}