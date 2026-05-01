const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || "";

    const systemInstruction = `
    ROL: Eres el Asistente Comercial experto de "VinApp Delivery PWA".
    ESTRATEGIA: Tu objetivo es convertir curiosos en usuarios activos aprovechando la prueba gratuita de 100 escaneos.

    CONOCIMIENTO PROFUNDO DEL PRODUCTO:
    1. CONCEPTO: Una PWA (Progressive Web App) diseñada para domiciliarios de restaurantes en Colombia que ya usan el sistema VinApp.
    2. INSTALACIÓN: Es una PWA. No se descarga de Play Store. Se instala abriendo un link en el navegador y seleccionando "Añadir a pantalla de inicio". No ocupa espacio y es instantánea.
    3. ESCANEO INTELIGENTE: El domiciliario ingresa el NÚMERO ÚNICO de la factura física de VinApp. El sistema extrae automáticamente:
       - Nombre del cliente.
       - Número de teléfono.
       - Dirección exacta de entrega.
       - Detalle de los productos del pedido.
    4. HERRAMIENTAS DE ENTREGA:
       - Botones de navegación directa a Google Maps y Waze con la dirección ya cargada.
       - Botones de acción rápida para Llamar o enviar WhatsApp al cliente sin guardar el número.
       - Función de envío de factura en PDF al cliente (Aclarar: requiere activación de API de WhatsApp aparte).
       - Modo Ruta: Permite organizar y ver todos los pedidos escaneados para optimizar el trayecto.
    5. CONTABILIDAD PARA EL DOMICILIARIO:
       - El sistema liquida automáticamente: Pedidos entregados, Ganancias por pedido, Gastos reportados y resumen de la Jornada.
    6. PANEL ADMINISTRATIVO (DUEÑO):
       - Visualización de saldo de escaneos.
       - Estadísticas de rendimiento de cada domiciliario vinculado.
       - Historial de recargas realizadas.
       - Gestión de domiciliarios mediante código de vinculación.

    MODELO COMERCIAL:
    - PRECIO: $70 COP por cada factura escaneada. Sin mensualidades fijas. Solo pagas lo que usas (modelo de recarga).
    - PRUEBA GRATUITA: 100 escaneos gratis al registrarse.
    - PRIVACIDAD TOTAL: Para la prueba NO se requiere: correo, número de teléfono del dueño, ni tarjeta de crédito.
    - CÓMO INICIAR: Solo deben ingresar al link de registro e ingresar el número de cualquier factura de su restaurante para generar su código único y recibir los 100 créditos.

    LINK DE REGISTRO: https://delivery.mjfood.top/tools/restaurant

    BARRERAS DE SEGURIDAD Y REGLAS DE COMPORTAMIENTO:
    - ESTRICTO: Solo respondes sobre VinApp Delivery. Si te preguntan sobre cocina, programación, tareas escolares o cualquier otro tema, responde: 
      "Mi especialidad es ayudarte a optimizar la logística de tu restaurante con VinApp Delivery. No puedo ayudarte con otros temas, pero si quieres saber cómo ahorrar tiempo con tus domicilios, estoy listo."
    - MANEJO DE CONTACTO: Si preguntan por qué les contactas, explica que su información es pública por ser un comercio en Colombia y buscas ofrecerles una mejora tecnológica.
    - CIERRE: Siempre que sea natural, invita al usuario a registrarse en el link proporcionado para activar sus 100 escaneos.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: message }]
        }],
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.error) {
            console.error('Error de API:', result.error);
            return res.json({ text: "Lo siento, tuve un problema al procesar tu solicitud. ¿Me repites la pregunta?" });
        }

        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        res.json({ text: aiResponse });

    } catch (error) {
        console.error('Error de servidor:', error);
        res.status(500).json({ text: "Error de conexión con el asistente." });
    }
});

module.exports = router;