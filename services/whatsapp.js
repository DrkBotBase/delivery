const { 
    default: makeWASocket, 
    DisconnectReason, 
    BufferJSON, 
    initAuthCreds, 
    proto, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const WaSession = require('../models/WaSession');

let sock = null;
let isConnected = false;

async function useMongoDBAuthState() {
    const readData = async (id) => {
        try {
            const doc = await WaSession.findById(id);
            if (doc) return JSON.parse(doc.data, BufferJSON.reviver);
            return null;
        } catch (error) { return null; }
    };

    const writeData = async (id, data) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await WaSession.findByIdAndUpdate(id, { data: str }, { upsert: true });
    };

    const removeData = async (id) => {
        await WaSession.findByIdAndDelete(id);
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) tasks.push(writeData(key, value));
                            else tasks.push(removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData('creds', creds)
    };
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMongoDBAuthState();
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        console.log(`[WhatsApp] Iniciando sistema v${version.join('.')} (Última: ${isLatest})`);
        
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[WhatsApp] Conexión cerrada. Código: ${statusCode}. ¿Reconectar?: ${shouldReconnect}`);
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                  console.log('[WhatsApp] Sesión cerrada permanentemente (Logged Out). Se requiere vincular de nuevo.');
                  sock = null;
                }
            } else if (connection === 'open') {
                isConnected = true;
            }
        });

    } catch (error) {
        console.error('[WhatsApp] Error crítico al iniciar:', error);
    }
}

connectToWhatsApp();

module.exports = {
    requestPairingCode: async (phoneNumber) => {
        if (!sock) await connectToWhatsApp();
        let cleanNumber = phoneNumber.replace(/\D/g, ''); 
        return await sock.requestPairingCode(cleanNumber);
    },

    sendInvoicePDF: async (phoneNumber, pdfBuffer, invoiceNumber) => {
        if (!isConnected || !sock) {
            throw new Error('NOT_CONNECTED');
        }

        let cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!cleanPhone.startsWith('57')) {
            cleanPhone = '57' + cleanPhone; 
        }
        
        let numberFact = invoiceNumber.split('-')[1];
        const jid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: `Factura_${numberFact}.pdf`,
            caption: `¡Hola! Aquí tienes el detalle de tu pedido (Factura #${numberFact}).\n\n✨ ¡Gracias por preferirnos!`
        });
    },
    
    getStatus: () => isConnected
};