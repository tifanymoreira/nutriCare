import { GoogleGenerativeAI } from '@google/generative-ai';

export const generateInsights = async (req, res) => {
    try {
        const { objective, sleep, intestine, currentFat, previousFat, currentLeanMass, previousLeanMass } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'Chave da API do Gemini não configurada no .env' });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!data.models || data.models.length === 0) {
            console.error("❌ A API Key não retornou nenhum modelo disponível.", data);
            return res.status(500).json({ success: false, error: 'Sua chave de API não tem acesso a nenhum modelo do Gemini.' });
        }

        const validModels = data.models.filter(m =>
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.includes('gemini') &&
            !m.name.includes('vision')
        );

        if (validModels.length === 0) {
            return res.status(500).json({ success: false, error: 'Nenhum modelo de texto liberado para sua chave.' });
        }

        const rawModelName = validModels[0].name;
        const cleanModelName = rawModelName.replace('models/', '');

        console.log(`✅ Inteligência Artificial Ativada! Utilizando o modelo detectado: ${cleanModelName}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: cleanModelName });

        const prompt = `
            Você é uma IA assistente integrada ao software NutriCare. Seu papel é auxiliar Nutricionistas Clínicos analisando dados de pacientes.
            Analise os dados reais do paciente abaixo:
            - Objetivo principal relatado: ${objective || 'Não informado'}
            - Qualidade do Sono relatada: ${sleep || 'Não informado'}
            - Funcionamento Intestinal relatado: ${intestine || 'Não informado'}
            - % de Gordura Corporal na consulta anterior: ${previousFat}%
            - % de Gordura Corporal na consulta atual: ${currentFat}%
            - Massa Magra na consulta anterior: ${previousLeanMass}kg
            - Massa Magra na consulta atual: ${currentLeanMass}kg

            Instruções rigorosas de resposta:
            1. Escreva um ÚNICO parágrafo curto, direto e de altíssimo nível técnico clínico.
            2. Se houve melhora (redução de gordura/aumento de massa), parabenize o resultado e explique fisiologicamente (ex: ganho de massa eleva TMB).
            3. Se houve estagnação ou piora, aponte os relatos da anamnese (sono, intestino) como possíveis sabotadores devido a inflamação, eixo intestino-cérebro ou cortisol elevado.
            4. Formate palavras-chave usando APENAS a tag HTML <b> para negrito. Não use asteriscos (**) ou markdown, pois o texto será injetado direto no HTML.
            5. Seja humano, técnico e profissional.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        res.status(200).json({ success: true, insight: text });

    } catch (error) {
        console.error('❌ Erro na IA Gemini:', error);
        res.status(500).json({ success: false, error: 'Falha ao processar análise com IA. Verifique as configurações da API.' });
    }
};