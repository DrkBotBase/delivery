const Tesseract = require('tesseract.js');

class OCRService {
  static async extractTextFromImage(imagePath) {
    try {
      const { data: { text } } = await Tesseract.recognize(
        imagePath,
        'spa',
        {
          //logger: m => console.log(m.status, m.progress),
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÑñ$.,:/-# ',
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1'
        }
      );
      return text;
    } catch (error) {
      console.error('Error OCR:', error);
      throw error;
    }
  }
  
  static getColombiaDate() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(now);
  
    const get = (type) => parts.find(p => p.type === type)?.value;
  
    return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
  }

  static normalizeText(text) {
    return text
      .replace(/\r/g, '')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }

  static parseCOP(value) {
    if (!value) return 0;
    let v = value.replace(/[^\d.,]/g, '');
    v = v.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  static find(patterns, text) {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  static fixAddress(address) {
    if (!address) return address;

    let a = address.toUpperCase().trim();
    a = a.replace(/[＃]/g, '#');

    a = a.replace(
      /(KRA|CRA|CR|CARRERA|CL|CALLE|AV|AVENIDA)\s*([0-9]+[A-Z]?)\s+4\s+([0-9]+-\d+)/g,
      '$1 $2 # $3'
    );

    a = a.replace(
      /(KRA|CRA|CR|CARRERA|CL|CALLE|AV|AVENIDA)\s*([0-9]+)\s+4([0-9])-(\d+)/g,
      '$1 $2 # $3-$4'
    );

    a = a.replace(
      /(KRA|CRA|CR|CARRERA|CL|CALLE|AV|AVENIDA)\s*([0-9]+[A-Z]?)#([0-9]+)/g,
      '$1 $2 # $3'
    );

    a = a.replace(
      /(KRA|CRA|CR|CARRERA|CL|CALLE|AV|AVENIDA)\s*([0-9]+[A-Z]?)\s+([0-9]+-\d+)/g,
      '$1 $2 # $3'
    );

    a = a.replace(/\s{2,}/g, ' ').trim();
    return a;
  }

  static extractDeliveryData(rawText) {
    const text = this.normalizeText(rawText);
    const data = {};

    data.invoiceNumber = this.find([
     //fv[-:\s]*([0-9]+)/i,
      /cm[-:\s]*([0-9]+)/i
    ], text);

    data.date = this.getColombiaDate();

    let name = this.find([/nombre[:\s]*([a-záéíóúñ ]+)/i], text);
    if (!name || name.length < 3) name = "cliente";
    data.customerName = name.trim();

    let phone = this.find([/tel[eé]fono[:\s]*([0-9]+)/i], text);
    if (!phone) {
      const generic = text.match(/3[0-9]{7,10}/);
      phone = generic ? generic[0] : null;
    }

    if (!phone) {
      data.phone = null;
      data.phoneStatus = "no detectado";
    } else {
      data.phone = phone;
      if (phone.length === 10) data.phoneStatus = "ok";
      else if (phone.length < 10) data.phoneStatus = "numero incompleto";
      else data.phoneStatus = "numero de mas";
    }

    let address = this.find([/direccion[:\s]*([^\n]+)/i], text);
    data.address = this.fixAddress(address || "NO DETECTADA");

    data.subtotal = this.parseCOP(this.find([/subtotal[:\s]*\$?\s*([\d.,]+)/i], text));
    data.delivery = this.parseCOP(this.find([/domicilio[:\s]*\$?\s*([\d.,]+)/i], text));
    data.total = this.parseCOP(this.find([/total[:\s]*\$?\s*([\d.,]+)/i], text));

    return data;
  }
}

module.exports = OCRService;