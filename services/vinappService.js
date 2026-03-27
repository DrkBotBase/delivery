const moment = require('moment-timezone');

class VinAppService {
  constructor() {
      this.baseUrl = process.env.VINAPP_URL;
      this.email = process.env.VINAPP_USER;
      this.password = process.env.VINAPP_PASS;
      this.companyId = process.env.VINAPP_COMPANY_ID;
      this.pointId = process.env.VINAPP_POINT_ID;
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

    async getOrderByNumber(invoiceNumber) {
        try {
            if (!this.token) {
                await this.login();
            }

            return await this._executeOrderRequest(invoiceNumber);
        } catch (error) {
            if (error.message.includes('401')) {
                console.warn('⚠️ Token vencido detectado. Reintentando con nuevo login...');
                await this.login();
                return await this._executeOrderRequest(invoiceNumber);
            }
            
            console.error('❌ Error en VAS:', error);
            throw error;
        }
    }

    async _executeOrderRequest(invoiceNumber) {
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

        if (response.status === 401) {
            throw new Error('401 Unauthorized');
        }

        if (!response.ok) {
            throw new Error(`Error API: ${response.statusText}`);
        }

        const data = await response.json();
        const orders = Array.isArray(data) ? data : (data.data || []);
        
        const targetOrder = orders.find(order => 
            order.consecutive_invoice_pos && 
            order.consecutive_invoice_pos.toString().endsWith(invoiceNumber)
        );

        return targetOrder ? this.mapToDelivery(targetOrder) : null;
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
            imageUrl: '/manual.png',
            pointsEarned: Math.floor(cleanTotal / 1000) 
        };
    }
}

module.exports = new VinAppService();