const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIParserService {
  static async parseInvoice(ocrText) {
    try {
      const prompt = `
Extrae los datos de esta factura de delivery.
Devuelve SOLO JSON puro, sin markdown ni texto adicional.

Campos:
invoiceNumber (string) (solo mostrar CM:mas el número)
customerName (si no existe usar "cliente")
phone (string)
phoneStatus ("ok", "incompleto", "demasiados_digitos")
address (string)
subtotal (number)
delivery (number)
total (number)

Reglas importantes:
- Si teléfono tiene 10 dígitos: phoneStatus="ok"
- Si <10: "incompleto"
- Si >10: "demasiados_digitos"
- Corrige errores OCR comunes donde "#" puede venir como "4".
- Direcciones colombianas tipo: "Cr 20B #15A-22"
- Si no hay nombre usar "cliente"
- Si algún valor numérico no aparece usar 0

TEXTO OCR:
${ocrText}
`;

      const response = await openai.responses.create({
        model: "gpt-5-nano",
        input: prompt,
        max_output_tokens: 800,
        reasoning: { effort: "low" }
      });

      const aiText = response.output_text?.trim();

      if (!aiText) {
        throw new Error("Respuesta IA vacía");
      }

      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Texto IA recibido:", aiText);
        throw new Error("IA devolvió JSON inválido");
      }

      return JSON.parse(match[0]);

    } catch (error) {
      console.error("Error IA OCR:", error);
      throw error;
    }
  }
}

module.exports = AIParserService;