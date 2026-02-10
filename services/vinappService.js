const moment = require('moment-timezone');

class VinAppService {
    constructor() {
        this.baseUrl = process.env.VINAPP_URL;
        this.token = process.env.VINAPP_TOKEN;
        this.companyId = process.env.VINAPP_COMPANY_ID;
        this.pointId = process.env.VINAPP_POINT_ID;
    }
    async getOrderByNumber(invoiceNumber) {
        try {
            const today = moment().tz("America/Bogota").format('YYYY-MM-DD');
            const payload = {
                inicio: today,
                fin: today,
                id_company: this.companyId,
                id_point: this.pointId,
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
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            const data = await response.json();
            const orders = Array.isArray(data) ? data : (data.data || []);
            const targetOrder = orders.find(order => 
                order.consecutive_invoice_pos && 
                order.consecutive_invoice_pos.toString().endsWith(invoiceNumber)
            );
            if (!targetOrder) {
                return null;
            }
            return this.mapToDelivery(targetOrder);
        } catch (error) {
            console.error('❌ Error en VAS:', error);
            throw error;
        }
    }
    mapToDelivery(vinData) {
        const cleanTotal = parseFloat(vinData.total.replace(/\./g, '').replace(',', '.'));
        const paymentType = vinData.id_type_forma_pago == 38 ? 'Transferencia' : 'Efectivo';
        return {
            invoiceNumber: vinData.consecutive_invoice_pos,
            numberComanda: `CM: ${vinData.consecutivo_comanda}`,
            customerName: vinData.name || 'Cliente',
            address: vinData.address || 'Sin dirección',
            phone: vinData.phone || '0000',
            date: moment(vinData.created_at).toDate(),
            amount: 0, 
            subtotal: cleanTotal, 
            total: cleanTotal,
            notes: paymentType,
            deliveryStatus: 'pendiente',
            imageUrl: '/manual.png' 
        };
    }
}

module.exports = new VinAppService();