const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');
const Delivery = require('../../models/Delivery');
const Shift = require('../../models/Shift');
const Restaurant = require('../../models/Restaurant');
const VinAppService = require('../../services/vinappService');

router.post('/import', requireAuth, async (req, res) => {
    try {
        const { invoiceNumber } = req.body;
        
        if (!invoiceNumber) {
            return res.status(400).json({ success: false, error: 'Falta el número de factura' });
        }

        const user = await User.findById(req.session.userId);

        if (!user.linkedRestaurants || user.linkedRestaurants.length === 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'NO_RESTAURANTS',
                message: 'No tienes ningún restaurante vinculado. Ingresa el código de vinculación primero.'
            });
        }

        let deliveryData = null;
        let foundRestaurantName = '';
        let foundPointId = null;

        for (const rest of user.linkedRestaurants) {
            deliveryData = await VinAppService.getOrderByNumber(invoiceNumber, rest.companyId, rest.pointId);
            
            if (deliveryData) {
                foundRestaurantName = rest.name;
                foundPointId = rest.pointId;
                break;
            }
        }

        if (!deliveryData) {
            return res.status(404).json({ 
                success: false, 
                error: 'Factura no encontrada en ninguno de tus restaurantes hoy.' 
            });
        }

        const restaurantAccount = await Restaurant.findOne({ pointId: foundPointId });

        if (!restaurantAccount) {
            return res.status(403).json({
                success: false,
                error: 'RESTAURANT_NOT_FOUND',
                message: `No se encontró una cuenta activa para el restaurante "${foundRestaurantName}".`
            });
        }

        if (restaurantAccount.availableScans <= 0 || restaurantAccount.status === 'suspended') {
            if (restaurantAccount.status !== 'suspended') {
                restaurantAccount.status = 'suspended';
                await restaurantAccount.save();
            }

            return res.status(403).json({
                success: false,
                error: 'NO_BALANCE',
                message: `El restaurante "${foundRestaurantName}" se ha quedado sin saldo de escaneos.`
            });
        }

        restaurantAccount.availableScans -= 1;
        restaurantAccount.totalScans += 1;
        await restaurantAccount.save();

        const existing = await Delivery.findOne({ 
            invoiceNumber: deliveryData.invoiceNumber,
            user: req.session.userId 
        });
        
        if (existing) {
            return res.status(409).json({ success: false, error: 'Esta factura ya fue importada' });
        }

        const activeShift = await Shift.findOne({ user: req.session.userId, status: 'active' });
        
        deliveryData.user = req.session.userId;
        deliveryData.shiftId = activeShift ? activeShift._id : null;
        deliveryData.pointId = foundPointId;
        deliveryData.restaurantName = foundRestaurantName;
        deliveryData.notes = `${foundRestaurantName} - ${deliveryData.notes || ''}`;
        
        if (deliveryData.idOrder) {
            deliveryData.idOrder = deliveryData.idOrder.toString();
        }

        const newDelivery = new Delivery(deliveryData);
        await newDelivery.save();
        
        if (activeShift) {
            activeShift.totalDeliveryAmount += deliveryData.amount;
            await activeShift.save();
        }
        
        res.json({ 
            success: true, 
            delivery: newDelivery,
            message: 'Importado correctamente'
        });
    } catch (error) {
        console.error('Error al importar factura:', error);
        res.status(500).json({ success: false, error: 'Error al conectar con API' });
    }
});

router.get('/ticket/:idOrder', requireAuth, async (req, res) => {
    try {
        const { idOrder } = req.params;
        
        if (!idOrder) {
            return res.status(400).json({ success: false, error: 'Falta el ID de la orden' });
        }

        const URL = process.env.VINAPP_URL;
        const response = await fetch(`${URL}/api/orders/get-data/${idOrder}`);
        
        if (!response.ok) {
            throw new Error(`Error en API VinApp: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || !data.id_order) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada.' });
        }

        const getPaymentMethod = (id) => {
            const methods = { 37: "Efectivo", 38: "Transferencia", 39: "Transferencia", 40: "Nequi", 41: "RappiPay" };
            return methods[id] || "Otro";
        };

        const shipping = parseFloat(data.shipping || 0);
        const total = parseFloat(data.total || 0);
        const subtotal = total - shipping;

        let rawPayWith = parseFloat(data.pay_with) || 0;
        
        if (rawPayWith > 0 && rawPayWith <= 500) {
            rawPayWith = rawPayWith * 1000;
        }

        let payments = [];
        const method1Amount = parseFloat(data.valor_forma_pago) || total;
        payments.push({
            method: getPaymentMethod(data.id_type_forma_pago),
            amount: method1Amount
        });

        let sumOfMethods = method1Amount;

        if (data.id_type_forma_pago_secundaria && data.valor_forma_pago_secundaria) {
            const method2Amount = parseFloat(data.valor_forma_pago_secundaria);
            sumOfMethods += method2Amount;
            payments.push({
                method: getPaymentMethod(data.id_type_forma_pago_secundaria),
                amount: method2Amount
            });
        }

        let customerGivenAmount = rawPayWith > sumOfMethods ? rawPayWith : sumOfMethods;
        
        const change = customerGivenAmount > total ? customerGivenAmount - total : 0;
        
        const products = [];
        
        (data.details || []).forEach(detail => {
            let productValue = parseFloat(detail.value);
            let productName = detail.name_product;
            
            if (productValue === 0 && detail.additions && detail.additions.length > 0) {
                let totalAdditionsValue = 0;
                
                detail.additions.forEach(addition => {
                    totalAdditionsValue += parseFloat(addition.value);
                });
                
                productValue = totalAdditionsValue;
            }
            
            products.push({
                name: productName,
                quantity: detail.quantity,
                unitPrice: productValue,
                subtotal: productValue * detail.quantity,
                observations: detail.observations || ''
            });
        });

        const cleanTicket = {
            restaurant: {
                name: data.point ? data.point.name : 'Restaurante',
                address: data.point ? data.point.direccion : '',
                phone: data.point ? data.point.telefono_pedidos : ''
            },
            order: {
                invoiceNumber: data.document && data.document[0] ? data.document[0].document_number : 'N/A',
                id: data.id_order,
                date: data.created_at,
            },
            customer: {
                name: data.client ? data.client.name : '',
                phone: data.client ? data.client.phone : '',
                address: data.address || ''
            },
            financials: {
                subtotal,
                shipping,
                total,
                payments,
                totalPaid: sumOfMethods, 
                customerGivenAmount,
                change
            },
            products
        };
        res.json({ success: true, ticket: cleanTicket });
    } catch (error) {
        console.error('Error obteniendo ticket digital:', error);
        res.status(500).json({ success: false, error: 'No se pudo cargar la información del ticket.' });
    }
});

router.post('/link-restaurant', requireAuth, async (req, res) => {
    try {
        const { companyId, pointId, name } = req.body;
        
        if (!companyId || !pointId) {
            return res.status(400).json({ success: false, error: 'Código de vinculación inválido.' });
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
        }

        const exists = user.linkedRestaurants.some(r => r.pointId == pointId && r.companyId == companyId);
        
        if (exists) {
            return res.json({ success: true, message: 'Ya estabas vinculado a este restaurante.' });
        }

        user.linkedRestaurants.push({ 
            companyId: Number(companyId), 
            pointId: Number(pointId), 
            name: name || `Restaurante ${pointId}` 
        });
        
        await user.save();

        res.json({ success: true, message: 'Restaurante vinculado correctamente.' });
    } catch (error) {
        console.error('Error al vincular restaurante:', error);
        res.status(500).json({ success: false, error: 'Error al vincular el restaurante.' });
    }
});

router.get('/restaurants', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('linkedRestaurants');
        res.json({ success: true, restaurants: user.linkedRestaurants || [] });
    } catch (error) {
        console.error('Error al obtener restaurantes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;