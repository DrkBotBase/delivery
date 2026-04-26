// scripts/fix-notifications.js
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config();

async function fixNotifications() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');
        
        const notifications = await Notification.find({});
        let fixed = 0;
        
        for (const notif of notifications) {
            let content = notif.content;
            let modified = false;
            
            if (content && content.includes('&lt;')) {
                content = content
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ');
                
                notif.content = content;
                await notif.save();
                fixed++;
                console.log(`✅ Corregida: ${notif.title}`);
            }
        }
        
        console.log(`\n📊 Total corregidas: ${fixed}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado');
    }
}

fixNotifications();