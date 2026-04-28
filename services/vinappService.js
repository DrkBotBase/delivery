const moment = require('moment-timezone');

class VinAppService {
    constructor() {
        this.baseUrl = process.env.VINAPP_URL;
        this.dbJwtToken = process.env.DB_JWT_TOKEN; 
    }
    
    async getOrderByNumber(invoiceNumber, companyId, pointId) {
        try {
            if (!this.dbJwtToken) {
                throw new Error('No se ha configurado el DB_JWT_TOKEN en el entorno.');
            }
            return await this._executeOrderRequest(invoiceNumber, companyId, pointId);
        } catch (error) {
            console.error('❌ Error en VAS:', error);
            throw error;
        }
    }

    async _executeOrderRequest(invoiceNumber, companyId, pointId) {
        const tz = "America/Bogota";
        const todayStr = moment().tz(tz).format('YYYY-MM-DD');
        const yesterdayStr = moment().tz(tz).subtract(1, 'days').format('YYYY-MM-DD');

        let allOrders = [];

        for (const date of [yesterdayStr, todayStr]) {
            try {
                const url = `${this.baseUrl}/api/list/order-range-dev/${date}%2000:00/${date}%2023:59/${companyId}/${pointId}/0`;
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `JWT ${this.dbJwtToken}` 
                    }
                });

                if (!response.ok) {
                    console.warn(`⚠️ Error API en fecha ${date}: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                
                const orders = data.orders || (Array.isArray(data) ? data : (data.data || []));
                allOrders = [...allOrders, ...orders];
            } catch (err) {
                console.warn(`❌ Error fetching orders for ${date}:`, err.message);
            }
        }

        if (allOrders.length === 0) return null;

        const targetOrder = allOrders.find(order => {
            const docNumber = order.document_number ? order.document_number.toString() : '';
            const invoicePos = order.consecutive_invoice_pos ? order.consecutive_invoice_pos.toString() : '';
            const searchNumber = invoiceNumber.toString();
            
            return docNumber === searchNumber || 
                   invoicePos === searchNumber ||
                   docNumber.endsWith(searchNumber) || 
                   invoicePos.endsWith(searchNumber);
        });
        
        if (!targetOrder) return null;
        
        let shippingCost = 0;
        let phoneNumber = '';
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const publicRes = await fetch(`${this.baseUrl}/api/orders/get-data/${targetOrder.id_order}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (publicRes.ok) {
                const publicData = await publicRes.json();
                if (publicData && publicData.shipping) {
                    shippingCost = parseFloat(publicData.shipping);
                    phoneNumber = publicData.phone;
                }
            }
        } catch (err) {
            console.warn('⚠️ No se pudo obtener el valor del domicilio público:', err.message);
        }

        return this.mapToDelivery(targetOrder, shippingCost, phoneNumber);
    }


    mapToDelivery(vinData, shippingCost, phoneNumber) {
        const cleanTotal = parseFloat((vinData.total || '0').toString().replace(/\./g, '').replace(',', '.'));
        const paymentType = vinData.id_type_forma_pago == 37 ? 'Efectivo' : 'Transferencia';
        
        return {
            invoiceNumber: vinData.document_number || vinData.consecutive_invoice_pos,
            numberComanda: `CM: ${vinData.consecutivo_comanda}`,
            idOrder: vinData.id_order,
            customerName: vinData.name || 'Cliente',
            address: vinData.address || 'Sin dirección',
            phone: vinData.phone || phoneNumber || 'No Teléfono',
            date: moment(vinData.created_at).toDate(),
            amount: shippingCost,
            subtotal: cleanTotal > shippingCost ? cleanTotal - shippingCost : cleanTotal, 
            total: cleanTotal,
            notes: paymentType,
            deliveryStatus: 'pendiente',
            imageUrl: '/icons/192.png',
            pointsEarned: Math.floor(cleanTotal / 1000) 
        };
    }
}

module.exports = new VinAppService();