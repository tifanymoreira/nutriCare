// Paciente-vitrine COMPLETO para o TCC, ligado ao nutri id 1 (Tifany / tiluiza12@icloud.com).
// Idempotente: recria o paciente do e-mail abaixo a cada execução.
import bcrypt from 'bcrypt';
import { pool } from './config/dbConnect.js';

const NUTRI_ID = 1;
const EMAIL = 'joana.demo@nutricare.com';
const SENHA = 'Demo@2026';
const HEIGHT = 167;
const GENDER = 'F';

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const fmt = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:00`;
const dOnly = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const at = (off, h = 10, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + off); x.setHours(h, m, 0, 0); return fmt(x); };
const dateOff = off => { const x = new Date(now); x.setDate(x.getDate() + off); return dOnly(x); };
const r1 = n => Number(n.toFixed(1));
const r2 = n => Number(n.toFixed(2));

const conn = await pool.getConnection();
try {
  // garante tabelas auxiliares (criadas sob demanda pelo app)
  await conn.query(`CREATE TABLE IF NOT EXISTS water_tracker (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, track_date DATE NOT NULL, glasses_count INT DEFAULT 0, UNIQUE KEY uk_water (patient_id, track_date)) CHARACTER SET utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS meal_feedback (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, feedback_date DATE NOT NULL, meal_name VARCHAR(200) NOT NULL, consumed TINYINT(1) DEFAULT 0, notes TEXT, UNIQUE KEY uk_feedback (patient_id, feedback_date, meal_name)) CHARACTER SET utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS clinical_notes (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, nutri_id INT NOT NULL, type ENUM('prescription','referral') NOT NULL, title VARCHAR(200), content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_patient (patient_id)) CHARACTER SET utf8mb4`);

  // ---- limpeza idempotente ----
  const [ex] = await conn.query('SELECT id FROM users WHERE email = ?', [EMAIL]);
  const ids = ex.map(r => r.id);
  await conn.beginTransaction();
  if (ids.length) {
    await conn.query('DELETE FROM meal_items WHERE meal_id IN (SELECT id FROM meals WHERE meal_plan_id IN (SELECT id FROM meal_plans WHERE patient_id IN (?)))', [ids]);
    await conn.query('DELETE FROM meals WHERE meal_plan_id IN (SELECT id FROM meal_plans WHERE patient_id IN (?))', [ids]);
    await conn.query('DELETE FROM meal_plans WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM consultations WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM nutri_nps WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM meal_plan_nps WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM system_nps WHERE user_id IN (?)', [ids]);
    await conn.query('DELETE FROM invoice_items WHERE invoiceID IN (SELECT id FROM invoices WHERE patientID IN (?))', [ids]);
    await conn.query('DELETE FROM invoices WHERE patientID IN (?)', [ids]);
    await conn.query('DELETE FROM anthropometric_assessments WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM anamnese WHERE patientID IN (?)', [ids]);
    await conn.query('DELETE FROM appointments WHERE patientID IN (?)', [ids]);
    await conn.query('DELETE FROM water_tracker WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM meal_feedback WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM clinical_notes WHERE patient_id IN (?)', [ids]);
    await conn.query('DELETE FROM pacientes WHERE id IN (?)', [ids]);
    await conn.query('DELETE FROM users WHERE id IN (?)', [ids]);
  }

  // ---- consultas da noite (banca): joga confirmadas de amanhã p/ ~23h ----
  const [conf] = await conn.query(
    "SELECT id FROM appointments WHERE nutriID=? AND status='Confirmada' AND DATE(appointment_date)=DATE_ADD(CURDATE(),INTERVAL 1 DAY) ORDER BY appointment_date",
    [NUTRI_ID]
  );
  const horas = ['23:15', '23:30', '23:45', '23:50'];
  for (let i = 0; i < conf.length; i++) {
    await conn.query("UPDATE appointments SET appointment_date = CONCAT(DATE_ADD(CURDATE(),INTERVAL 1 DAY),' ',?,':00') WHERE id=?", [horas[i % horas.length], conf[i].id]);
  }

  // ---- cria o paciente-vitrine ----
  const nome = 'Joana Carvalho Pretti';
  const phone = '11991234567';
  const senhaHash = await bcrypt.hash(SENHA, 10);
  const [u] = await conn.query(
    'INSERT INTO users (name, email, password, role, created_at, phone, status) VALUES (?, ?, ?, "paciente", ?, ?, "active")',
    [nome, EMAIL, senhaHash, at(-165, 9, 0), phone]
  );
  const PID = u.insertId;
  await conn.query('INSERT INTO pacientes (id, nome, email, phone, nutriID, status, patient_type) VALUES (?, ?, ?, ?, ?, "Ativo", "particular")', [PID, nome, EMAIL, phone, NUTRI_ID]);

  const birthdate = '1992-04-18';
  const age = now.getFullYear() - 1992;
  const objetivos = ['Emagrecimento', 'Reeducação Alimentar', 'Saúde e Bem-estar'];
  const dyn = { 'Pratica meditação?': 'Sim, 10 min por dia', 'Nível de estresse (0 a 10)': '6', 'Quantas refeições faz fora de casa?': '3 por semana' };
  await conn.query(
    `INSERT INTO anamnese (nutriID, patientID, name, weight, height, birthdate, objective, health_issue, surgerie, digestion, intestino, fezes,
      water_ingestion, period_cicle, previous_diet, mastigacao, allergic, avoidment, fav_food, alcohol, medicine, exercise, wake_up_time,
      blood_exam, final_question, created_at, dynamic_answers)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [NUTRI_ID, PID, nome, 82.0, HEIGHT, birthdate, JSON.stringify(objetivos),
     'Pré-diabetes e colesterol levemente elevado', 'Cesárea (2019)', 'Boa', 'Funcionamento regular', 'Normal (Bristol 4)',
     '1,5 L/dia (abaixo do ideal)', 'Regular', 'Já fez low-carb por conta própria', 'Adequada', 'Intolerância à lactose', 'Fígado, jiló',
     'Frango, batata-doce, frutas vermelhas', 'Socialmente (fins de semana)', 'Não faz uso contínuo', 'Musculação 3x + caminhada 2x/semana',
     '06:00', 'Glicemia jejum 104; LDL 138; HDL 48', 'Quero emagrecer com saúde e controlar a glicemia.', at(-165, 9, 10), JSON.stringify(dyn)]
  );

  // ---- histórico: 6 consultas (Realizadas) + prontuários + antropometria ----
  const serie = [
    { off: -160, w: 82.0, fat: 36, svc: 'Primeira Consulta' },
    { off: -130, w: 79.5, fat: 34, svc: 'Consulta de Retorno' },
    { off: -100, w: 77.0, fat: 32, svc: 'Avaliação Física' },
    { off: -70, w: 74.8, fat: 30, svc: 'Consulta de Retorno' },
    { off: -40, w: 72.5, fat: 28, svc: 'Consulta de Retorno' },
    { off: -12, w: 70.2, fat: 26, svc: 'Avaliação Física' },
  ];
  let lastApptId = null;
  for (let i = 0; i < serie.length; i++) {
    const c = serie[i];
    const apptDate = at(c.off, 14, 0);
    const [a] = await conn.query(
      `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective, service_type, duration, appointment_date, status, confirmation_date, is_rated)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'Realizada', ?, ?)`,
      [NUTRI_ID, PID, nome, EMAIL, phone, birthdate, objetivos[0], c.svc, 50, apptDate, at(c.off - 1, 9, 0), i === serie.length - 1 ? 1 : 0]
    );
    lastApptId = a.insertId;

    const bmi = r1(c.w / Math.pow(HEIGHT / 100, 2));
    const first = i === 0;
    await conn.query(
      `INSERT INTO consultations (appointment_id, patient_id, nutri_id, consultation_date, weight, height, bmi, circum_waist, circum_abdomen, circum_hip, circum_arm,
        body_fat_percentage, subjective_notes, objective_notes, assessment_notes, plan_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [lastApptId, PID, NUTRI_ID, apptDate, c.w, HEIGHT, bmi, r1(88 - i * 2.5), r1(92 - i * 2.5), r1(104 - i * 1.5), r1(32 - i * 0.6), c.fat,
       first ? 'Primeira consulta. Refere cansaço no fim do dia, vontade de doce à tarde e sono irregular. Motivada para mudar.'
             : `Retorno. Relata boa adesão (${90 - i}%), menos compulsão por doces e mais disposição nos treinos. Sono melhorando.`,
       `Peso ${c.w}kg | IMC ${bmi} | %GC ${c.fat}% | Cintura ${r1(88 - i * 2.5)}cm. ${first ? 'Exames: glicemia 104, LDL 138.' : 'Mantém evolução; exames em melhora.'}`,
       first ? 'Sobrepeso grau I com pré-diabetes. Risco cardiometabólico moderado. Objetivo: emagrecimento gradual e controle glicêmico.'
             : `Evolução favorável: -${r1(82 - c.w)}kg acumulados e -${36 - c.fat}% de gordura desde o início. Composição corporal melhorando.`,
       first ? 'Plano hipocalórico (~1500 kcal), low-carb leve, 1,2g proteína/kg. Hidratação 35ml/kg. Caminhada 2x. Reavaliar em 30 dias.'
             : 'Ajuste fino do plano, aumento de fibras e proteínas, inclusão de lanche pré-treino. Solicitados novos exames. Retorno em 30 dias.']
    );

    // antropometria (com dobras p/ o gráfico de radar + evolução)
    const f = c.fat;
    const folds = { chest: r1(f * 0.7), mid: r1(f * 0.6), tri: r1(f * 0.85), sub: r1(f * 0.78), abd: r1(f * 0.95), supra: r1(f * 0.82), thigh: r1(f * 1.0) };
    const fatMass = r2(c.w * f / 100), leanMass = r2(c.w - fatMass);
    const bmr = r2(10 * c.w + 6.25 * HEIGHT - 5 * age - 161);
    await conn.query(
      `INSERT INTO anthropometric_assessments (patient_id, nutritionist_id, created_at, age, gender, weight, height, activity_level,
        fold_triceps, fold_subscapular, fold_chest, fold_midaxillary, fold_suprailiac, fold_abdominal, fold_thigh,
        circ_waist, circ_hip, circ_arm, circ_chest, calc_bmi, calc_body_fat, calc_fat_mass, calc_lean_mass, calc_bmr, calc_tdee)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [PID, NUTRI_ID, apptDate, age, GENDER, c.w, HEIGHT, 1.55,
       folds.tri, folds.sub, folds.chest, folds.mid, folds.supra, folds.abd, folds.thigh,
       r1(88 - i * 2.5), r1(104 - i * 1.5), r1(32 - i * 0.6), r1(94 - i * 1.2), bmi, f, fatMass, leanMass, bmr, r2(bmr * 1.55)]
    );
  }

  // avaliações (NPS) na última consulta
  await conn.query('INSERT INTO nutri_nps (nutri_id, patient_id, appointment_id, rating, comments, created_at) VALUES (?,?,?,?,?,?)', [NUTRI_ID, PID, lastApptId, 5, 'A Dra. Tifany mudou minha relação com a comida. Excelente!', at(-11, 12, 0)]);
  await conn.query('INSERT INTO meal_plan_nps (nutri_id, patient_id, appointment_id, rating, comments, created_at) VALUES (?,?,?,?,?,?)', [NUTRI_ID, PID, lastApptId, 5, 'Plano gostoso e fácil de seguir.', at(-11, 12, 1)]);
  await conn.query('INSERT INTO system_nps (user_id, user_role, appointment_id, rating, comments, created_at) VALUES (?,?,?,?,?,?)', [PID, 'paciente', lastApptId, 5, 'App muito prático, adoro acompanhar minha evolução.', at(-11, 12, 2)]);

  // ---- consulta CONFIRMADA de amanhã às 23h (a "consulta do dia" da banca) ----
  await conn.query(
    `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective, service_type, duration, appointment_date, status, confirmation_date, video_link)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'Confirmada', ?, ?)`,
    [NUTRI_ID, PID, nome, EMAIL, phone, birthdate, objetivos[0], 'Consulta de Retorno', 50, `${dateOff(1)} 23:00:00`, at(0, 9, 0), 'https://meet.google.com/nutricare-demo']
  );
  // uma PENDENTE (aguardando aprovação) — aparece na fila da nutri
  await conn.query(
    `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective, service_type, duration, appointment_date, status)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'Pendente')`,
    [NUTRI_ID, PID, nome, EMAIL, phone, birthdate, objetivos[0], 'Acompanhamento Online', 45, `${dateOff(6)} 10:00:00`]
  );

  // ---- plano alimentar completo (6 refeições) ----
  const [foods] = await conn.query('SELECT id FROM foods ORDER BY id LIMIT 200');
  const fid = i => foods[i % foods.length].id;
  const [mp] = await conn.query('INSERT INTO meal_plans (patient_id, nutri_id, title, observations, created_at) VALUES (?,?,?,?,?)',
    [PID, NUTRI_ID, 'Plano Alimentar — Emagrecimento & Controle Glicêmico', 'Beber 35 ml/kg de água/dia. Priorizar integrais. Evitar açúcar de adição. Mastigar devagar.', at(-12, 15, 0)]);
  const planId = mp.insertId;
  const meals = [
    { name: 'Café da Manhã', time: '07:00', notes: 'Capriche na proteína', n: 3 },
    { name: 'Lanche da Manhã', time: '10:00', notes: 'Fruta + oleaginosas', n: 2 },
    { name: 'Almoço', time: '12:30', notes: 'Metade do prato em vegetais', n: 4 },
    { name: 'Lanche da Tarde', time: '16:00', notes: 'Pré-treino', n: 2 },
    { name: 'Jantar', time: '19:30', notes: 'Leve e proteico', n: 3 },
    { name: 'Ceia', time: '22:00', notes: 'Opcional', n: 1 },
  ];
  let fc = 7;
  for (let o = 0; o < meals.length; o++) {
    const m = meals[o];
    const [mr] = await conn.query('INSERT INTO meals (meal_plan_id, name, time, display_order, notes) VALUES (?,?,?,?,?)', [planId, m.name, m.time, o + 1, m.notes]);
    for (let k = 0; k < m.n; k++) {
      await conn.query('INSERT INTO meal_items (meal_id, food_id, quantity, option_group) VALUES (?,?,?,1)', [mr.insertId, fid(fc++), String(40 + (fc % 5) * 20)]);
    }
  }

  // ---- faturas (2 pagas + 1 pendente p/ mostrar o botão Pagar) ----
  const invs = [
    { off: -160, v: 300, st: 'Paid' },
    { off: -40, v: 250, st: 'Paid' },
    { off: -2, v: 280, st: 'Pending' },
  ];
  for (const inv of invs) {
    const [ir] = await conn.query('INSERT INTO invoices (nutriID, patientID, issueDate, dueDate, totalValue, status, paymentMethod) VALUES (?,?,?,?,?,?,?)',
      [NUTRI_ID, PID, dateOff(inv.off), dateOff(inv.off + 20), inv.v, inv.st, inv.st === 'Paid' ? 'PIX' : null]);
    await conn.query('INSERT INTO invoice_items (invoiceID, description, amount) VALUES (?,?,?)', [ir.insertId, inv.st === 'Paid' ? 'Consulta + plano alimentar' : 'Consulta de retorno (a pagar)', inv.v]);
  }

  // ---- receituário + encaminhamento (páginas do paciente) ----
  await conn.query('INSERT INTO clinical_notes (patient_id, nutri_id, type, title, content, created_at) VALUES (?,?,?,?,?,?)',
    [PID, NUTRI_ID, 'prescription', 'Suplementação',
     'Vitamina D3 2000 UI/dia (após almoço). Ômega-3 1g/dia. Creatina 3g/dia. Reavaliar em 60 dias.', at(-12, 15, 30)]);
  await conn.query('INSERT INTO clinical_notes (patient_id, nutri_id, type, title, content, created_at) VALUES (?,?,?,?,?,?)',
    [PID, NUTRI_ID, 'referral', 'Encaminhamento — Endocrinologia',
     'Encaminho a paciente para avaliação endocrinológica devido a quadro de pré-diabetes (glicemia de jejum 104 mg/dL) para conduta complementar.', at(-12, 15, 35)]);

  // ---- hidratação e feedback de refeições (hoje e amanhã/banca) ----
  for (const off of [0, 1]) {
    await conn.query('INSERT INTO water_tracker (patient_id, track_date, glasses_count) VALUES (?,?,?) ON DUPLICATE KEY UPDATE glasses_count=VALUES(glasses_count)', [PID, dateOff(off), off === 0 ? 6 : 4]);
    for (const mn of ['Café da Manhã', 'Lanche da Manhã', 'Almoço']) {
      await conn.query('INSERT INTO meal_feedback (patient_id, feedback_date, meal_name, consumed) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE consumed=VALUES(consumed)', [PID, dateOff(off), mn]);
    }
  }

  await conn.commit();

  // resumo
  const [[na]] = await conn.query('SELECT COUNT(*) c FROM appointments WHERE patientID=?', [PID]);
  const [[nc]] = await conn.query('SELECT COUNT(*) c FROM consultations WHERE patient_id=?', [PID]);
  const [[nt]] = await conn.query('SELECT COUNT(*) c FROM anthropometric_assessments WHERE patient_id=?', [PID]);
  console.log('\n✅ PACIENTE-VITRINE CRIADO (ligado ao nutri id 1 / tiluiza12@icloud.com)');
  console.log('   Nome:', nome, '| ID:', PID);
  console.log('   ───────────────────────────────────');
  console.log('   🔑 LOGIN DO PACIENTE');
  console.log('      E-mail:', EMAIL);
  console.log('      Senha :', SENHA);
  console.log('   ───────────────────────────────────');
  console.log(`   Agendamentos: ${na.c} (6 realizadas + 1 confirmada amanhã 23:00 + 1 pendente)`);
  console.log(`   Prontuários: ${nc.c} | Avaliações antropométricas: ${nt.c} (com dobras p/ radar)`);
  console.log('   Plano alimentar: 6 refeições | Faturas: 3 (2 pagas + 1 a pagar) | Receituário + Encaminhamento');
  console.log('   Hidratação + feedback de refeições: hoje e amanhã');
  console.log(`\n   🌙 Consultas confirmadas movidas p/ a noite de amanhã: ${conf.length + 1} (incl. a vitrine às 23:00).`);
} catch (err) {
  await conn.rollback();
  console.error('❌ ERRO (rollback):', err.message);
} finally {
  conn.release();
  process.exit(0);
}
