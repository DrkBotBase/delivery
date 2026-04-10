const moment = require('moment-timezone');

class VinAppService {
    constructor() {
        this.baseUrl = process.env.VINAPP_URL;
        this.email = process.env.VINAPP_USER;
        this.password = process.env.VINAPP_PASS;
        this.token = null; 
    }

    async login() {
        try {
            const response = await fetch(`${this.baseUrl}/api/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.email,
                    password: this.password
                })
            });

            if (!response.ok) {
                throw new Error(`Fallo de autenticación: ${response.statusText}`);
            }
            
            const data = await response.json();

            if (data && data.token) {
                this.token = data.token;
                return this.token;
            } else {
                throw new Error('La API no devolvió el campo "token" esperado.');
            }
        } catch (error) {
            console.error('❌ Error crítico en Login VinApp:', error);
            throw error;
        }
    }
    
    async getOrderByNumber(invoiceNumber, companyId, pointId) {
        try {
            if (!this.token) {
                await this.login();
            }

            return await this._executeOrderRequest(invoiceNumber, companyId, pointId);
        } catch (error) {
            if (error.message.includes('401')) {
                console.warn('⚠️ Token vencido detectado. Reintentando con nuevo login...');
                await this.login();
                return await this._executeOrderRequest(invoiceNumber, companyId, pointId);
            }
            
            console.error('❌ Error en VAS:', error);
            throw error;
        }
    }

    async _executeOrderRequest(invoiceNumber, companyId, pointId) {
        const today = moment().tz("America/Bogota").format('YYYY-MM-DD');
        const payload = {
            inicio: today,
            fin: today,
            id_company: companyId,
            id_point: pointId,
            id_status_filtro: 10
        };

        const response = await fetch(`${this.baseUrl}/api/orders/get-order-list-date-by-point`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            throw new Error('401 Unauthorized');
        }

        if (!response.ok) {
            throw new Error(`Error API: ${response.statusText}`);
        }

        const data = await response.json();
        const orders = Array.isArray(data) ? data : (data.data || []);
        
        const targetOrder = orders.find(order => 
            order.document_number && 
            order.document_number.toString().endsWith(invoiceNumber) ||
            order.consecutive_invoice_pos && 
            order.consecutive_invoice_pos.toString().endsWith(invoiceNumber)
        );

        if (!targetOrder) return null;

        let shippingCost = 0;
        try {
            const publicRes = await fetch(`${this.baseUrl}/api/orders/get-data/${targetOrder.id_order}`);
            const publicData = await publicRes.json();
            if (publicData && publicData.shipping) {
                shippingCost = parseFloat(publicData.shipping);
            }
        } catch (err) {
            console.warn('No se pudo obtener el valor del domicilio público');
        }

        return this.mapToDelivery(targetOrder, shippingCost);
    }

    mapToDelivery(vinData, shippingCost) {
        const cleanTotal = parseFloat((vinData.total || '0').replace(/\./g, '').replace(',', '.'));
        const paymentType = vinData.id_type_forma_pago == 38 ? 'Transferencia' : 'Efectivo';
        return {
            invoiceNumber: vinData.document_number || vinData.consecutive_invoice_pos,
            numberComanda: `CM: ${vinData.consecutivo_comanda}`,
            idOrder: vinData.id_order,
            customerName: vinData.name || 'Cliente',
            address: vinData.address || 'Sin dirección',
            phone: vinData.phone || '0000',
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