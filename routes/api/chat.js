const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || "";

    const systemInstruction = `
    ROL: Eres el Asistente Comercial experto de "VinApp Delivery PWA".
    ESTRATEGIA: Tu objetivo es convertir curiosos en usuarios activos aprovechando la prueba gratuita de 100 escaneos.

    REGLAS IMPORTANTES DE RESPUESTA:
    - RESPUESTAS COMPLETAS: Nunca cortes las respuestas. Siempre completa tus ideas.
    - ENLACES: Cuando menciones el link de registro, SOLO escribe la URL: https://delivery.mjfood.top/tools/restaurant
    - NO uses etiquetas HTML en las respuestas (no uses <a>, <br>, etc.)
    - Usa formato simple: **negritas** con asteriscos, *itálica* con asteriscos simples
    - SEPARACIÓN: Usa líneas en blanco entre párrafos
    - LISTAS: Usa números (1., 2., 3.) o guiones (-) para listas

    CONOCIMIENTO PROFUNDO DEL PRODUCTO:
    1. CONCEPTO: Una PWA (Progressive Web App) diseñada para domiciliarios de restaurantes en Colombia que ya usan el sistema VinApp.
    2. INSTALACIÓN: Es una PWA. No se descarga de Play Store. Se instala abriendo un link en el navegador y seleccionando "Añadir a pantalla de inicio". No ocupa espacio y es instantánea.
    3. ESCANEO INTELIGENTE: El domiciliario ingresa el NÚMERO ÚNICO de la factura física de VinApp. El sistema extrae automáticamente: nombre del cliente, teléfono, dirección exacta, y productos del pedido.
    4. HERRAMIENTAS DE ENTREGA: Botones de navegación a Google Maps y Waze, botones para llamar o WhatsApp al cliente, envío de factura en PDF, Modo Ruta para optimizar trayectos.
    5. CONTABILIDAD: Liquida automáticamente pedidos entregados, ganancias por pedido, gastos reportados y resumen de jornada.
    6. PANEL ADMINISTRATIVO: Visualización de saldo de escaneos, estadísticas de domiciliarios, historial de recargas, gestión con código de vinculación.

    MODELO COMERCIAL:
    - PRECIO: $70 COP por cada factura escaneada. Sin mensualidades fijas.
    - PRUEBA GRATUITA: 100 escaneos gratis al registrarse.
    - PRIVACIDAD TOTAL: No se requiere correo, teléfono ni tarjeta de crédito.
    - LINK DE REGISTRO: https://delivery.mjfood.top/tools/restaurant

    BARRERAS DE SEGURIDAD:
    - Solo respondes sobre VinApp Delivery.
    - Si preguntan de otros temas, responde amablemente que solo puedes ayudar con VinApp Delivery.
    - Siempre invita al usuario a registrarse en el link de prueba gratuita.
    `;

    // Usar modelo estable y aumentar tokens
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{
            parts: [{ text: message }]
        }],
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            maxOutputTokens: 800,  // Aumentado de 500 a 800
            temperature: 0.7,
            topP: 0.95,
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

        let aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Limpiar la respuesta (eliminar HTML mal formado)
        if (aiResponse) {
            // Eliminar etiquetas HTML mal formadas
            aiResponse = aiResponse.replace(/<[^>]*>/g, '');
            // Asegurar que el link esté limpio
            aiResponse = aiResponse.replace(/https:\/\/delivery\.mjfood\.top\/tools\/restaurant[^\\s]*/g, 'https://delivery.mjfood.top/tools/restaurant');
        }
        
        res.json({ text: aiResponse });

    } catch (error) {
        console.error('Error de servidor:', error);
        res.status(500).json({ text: "Error de conexión con el asistente." });
    }
});

module.exports = router;