require('dotenv').config();
const mongoose = require('mongoose');
const { 
    default: makeWASocket, 
    BufferJSON, 
    initAuthCreds, 
    proto, 
    fetchLatestBaileysVersion,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const WaSession = require('./models/WaSession');

const MONGO_URI = process.env.MONGODB_URI;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

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

let attemptNumber = 0;

async function linkWhatsApp() {
    if (attemptNumber === 0) {
        console.log('\n=========================================');
        console.log('   VINCULACIÓN DE WHATSAPP (BAILEYS)     ');
        console.log('=========================================');
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB conectado.');
    }

    const { state, saveCreds } = await useMongoDBAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('\n✅ ¡VINCULACIÓN EXITOSA!');
            console.log('Los datos ya están en MongoDB. Puedes cerrar (Ctrl+C).');
            process.exit(0);
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || statusCode;
            
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log(`\nre-conectando... (Motivo: ${reason})`);
                linkWhatsApp();
            } else {
                console.log('\n❌ Sesión cerrada. Borra los datos de la DB e intenta de nuevo.');
                process.exit(1);
            }
        }
    });

    if (!state.creds.registered && attemptNumber === 0) {
        attemptNumber++;
        const phoneNumber = await question('\nIngresa el número (Ej: 573001234567): ');
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(cleanNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n📲 CÓDIGO: ${code}\n`);
            } catch (error) {
                console.error('\n❌ Error:', error.message);
            }
        }, 3000);
    }
}

linkWhatsApp();