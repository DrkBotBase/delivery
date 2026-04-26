// scripts/create-indexes.js
// Ejecutar con: node scripts/create-indexes.js

const mongoose = require('mongoose');
require('dotenv').config();

const Delivery = require('../models/Delivery');
const Expense = require('../models/Expense');
const Shift = require('../models/Shift');
const Restaurant = require('../models/Restaurant.js');

async function createIndexes() {
    try {
        console.log('🔄 Conectando a MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado');

        console.log('\n📊 Creando índices para Delivery...');
        await Delivery.createIndexes();
        console.log('✅ Índices de Delivery creados');

        console.log('\n📊 Creando índices para Expense...');
        await Expense.createIndexes();
        console.log('✅ Índices de Expense creados');

        console.log('\n📊 Creando índices para Shift...');
        await Shift.createIndexes();
        console.log('✅ Índices de Shift creados');

        console.log('\n📊 Creando índices para Restaurant...');
        await Restaurant.createIndexes();
        console.log('✅ Índices de Restaurant creados');

        console.log('\n🎉 TODOS los índices fueron creados exitosamente!');
        
        // Mostrar índices creados
        console.log('\n📋 Resumen de índices:');
        const deliveryIndexes = await Delivery.listIndexes();
        console.log(`Delivery: ${deliveryIndexes.length} índices`);
        
        const expenseIndexes = await Expense.listIndexes();
        console.log(`Expense: ${expenseIndexes.length} índices`);
        
        const shiftIndexes = await Shift.listIndexes();
        console.log(`Shift: ${shiftIndexes.length} índices`);
        
        const restaurantIndexes = await Restaurant.listIndexes();
        console.log(`Restaurant: ${restaurantIndexes.length} índices`);

    } catch (error) {
        console.error('❌ Error creando índices:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Desconectado de MongoDB');
    }
}

createIndexes();