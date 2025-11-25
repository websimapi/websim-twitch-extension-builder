import JSZip from 'jszip';
import saveAs from 'file-saver';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { polyfill } from 'mobile-drag-drop';
import forge from 'node-forge';

// Initialize drag and drop polyfill for mobile
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
});

// State
let currentSelection = null;
let canvasElements = [];
let nextId = 1;

// DOM Elements
const canvas = document.getElementById('panel-canvas');
const modal = document.getElementById('property-modal');
const propertyForm = document.getElementById('property-form');
const btnCloseModal = document.getElementById('close-modal');
const btnSaveProps = document.getElementById('save-properties');
const btnDeleteElem = document.getElementById('delete-element');
const btnExport = document.getElementById('btn-export-extension');
const btnServer = document.getElementById('btn-download-server');
const emptyState = canvas.querySelector('.empty-state');

// --- Drag and Drop Logic ---

// Toolbox items
document.querySelectorAll('.tool-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    });
});

// Canvas Drop Zone
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('drag-over');
});

canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drag-over');
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const type = e.dataTransfer.getData('type');
    if (type) {
        addElement(type);
    }
});

// --- Element Management ---

function addElement(type) {
    if (emptyState) emptyState.style.display = 'none';

    const id = `el-${nextId++}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'element-wrapper';
    wrapper.dataset.id = id;
    wrapper.dataset.type = type;

    // Default Data
    const data = getDefaultData(type);
    wrapper.dataset.props = JSON.stringify(data);

    // Render Content
    renderElementContent(wrapper, type, data);

    // Click to edit
    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(wrapper);
    });

    canvas.appendChild(wrapper);
}

function getDefaultData(type) {
    switch(type) {
        case 'text': return { text: 'Hello Twitch!', color: '#efeff1', size: '16px', align: 'left' };
        case 'button': return { label: 'Click Me', bgColor: '#9146FF', color: '#ffffff' };
        case 'container': return { bgColor: '#26262c', padding: '10px', radius: '4px' };
        case 'image': return { src: 'https://placehold.co/300x150/9146FF/white?text=Image', alt: 'Placeholder' };
        case 'divider': return { color: '#3a3a3a', margin: '10px' };
        default: return {};
    }
}

function renderElementContent(wrapper, type, data) {
    wrapper.innerHTML = ''; // Clear previous

    let content;
    switch(type) {
        case 'text':
            content = document.createElement('div');
            content.className = 'teb-text';
            content.textContent = data.text;
            content.style.color = data.color;
            content.style.fontSize = data.size;
            content.style.textAlign = data.align;
            break;
        case 'button':
            content = document.createElement('button');
            content.className = 'teb-btn';
            content.textContent = data.label;
            content.style.backgroundColor = data.bgColor;
            content.style.color = data.color;
            break;
        case 'container':
            content = document.createElement('div');
            content.className = 'teb-container';
            content.style.backgroundColor = data.bgColor;
            content.style.padding = data.padding;
            content.style.borderRadius = data.radius;
            content.textContent = 'Container Area';
            content.style.color = '#aaa';
            content.style.fontSize = '0.8rem';
            content.style.textAlign = 'center';
            content.style.border = '1px dashed #444';
            break;
        case 'image':
            content = document.createElement('img');
            content.className = 'teb-image';
            content.src = data.src;
            content.alt = data.alt;
            break;
        case 'divider':
            content = document.createElement('div');
            content.className = 'teb-divider';
            content.style.backgroundColor = data.color;
            content.style.marginTop = data.margin;
            content.style.marginBottom = data.margin;
            break;
    }

    if (content) wrapper.appendChild(content);
}

function selectElement(wrapper) {
    if (currentSelection) {
        currentSelection.classList.remove('selected');
    }
    currentSelection = wrapper;
    wrapper.classList.add('selected');
    openModal();
}

// --- Modal & Properties ---

function openModal() {
    if (!currentSelection) return;

    const type = currentSelection.dataset.type;
    const props = JSON.parse(currentSelection.dataset.props);

    propertyForm.innerHTML = ''; // Clear

    // Build Form based on type
    if (type === 'text') {
        addInput(propertyForm, 'Text', 'text', props.text);
        addInput(propertyForm, 'Color', 'color', props.color);
        addSelect(propertyForm, 'Size', 'size', props.size, ['12px', '14px', '16px', '20px', '24px']);
        addSelect(propertyForm, 'Align', 'align', props.align, ['left', 'center', 'right']);
    } else if (type === 'button') {
        addInput(propertyForm, 'Label', 'label', props.label);
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Text Color', 'color', props.color, 'color');
    } else if (type === 'container') {
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Padding', 'padding', props.padding);
        addInput(propertyForm, 'Border Radius', 'radius', props.radius);
    } else if (type === 'image') {
        addInput(propertyForm, 'Image URL', 'src', props.src);
        addInput(propertyForm, 'Alt Text', 'alt', props.alt);
    } else if (type === 'divider') {
        addInput(propertyForm, 'Color', 'color', props.color, 'color');
        addInput(propertyForm, 'Margin', 'margin', props.margin);
    }

    modal.classList.remove('hidden');
}

function addInput(parent, label, key, value, type = 'text') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.dataset.key = key;

    group.appendChild(input);
    parent.appendChild(group);
}

function addSelect(parent, label, key, value, options) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const select = document.createElement('select');
    select.dataset.key = key;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });

    group.appendChild(select);
    parent.appendChild(group);
}

function closeModal() {
    modal.classList.add('hidden');
}

btnSaveProps.addEventListener('click', () => {
    if (!currentSelection) return;

    const inputs = propertyForm.querySelectorAll('input, select');
    const newProps = {};

    inputs.forEach(input => {
        newProps[input.dataset.key] = input.value;
    });

    currentSelection.dataset.props = JSON.stringify(newProps);
    renderElementContent(currentSelection, currentSelection.dataset.type, newProps);
    closeModal();
});

btnDeleteElem.addEventListener('click', () => {
    if (currentSelection) {
        currentSelection.remove();
        currentSelection = null;
        closeModal();
        if (canvas.children.length === 1) { // only empty state (which is hidden) or actually empty
             // Check if any elements exist
             if (canvas.querySelectorAll('.element-wrapper').length === 0) {
                 if (emptyState) emptyState.style.display = 'block';
             }
        }
    }
});

btnCloseModal.addEventListener('click', closeModal);

// --- Export Extension ---

btnExport.addEventListener('click', async () => {
    const zip = new JSZip();

    // 1. Generate HTML
    // Clone canvas to strip wrapper classes
    const clone = canvas.cloneNode(true);
    const elements = clone.querySelectorAll('.element-wrapper');

    // Replace wrappers with pure content
    elements.forEach(el => {
        const content = el.firstElementChild; // The inner .teb-* element
        if (content) {
            el.parentNode.insertBefore(content.cloneNode(true), el);
        }
        el.remove();
    });

    // Remove empty state
    const empty = clone.querySelector('.empty-state');
    if (empty) empty.remove();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Twitch Extension</title>
    <link rel="stylesheet" href="panel.css">
</head>
<body>
    <div id="app">
        ${clone.innerHTML}
    </div>
    <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
    <script src="viewer.js"></script>
</body>
</html>`;

    // 2. CSS
    const cssContent = `
body {
    background-color: #0e0e10; /* Dark mode base */
    color: white;
    font-family: system-ui, sans-serif;
    margin: 0;
    padding: 10px;
    overflow-x: hidden;
}
#app {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.teb-btn {
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    width: 100%;
    cursor: pointer;
    font-weight: 600;
    transition: opacity 0.2s;
}
.teb-btn:hover { opacity: 0.9; }
.teb-text { line-height: 1.4; }
.teb-image { max-width: 100%; height: auto; display: block; border-radius: 4px; }
.teb-divider { width: 100%; height: 1px; }
.teb-container { border-radius: 4px; }
    `;

    // 3. JS
    const jsContent = `
window.twitch = window.Twitch.ext;

twitch.onContext((context) => {
    console.log('Context:', context);
});

twitch.onAuthorized((auth) => {
    console.log('Authorized:', auth);
});

// Add basic interactions
document.querySelectorAll('.teb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        console.log('Button clicked:', btn.textContent);
    });
});
    `;

    // 4. Manifest
    const manifest = {
        "name": "My DragDrop Extension",
        "version": "0.0.1",
        "description": "Generated with Twitch Extension Builder",
        "author": "You",
        "views": {
            "panel": {
                "viewer_url": "panel.html",
                "height": 300,
                "can_link_external_content": false
            }
        },
        "manifest_version": "0.0.1" // Twitch specific
    };

    zip.file("panel.html", htmlContent);
    zip.file("panel.css", cssContent);
    zip.file("viewer.js", jsContent);
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "extension.zip");
});

// --- Server Download ---

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
            saveAs(content, "server.zip");
        
        } catch (e) {
            console.error(e);
            alert("Error generating server: " + e.message);
        } finally {
            btnServer.innerHTML = originalText;
            btnServer.disabled = false;
        }
    }, 50); // Small delay to let UI render the spinner
});

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