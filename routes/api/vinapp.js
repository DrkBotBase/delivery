const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');
const Delivery = require('../../models/Delivery');
const Shift = require('../../models/Shift');
const Restaurant = require('../../models/Restaurant');
const VinAppService = require('../../services/vinappService');
const moment = require('moment-timezone');

const { info } = require('./config');

let _providersCache = null;
function getProviders() {
    if (_providersCache) return _providersCache;

    const providers = [];
    const MAX = 50;

    for (let i = 1; i <= MAX; i++) {
        const prefixEnv = process.env[`PROVIDER_${i}_PREFIX`];
        if (!prefixEnv) continue;

        const prefix = prefixEnv.trim().toLowerCase();
        const baseUrl = (process.env[`PROVIDER_${i}_URL`] || '').trim().replace(/\/+$/, '');
        const name = (process.env[`PROVIDER_${i}_NAME`] || prefix.toUpperCase()).trim();

            providers.push({ name, prefix, baseUrl });
        if (prefix && baseUrl) {
        } else {
            console.warn(`⚠️  PROVIDER_${i} incompleto (falta prefix o url), se ignora.`);
        }
    }

    _providersCache = providers;
    if (_providersCache.length) {
        console.log('🌐 Proveedores externos cargados:');
        _providersCache.forEach(p => console.log(`   • ${p.name} [${p.prefix}*] → ${p.baseUrl}`));
    } else {
        console.log('🌐 Proveedores externos: (ninguno configurado)');
    }

    return _providersCache;
}

function matchProvider(idOrder) {
    if (!idOrder) return null;
    const clean = idOrder.trim().toLowerCase();
    return getProviders().find(p => clean.startsWith(p.prefix)) || null;
}

function mapProviderOrderToDelivery(order, provider) {
    const shortId = order.shortId || '';
    const numberComanda = shortId.toLowerCase().startsWith(provider.prefix)
        ? shortId.toLowerCase().slice(provider.prefix.length)
        : shortId;

    return {
        invoiceNumber: shortId.toUpperCase(),
        numberComanda,
        idOrder: shortId,
        customerName: order.clientName || 'Cliente',
        address: order.clientAddress || 'Sin dirección',
        phone: order.clientPhone || 'No Teléfono',
        date: moment(order.createdAt).toDate(),
        amount: order.shippingCost || 0,
        subtotal: order.subtotal || 0,
        total: order.total || 0,
        notes: `${provider.name} - ${order.paymentMethod || 'Pago pendiente'}`,
        deliveryStatus: 'pendiente',
        imageUrl: '/icons/192.png',
        pointId: 0,
        restaurantName: provider.name,
        provider: provider.name,
        providerUrl: provider.baseUrl,
        isExternal: true,
        products: (order.items || []).map(item => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
            observations: item.instructions || ''
        })),
    };
}

function mapProviderOrderToTicket(order, provider) {
    return {
        provider: provider.name,
        restaurant: {
            name: provider.name,
            address: order.restaurantAddress || '',
            phone: order.restaurantPhone || ''
        },
        order: {
            invoiceNumber: order.shortId ? order.shortId.toUpperCase() : 'N/A',
            id: order.shortId,
            date: order.createdAt,
        },
        customer: {
            name: order.clientName || 'Cliente',
            phone: order.clientPhone || 'No Teléfono',
            address: order.clientAddress || 'Sin dirección'
        },
        financials: {
            subtotal: order.subtotal || 0,
            shipping: order.shippingCost || 0,
            total: order.total || 0,
            payments: [{
                method: order.paymentMethod || 'Pago',
                amount: order.total || 0
            }],
            totalPaid: order.total || 0,
            customerGivenAmount: order.cashAmount || order.total || 0,
            change: (order.cashAmount > order.total) ? (order.cashAmount - order.total) : 0
        },
        products: (order.items || []).map(item => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
            observations: item.instructions || ''
        }))
    };
}

router.get('/providers', requireAuth, (req, res) => {
    res.json({
        success: true,
        providers: getProviders().map(p => ({
            name: p.name,
            prefix: p.prefix
        }))
    });
});

router.post('/import', requireAuth, async (req, res) => {
    try {
        const { invoiceNumber } = req.body;

        if (!invoiceNumber) {
            return res.status(400).json({ success: false, error: 'Falta el número de factura' });
        }

        const activeShift = await Shift.findOne({ user: req.session.userId, status: 'active' });

        // --- LÓGICA MULTI-PROVEEDOR EXTERNO ---
        const provider = matchProvider(invoiceNumber);

        if (provider) {
            try {
                const response = await fetch(`${provider.baseUrl}/api/orders/${invoiceNumber.trim().toLowerCase()}`);

                if (response.ok) {
                    const data = await response.json();

                    if (data.success && data.order) {
                        const externalDeliveryData = mapProviderOrderToDelivery(data.order, provider);

                        const existing = await Delivery.findOne({
                            invoiceNumber: externalDeliveryData.invoiceNumber,
                            user: req.session.userId
                        });

                        if (existing) {
                            return res.status(409).json({ success: false, error: 'Esta factura ya fue importada' });
                        }

                        externalDeliveryData.user = req.session.userId;
                        externalDeliveryData.shiftId = activeShift ? activeShift._id : null;

                        const newDelivery = new Delivery(externalDeliveryData);
                        await newDelivery.save();

                        if (activeShift) {
                            activeShift.totalDeliveryAmount += externalDeliveryData.amount;
                            await activeShift.save();
                        }

                        return res.json({
                            success: true,
                            delivery: newDelivery,
                            message: `Importado correctamente de ${provider.name}`
                        });
                    }
                }
            } catch (err) {
                console.error(`❌ Error consultando proveedor ${provider.name}:`, err.message);
            }
        }
        // --- FIN LÓGICA MULTI-PROVEEDOR EXTERNO ---

        // --- LÓGICA VinApp (sin cambios) ---
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

        deliveryData.user = req.session.userId;
        deliveryData.shiftId = activeShift ? activeShift._id : null;
        deliveryData.pointId = foundPointId;
        deliveryData.restaurantName = foundRestaurantName;
        deliveryData.notes = `${foundRestaurantName} - ${deliveryData.notes || ''}`;
        
        if (deliveryData.idOrder) {
            deliveryData.idOrder = deliveryData.idOrder.toString();
        }
        
        try {
            const ticketRes = await fetch(
                `${config.dominio}/api/vinapp/ticket/${deliveryData.idOrder}`,
                { headers: { Cookie: req.headers.cookie || '' } } // pasa la sesión
            );
            if (ticketRes.ok) {
                const ticketJson = await ticketRes.json();
                if (ticketJson.success && ticketJson.ticket) {
                    deliveryData.products = ticketJson.ticket.products || [];
                    deliveryData.ticketSnapshot = ticketJson.ticket;
                }
            }
        } catch (e) {
            console.warn('⚠️ No se pudo precargar el ticket del pedido VinApp:', e.message);
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

        // --- LÓGICA MULTI-PROVEEDOR EXTERNO ---
        const provider = matchProvider(idOrder);

        if (provider) {
            try {
                const response = await fetch(`${provider.baseUrl}/api/orders/${idOrder.trim().toLowerCase()}`);

                if (response.ok) {
                    const data = await response.json();

                    if (data.success && data.order) {
                        const cleanTicket = mapProviderOrderToTicket(data.order, provider);
                        return res.json({ success: true, ticket: cleanTicket });
                    }
                }
            } catch (err) {
                console.error(`❌ Error consultando ticket en ${provider.name}:`, err.message);
            }
        }
        // --- FIN LÓGICA MULTI-PROVEEDOR EXTERNO ---

        // --- LÓGICA VinApp (sin cambios) ---
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

const crypto = require('crypto');
router.post('/share-ticket/:deliveryId', requireAuth, async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const ttlDays = parseInt(process.env.TICKET_TTL_DAYS || '7', 10);

        const delivery = await Delivery.findOne({
            _id: deliveryId,
            user: req.session.userId
        });

        if (!delivery) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        }

        if (delivery.shareToken && delivery.shareExpiresAt && delivery.shareExpiresAt > new Date()) {
            return res.json({
                success: true,
                url: `${config.dominio}/t/${delivery.shareToken}`,
                expiresAt: delivery.shareExpiresAt,
                reused: true
            });
        }

        const token = crypto.randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

        let snapshot = delivery.ticketSnapshot;

        if (!snapshot || !snapshot.products || snapshot.products.length === 0) {
            const invoice = delivery.idOrder || delivery.invoiceNumber;
            const provider = matchProvider(invoice);

            if (provider) {
                try {
                    const r = await fetch(`${provider.baseUrl}/api/orders/${invoice.trim().toLowerCase()}`);
                    if (r.ok) {
                        const d = await r.json();
                        if (d.success && d.order) {
                            snapshot = mapProviderOrderToTicket(d.order, provider);
                            delivery.products = snapshot.products || [];
                        }
                    }
                } catch (e) {
                    console.error('Error trayendo ticket del proveedor:', e.message);
                }
            }

            if (!snapshot) {
                try {
                    const r = await fetch(
                        `${config.dominio}/api/vinapp/ticket/${invoice}`,
                        { headers: { Cookie: req.headers.cookie || '' } }
                    );
                    if (r.ok) {
                        const d = await r.json();
                        if (d.success && d.ticket) {
                            snapshot = d.ticket;
                            delivery.products = snapshot.products || [];
                        }
                    }
                } catch (e) {
                    console.error('Error trayendo ticket VinApp:', e.message);
                }
            }
        }

        if (!snapshot) {
            snapshot = {
                provider: delivery.provider || null,
                restaurant: {
                    name: delivery.restaurantName || 'Restaurante',
                    address: '',
                    phone: ''
                },
                order: {
                    invoiceNumber: delivery.invoiceNumber,
                    id: delivery.idOrder,
                    date: delivery.date
                },
                customer: {
                    name: delivery.customerName,
                    phone: delivery.phone,
                    address: delivery.address
                },
                financials: {
                    subtotal: delivery.subtotal,
                    shipping: delivery.amount,
                    total: delivery.total,
                    payments: [{ method: 'Pago', amount: delivery.total }],
                    totalPaid: delivery.total,
                    customerGivenAmount: delivery.total,
                    change: 0
                },
                products: delivery.products || []
            };
        }

        delivery.shareToken = token;
        delivery.shareExpiresAt = expiresAt;
        delivery.ticketSnapshot = snapshot;
        await delivery.save();

        res.json({
            success: true,
            url: `${config.dominio}/t/${token}`,
            expiresAt
        });
    } catch (error) {
        console.error('Error generando link compartido:', error);
        res.status(500).json({ success: false, error: 'No se pudo generar el enlace' });
    }
});

async function buildTicketSnapshot(delivery) {
  return {
        provider: delivery.provider || null,
        restaurant: {
            name: delivery.restaurantName || 'Restaurante',
            address: delivery.restaurantAddress || '',
            phone: delivery.restaurantPhone || ''
        },
        order: {
            invoiceNumber: delivery.invoiceNumber,
            id: delivery.idOrder,
            date: delivery.date
        },
        customer: {
            name: delivery.customerName,
            phone: delivery.phone,
            address: delivery.address
        },
        financials: {
            subtotal: delivery.subtotal,
            shipping: delivery.amount,
            total: delivery.total,
            payments: [{
                method: 'Pago',
                amount: delivery.total
            }],
            totalPaid: delivery.total,
            customerGivenAmount: delivery.total,
            change: 0
        },
        products: delivery.products || []
    };
}

module.exports = router;