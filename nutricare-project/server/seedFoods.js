import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './config/dbConnect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const importTACO = async () => {
    try {
        console.log('⏳ Lendo arquivo JSON da TACO...');
        const jsonPath = path.join(__dirname, 'taco.json');

        if (!fs.existsSync(jsonPath)) {
            console.error('❌ ERRO: Arquivo taco.json não encontrado.');
            process.exit(1);
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const foods = JSON.parse(rawData);
        console.log(`✅ ${foods.length} alimentos encontrados.`);

        console.log('🧹 Limpando tabela foods...');
        await pool.query('DELETE FROM foods');

        console.log('🚀 Iniciando inserção massiva...');

        const query = `
            INSERT INTO foods (
                name, category, base_qty, kcal, carbs, protein, fat, fiber,
                sodium, calcium, iron, zinc, magnesium, potassium, vitC
            ) VALUES (?, ?, 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let successCount = 0;

        for (const food of foods) {
            try {
                const getVal = (val) => {
                    if (val === undefined || val === null || val === "NA" || val === "Tr" || val === "*" || val === "") return 0;
                    const parsed = parseFloat(val);
                    return isNaN(parsed) ? 0 : parsed;
                };

                const values = [
                    food.description,
                    food.category || 'Outros',
                    getVal(food.energy_kcal),
                    getVal(food.carbohydrate_g),
                    getVal(food.protein_g),
                    getVal(food.lipid_g),
                    getVal(food.fiber_g),
                    getVal(food.sodium_mg),
                    getVal(food.calcium_mg),
                    getVal(food.iron_mg),
                    getVal(food.zinc_mg),
                    getVal(food.magnesium_mg),
                    getVal(food.potassium_mg),
                    getVal(food.vitaminC_mg)
                ];

                await pool.query(query, values);
                successCount++;

                if (successCount % 100 === 0) {
                    console.log(`⏳ ${successCount} alimentos inseridos...`);
                }

            } catch (err) {
                console.error(`❌ Erro no item ${food.description}:`, err.message);
            }
        }

        console.log(`\n  SUCESSO: ${successCount} alimentos inseridos na base TACO!`);

        setTimeout(() => {
            process.exit(0);
        }, 1000);

    } catch (error) {
        console.error('❌ Erro Fatal:', error);
        process.exit(1);
    }
};

importTACO();