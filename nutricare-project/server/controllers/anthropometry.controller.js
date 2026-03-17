import { pool } from '../config/dbConnect.js';

export const saveAssessment = async (req, res) => {
    try {
        const {
            patient_id, age, gender, weight, height, activity_level,
            fold_triceps, fold_biceps, fold_subscapular, fold_chest,
            fold_midaxillary, fold_suprailiac, fold_abdominal, fold_thigh, fold_calf,
            circ_waist, circ_hip, circ_arm, circ_chest
        } = req.body;

        const nutritionist_id = req.session?.user ? req.session.user.id : 1;

        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);

        const sumOf7 = parseFloat(fold_chest || 0) + parseFloat(fold_midaxillary || 0) +
            parseFloat(fold_triceps || 0) + parseFloat(fold_subscapular || 0) +
            parseFloat(fold_abdominal || 0) + parseFloat(fold_suprailiac || 0) +
            parseFloat(fold_thigh || 0);

        let bodyDensity = 0;
        if (gender === 'M') {
            bodyDensity = 1.112 - (0.00043499 * sumOf7) + (0.00000055 * Math.pow(sumOf7, 2)) - (0.00028826 * age);
        } else {
            bodyDensity = 1.097 - (0.00046971 * sumOf7) + (0.00000056 * Math.pow(sumOf7, 2)) - (0.00012828 * age);
        }

        let bodyFatPercentage = ((4.95 / bodyDensity) - 4.5) * 100;
        if (bodyFatPercentage < 2 || isNaN(bodyFatPercentage)) bodyFatPercentage = 0;

        const fatMass = weight * (bodyFatPercentage / 100);
        const leanMass = weight - fatMass;

        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr = gender === 'M' ? bmr + 5 : bmr - 161;

        const tdee = bmr * activity_level;

        const query = `
            INSERT INTO anthropometric_assessments (
                patient_id, nutritionist_id, age, gender, weight, height, activity_level,
                fold_triceps, fold_biceps, fold_subscapular, fold_chest, fold_midaxillary, 
                fold_suprailiac, fold_abdominal, fold_thigh, fold_calf,
                circ_waist, circ_hip, circ_arm, circ_chest,
                calc_bmi, calc_body_fat, calc_fat_mass, calc_lean_mass, calc_bmr, calc_tdee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            patient_id, nutritionist_id, age, gender, weight, height, activity_level,
            fold_triceps || 0, fold_biceps || 0, fold_subscapular || 0, fold_chest || 0,
            fold_midaxillary || 0, fold_suprailiac || 0, fold_abdominal || 0, fold_thigh || 0, fold_calf || 0,
            circ_waist || 0, circ_hip || 0, circ_arm || 0, circ_chest || 0,
            bmi.toFixed(2), bodyFatPercentage.toFixed(2), fatMass.toFixed(2),
            leanMass.toFixed(2), bmr.toFixed(2), tdee.toFixed(2)
        ];

        await pool.execute(query, values);

        res.status(201).json({
            success: true,
            results: {
                bmi: bmi.toFixed(2),
                bodyFat: bodyFatPercentage.toFixed(2),
                fatMass: fatMass.toFixed(2),
                leanMass: leanMass.toFixed(2),
                bmr: bmr.toFixed(2),
                tdee: tdee.toFixed(2)
            }
        });

    } catch (error) {
        console.error('Erro ao processar avaliação:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

export const getAssessmentHistory = async (req, res) => {
    try {
        const { patientId } = req.params;
        const query = `
            SELECT 
                created_at as date, weight, calc_body_fat as body_fat, 
                calc_lean_mass as lean_mass, fold_chest, fold_midaxillary, 
                fold_triceps, fold_subscapular, fold_abdominal, 
                fold_suprailiac, fold_thigh
            FROM anthropometric_assessments 
            WHERE patient_id = ? 
            ORDER BY created_at ASC
        `;

        const [rows] = await pool.execute(query, [patientId]);
        res.status(200).json({ success: true, history: rows });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar dados.' });
    }
};