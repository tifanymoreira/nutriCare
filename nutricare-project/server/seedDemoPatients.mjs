// Seed de dados realistas para o nutricionista id=1 (Tifany / tiluiza12@icloud.com)
// Idempotente: pacientes de demo usam e-mail @demo.nutricare e são recriados a cada execução.
import bcrypt from 'bcrypt';
import { pool } from './config/dbConnect.js';

const NUTRI_ID = 1;
const MARKER = '@demo.nutricare';

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const fmtDateTime = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:00`;
const fmtDate = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const dayAt = (offset, h = 10, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + offset); x.setHours(h, m, 0, 0); return fmtDateTime(x); };
const dateOff = (offset) => { const x = new Date(now); x.setDate(x.getDate() + offset); return fmtDate(x); };
// aniversário daqui a N dias (mês-dia cai dentro da semana), ano = idade aprox
const birthdayIn = (days, year) => { const x = new Date(now); x.setDate(x.getDate() + days); return `${year}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const ageFrom = (isoDate) => Math.max(18, now.getFullYear() - parseInt(isoDate.split('-')[0]));
const round = (n, d = 1) => Number(n.toFixed(d));

const conn = await pool.getConnection();
try {
  // ---------------- LIMPEZA (idempotência) ----------------
  const [old] = await conn.query(`SELECT id FROM users WHERE email LIKE '%${MARKER}'`);
  const oldIds = old.map(r => r.id);
  if (oldIds.length) {
    await conn.beginTransaction();
    await conn.query('DELETE FROM meal_items WHERE meal_id IN (SELECT id FROM meals WHERE meal_plan_id IN (SELECT id FROM meal_plans WHERE patient_id IN (?)))', [oldIds]);
    await conn.query('DELETE FROM meals WHERE meal_plan_id IN (SELECT id FROM meal_plans WHERE patient_id IN (?))', [oldIds]);
    await conn.query('DELETE FROM meal_plans WHERE patient_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM consultations WHERE patient_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM nutri_nps WHERE patient_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM meal_plan_nps WHERE patient_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM system_nps WHERE user_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM invoice_items WHERE invoiceID IN (SELECT id FROM invoices WHERE patientID IN (?))', [oldIds]);
    await conn.query('DELETE FROM invoices WHERE patientID IN (?)', [oldIds]);
    await conn.query('DELETE FROM anthropometric_assessments WHERE patient_id IN (?)', [oldIds]);
    await conn.query('DELETE FROM anamnese WHERE patientID IN (?)', [oldIds]);
    await conn.query('DELETE FROM appointments WHERE patientID IN (?)', [oldIds]);
    await conn.query('DELETE FROM pacientes WHERE id IN (?)', [oldIds]);
    await conn.query('DELETE FROM users WHERE id IN (?)', [oldIds]);
    await conn.commit();
    console.log(`🧹 Removidos ${oldIds.length} pacientes de demo anteriores.`);
  }

  // pega ids de alimentos reais p/ planos alimentares
  const [foodsRows] = await conn.query('SELECT id, name FROM foods ORDER BY id LIMIT 120');
  const foodId = (i) => foodsRows[i % foodsRows.length].id;

  const senhaHash = await bcrypt.hash('Demo@2026', 10);

  // ---------------- DEFINIÇÃO DOS PACIENTES ----------------
  const P = [
    {
      nome: 'Ana Beatriz Ferreira', email: 'ana.ferreira' + MARKER, phone: '11990001001', gender: 'F',
      status: 'Ativo', type: 'particular', createdOff: -72, heightCm: 165,
      birthdate: birthdayIn(2, 1992), objective: ['Emagrecimento', 'Reeducação Alimentar'],
      health_issue: 'Resistência à insulina', allergic: 'Intolerância à lactose', avoidment: 'Fígado, jiló',
      medicine: 'Metformina 500mg', exercise: 'Musculação 4x/semana', digestion: 'Boa', intestino: 'Funcionamento regular',
      consults: [
        { off: -70, w: 78.0, fat: 34, svc: 'Primeira Consulta' },
        { off: -40, w: 75.4, fat: 31, svc: 'Consulta de Retorno' },
        { off: -12, w: 72.8, fat: 28, svc: 'Consulta de Retorno' },
      ],
      today: { h: 9, m: 0, svc: 'Consulta de Retorno', dur: 45 },
      futureConfirmed: { off: 7, h: 9, m: 0, svc: 'Acompanhamento Online', dur: 45 },
      mealPlan: true, rateLast: 5,
      invoices: [{ off: -70, v: 250, st: 'Paid' }, { off: -10, v: 180, st: 'Paid' }],
    },
    {
      nome: 'Carlos Henrique Lima', email: 'carlos.lima' + MARKER, phone: '11990002002', gender: 'M',
      status: 'Ativo', type: 'particular', createdOff: -66, heightCm: 178,
      birthdate: '1988-03-15', objective: ['Hipertrofia', 'Performance Esportiva'],
      health_issue: 'Nenhum relevante', allergic: 'Nenhuma', avoidment: 'Frutos do mar',
      medicine: 'Creatina, Whey', exercise: 'Musculação 5x/semana + corrida', digestion: 'Ótima', intestino: 'Regular',
      consults: [
        { off: -64, w: 80.0, fat: 18, svc: 'Primeira Consulta' },
        { off: -34, w: 82.5, fat: 16, svc: 'Avaliação Física' },
        { off: -8, w: 84.1, fat: 15, svc: 'Consulta de Retorno' },
      ],
      today: { h: 10, m: 30, svc: 'Avaliação Física', dur: 60 },
      mealPlan: true, rateLast: 5,
      invoices: [{ off: -64, v: 300, st: 'Paid' }, { off: -6, v: 220, st: 'Paid' }],
    },
    {
      nome: 'Juliana Costa Mendes', email: 'juliana.mendes' + MARKER, phone: '11990003003', gender: 'F',
      status: 'Ativo', type: 'convenio', createdOff: -24, heightCm: 160,
      birthdate: '1995-09-22', objective: ['Reeducação Alimentar'],
      health_issue: 'Gastrite', allergic: 'Glúten (sensibilidade)', avoidment: 'Frituras',
      medicine: 'Omeprazol 20mg', exercise: 'Pilates 2x/semana', digestion: 'Lenta', intestino: 'Constipação ocasional',
      consults: [
        { off: -22, w: 68.0, fat: 30, svc: 'Primeira Consulta' },
        { off: -5, w: 66.7, fat: 29, svc: 'Consulta de Retorno' },
      ],
      pending: { off: 2, h: 11, m: 0, svc: 'Consulta de Retorno', dur: 45 },
      mealPlan: true, rateLast: 4,
      invoices: [{ off: -3, v: 0, st: 'Pending' }],
    },
    {
      nome: 'Pedro Almeida Santos', email: 'pedro.santos' + MARKER, phone: '11990004004', gender: 'M',
      status: 'Ativo', type: 'particular', createdOff: -58, heightCm: 182,
      birthdate: '1990-12-01', objective: ['Performance Esportiva', 'Hipertrofia'],
      health_issue: 'Nenhum', allergic: 'Amendoim', avoidment: 'Nenhuma',
      medicine: 'Nenhuma', exercise: 'Crossfit 5x/semana', digestion: 'Boa', intestino: 'Regular',
      consults: [
        { off: -56, w: 88.0, fat: 20, svc: 'Primeira Consulta' },
        { off: -30, w: 86.5, fat: 17, svc: 'Avaliação Física' },
        { off: -7, w: 85.2, fat: 14, svc: 'Consulta de Retorno' },
      ],
      pending: { off: 3, h: 15, m: 0, svc: 'Avaliação Física', dur: 60 },
      rateLast: 5,
      invoices: [{ off: -56, v: 350, st: 'Paid' }],
    },
    {
      nome: 'Mariana Oliveira Rocha', email: 'mariana.rocha' + MARKER, phone: '11990005005', gender: 'F',
      status: 'Ativo', type: 'convenio', createdOff: -44, heightCm: 168,
      birthdate: birthdayIn(5, 1979), objective: ['Saúde e Bem-estar', 'Controle de Hipertensão'],
      health_issue: 'Hipertensão arterial', allergic: 'Nenhuma', avoidment: 'Embutidos, sal em excesso',
      medicine: 'Losartana 50mg', exercise: 'Caminhada 3x/semana', digestion: 'Boa', intestino: 'Regular',
      consults: [
        { off: -42, w: 74.0, fat: 33, svc: 'Primeira Consulta' },
        { off: -15, w: 72.1, fat: 31, svc: 'Consulta de Retorno' },
      ],
      today: { h: 14, m: 0, svc: 'Consulta de Retorno', dur: 45 },
      rateLast: 4,
      invoices: [{ off: -15, v: 0, st: 'Pending' }],
    },
    {
      nome: 'Rafael Souza Pinto', email: 'rafael.pinto' + MARKER, phone: '11990006006', gender: 'M',
      status: 'Inativo', type: 'particular', createdOff: -120, heightCm: 175,
      birthdate: '1985-06-10', objective: ['Emagrecimento'],
      health_issue: 'Colesterol alto', allergic: 'Nenhuma', avoidment: 'Doces',
      medicine: 'Sinvastatina', exercise: 'Sedentário', digestion: 'Boa', intestino: 'Irregular',
      consults: [
        { off: -118, w: 98.0, fat: 36, svc: 'Primeira Consulta' },
        { off: -85, w: 95.5, fat: 34, svc: 'Consulta de Retorno' },
      ],
      rateLast: 3,
      invoices: [{ off: -118, v: 250, st: 'Paid' }, { off: -80, v: 200, st: 'Overdue' }],
    },
    {
      nome: 'Beatriz Gomes Cardoso', email: 'beatriz.cardoso' + MARKER, phone: '11990007007', gender: 'F',
      status: 'Ativo', type: 'particular', createdOff: -16, heightCm: 162,
      birthdate: '1998-11-30', objective: ['Reeducação Alimentar', 'Emagrecimento'],
      health_issue: 'Ansiedade (compulsão alimentar)', allergic: 'Nenhuma', avoidment: 'Café à noite',
      medicine: 'Nenhuma', exercise: 'Dança 2x/semana', digestion: 'Boa', intestino: 'Regular',
      consults: [
        { off: -14, w: 70.5, fat: 32, svc: 'Primeira Consulta' },
      ],
      pending: { off: 1, h: 16, m: 30, svc: 'Consulta de Retorno', dur: 45 },
      mealPlan: true, rateLast: 5,
      invoices: [{ off: -14, v: 220, st: 'Paid' }],
    },
    {
      nome: 'Lucas Martins Vieira', email: 'lucas.vieira' + MARKER, phone: '11990008008', gender: 'M',
      status: 'Cancelado', type: 'convenio', createdOff: -50, heightCm: 170,
      birthdate: '1993-02-18', objective: ['Emagrecimento'],
      health_issue: 'Nenhum', allergic: 'Nenhuma', avoidment: 'Nenhuma',
      medicine: 'Nenhuma', exercise: 'Futebol 1x/semana', digestion: 'Boa', intestino: 'Regular',
      consults: [
        { off: -48, w: 84.0, fat: 28, svc: 'Primeira Consulta' },
      ],
      invoices: [],
    },
  ];

  const soapFor = (p, c, idx) => {
    const first = idx === 0;
    return {
      s: first
        ? `Paciente comparece para avaliação inicial com objetivo de ${p.objective[0].toLowerCase()}. Relata ${p.health_issue.toLowerCase()} e rotina de ${p.exercise.toLowerCase()}.`
        : `Retorno em ${c.off > -20 ? 'acompanhamento recente' : 'acompanhamento mensal'}. Relata boa adesão ao plano, melhora de disposição e ${p.intestino.toLowerCase()}.`,
      o: `Peso ${c.w}kg, % gordura ${c.fat}%. Sem alterações clínicas agudas. ${p.medicine !== 'Nenhuma' ? 'Mantém ' + p.medicine + '.' : 'Sem medicação contínua.'}`,
      a: first
        ? `Estado nutricional compatível com ${c.fat > 30 ? 'excesso de adiposidade' : 'composição corporal adequada'}. Objetivo definido: ${p.objective.join(', ')}.`
        : `Evolução ${c.fat <= 30 ? 'favorável' : 'gradual'} da composição corporal. Conduta sendo bem tolerada.`,
      pl: first
        ? `Prescrição de plano alimentar individualizado, hidratação 35ml/kg e orientação de ${p.exercise.toLowerCase()}. Reavaliar em 30 dias.`
        : `Ajuste fino do plano alimentar, reforço de fibras e proteínas. Solicitado exames de rotina. Retorno em 30 dias.`,
    };
  };

  let nPac = 0, nApt = 0, nCons = 0, nAnthro = 0, nPlan = 0, nInv = 0, nNps = 0;

  await conn.beginTransaction();
  for (const p of P) {
    // user + paciente
    const [uRes] = await conn.query(
      'INSERT INTO users (name, email, password, role, created_at, phone, status) VALUES (?, ?, ?, "paciente", ?, ?, "active")',
      [p.nome, p.email, senhaHash, dayAt(p.createdOff, 9, 0), p.phone]
    );
    const pid = uRes.insertId;
    await conn.query(
      'INSERT INTO pacientes (id, nome, email, phone, nutriID, status, patient_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pid, p.nome, p.email, p.phone, NUTRI_ID, p.status, p.type]
    );
    nPac++;

    // anamnese
    const age = ageFrom(p.birthdate);
    await conn.query(
      `INSERT INTO anamnese (nutriID, patientID, name, weight, height, birthdate, objective, health_issue, surgerie,
        digestion, intestino, fezes, water_ingestion, period_cicle, previous_diet, mastigacao, allergic, avoidment,
        fav_food, alcohol, medicine, exercise, wake_up_time, blood_exam, final_question, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [NUTRI_ID, pid, p.nome, p.consults[0].w, p.heightCm, p.birthdate, JSON.stringify(p.objective),
       p.health_issue, 'Não', p.digestion, p.intestino, 'Normal', '2L/dia', p.gender === 'F' ? 'Regular' : 'N/A',
       'Já tentou dietas restritivas', 'Adequada', p.allergic, p.avoidment, 'Frutas, frango, arroz',
       'Socialmente', p.medicine, p.exercise, '06:30', 'Última coleta há 3 meses',
       `Expectativa: alcançar ${p.objective[0].toLowerCase()} com saúde.`, dayAt(p.createdOff, 9, 5)]
    );

    // histórico: appointments Realizada + consultations + anthropometria
    let lastRealizedApptId = null;
    p.consults.forEach((c, idx) => { c._idx = idx; });
    for (const c of p.consults) {
      const apptDate = dayAt(c.off, 10 + (c._idx % 6), 0);
      const [aRes] = await conn.query(
        `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective,
           service_type, duration, appointment_date, status, confirmation_date, is_rated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Realizada', ?, 0)`,
        [NUTRI_ID, pid, p.nome, p.email, p.phone, p.birthdate, p.objective[0], c.svc, 45, apptDate, dayAt(c.off, 9, 0)]
      );
      const apptId = aRes.insertId;
      lastRealizedApptId = apptId;
      nApt++;

      const bmi = round(c.w / Math.pow(p.heightCm / 100, 2), 1);
      const so = soapFor(p, c, c._idx);
      await conn.query(
        `INSERT INTO consultations (appointment_id, patient_id, nutri_id, consultation_date, weight, height, bmi,
           body_fat_percentage, subjective_notes, objective_notes, assessment_notes, plan_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [apptId, pid, NUTRI_ID, apptDate, c.w, p.heightCm, bmi, c.fat, so.s, so.o, so.a, so.pl]
      );
      nCons++;

      // antropometria (para gráficos de evolução)
      const fatMass = round(c.w * c.fat / 100, 2);
      const leanMass = round(c.w - fatMass, 2);
      const bmr = round((10 * c.w) + (6.25 * p.heightCm) - (5 * age) + (p.gender === 'M' ? 5 : -161), 0);
      const tdee = round(bmr * 1.55, 0);
      await conn.query(
        `INSERT INTO anthropometric_assessments (patient_id, nutritionist_id, created_at, age, gender, weight, height,
           activity_level, calc_bmi, calc_body_fat, calc_fat_mass, calc_lean_mass, calc_bmr, calc_tdee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pid, NUTRI_ID, apptDate, age, p.gender, c.w, p.heightCm, 1.55, bmi, c.fat, fatMass, leanMass, bmr, tdee]
      );
      nAnthro++;
    }

    // avaliação (NPS) na última consulta realizada
    if (p.rateLast && lastRealizedApptId) {
      await conn.query(
        'INSERT INTO nutri_nps (nutri_id, patient_id, appointment_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [NUTRI_ID, pid, lastRealizedApptId, p.rateLast, p.rateLast >= 5 ? 'Atendimento excelente, muito atenciosa!' : (p.rateLast === 4 ? 'Muito boa, recomendo.' : 'Atendimento ok.'), dayAt(-5, 12, 0)]
      );
      await conn.query(
        'INSERT INTO meal_plan_nps (nutri_id, patient_id, appointment_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [NUTRI_ID, pid, lastRealizedApptId, Math.min(5, p.rateLast + (p.rateLast < 5 ? 1 : 0)), 'Plano fácil de seguir.', dayAt(-5, 12, 1)]
      );
      await conn.query(
        'INSERT INTO system_nps (user_id, user_role, appointment_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [pid, 'paciente', lastRealizedApptId, p.rateLast, 'Plataforma intuitiva.', dayAt(-5, 12, 2)]
      );
      // marca a consulta como avaliada
      await conn.query('UPDATE appointments SET is_rated = 1 WHERE id = ?', [lastRealizedApptId]);
      nNps++;
    }

    // consulta de HOJE (confirmada)
    if (p.today) {
      await conn.query(
        `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective,
           service_type, duration, appointment_date, status, confirmation_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', ?)`,
        [NUTRI_ID, pid, p.nome, p.email, p.phone, p.birthdate, p.objective[0], p.today.svc, p.today.dur, dayAt(0, p.today.h, p.today.m), dayAt(-1, 10, 0)]
      );
      nApt++;
    }

    // consulta futura confirmada
    if (p.futureConfirmed) {
      const f = p.futureConfirmed;
      await conn.query(
        `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective,
           service_type, duration, appointment_date, status, confirmation_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', ?)`,
        [NUTRI_ID, pid, p.nome, p.email, p.phone, p.birthdate, p.objective[0], f.svc, f.dur, dayAt(f.off, f.h, f.m), dayAt(0, 10, 0)]
      );
      nApt++;
    }

    // consulta PENDENTE (aguardando aprovação)
    if (p.pending) {
      const pe = p.pending;
      await conn.query(
        `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, birth_date, objective,
           service_type, duration, appointment_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')`,
        [NUTRI_ID, pid, p.nome, p.email, p.phone, p.birthdate, p.objective[0], pe.svc, pe.dur, dayAt(pe.off, pe.h, pe.m)]
      );
      nApt++;
    }

    // plano alimentar
    if (p.mealPlan) {
      const [mp] = await conn.query(
        'INSERT INTO meal_plans (patient_id, nutri_id, title, observations, created_at) VALUES (?, ?, ?, ?, ?)',
        [pid, NUTRI_ID, `Plano Alimentar — ${p.objective[0]}`, 'Hidratação de 35ml/kg/dia. Mastigar bem os alimentos.', dayAt(-9, 11, 0)]
      );
      const planId = mp.insertId;
      const meals = [
        { name: 'Café da Manhã', time: '07:30', order: 1, items: 3 },
        { name: 'Almoço', time: '12:00', order: 2, items: 4 },
        { name: 'Lanche da Tarde', time: '16:00', order: 3, items: 2 },
        { name: 'Jantar', time: '19:30', order: 4, items: 3 },
      ];
      let fi = pid; // varia os alimentos por paciente
      for (const m of meals) {
        const [mr] = await conn.query(
          'INSERT INTO meals (meal_plan_id, name, time, display_order, notes) VALUES (?, ?, ?, ?, ?)',
          [planId, m.name, m.time, m.order, 'Opção principal']
        );
        const mealId = mr.insertId;
        for (let k = 0; k < m.items; k++) {
          await conn.query(
            'INSERT INTO meal_items (meal_id, food_id, quantity, option_group) VALUES (?, ?, ?, 1)',
            [mealId, foodId(fi++), String(50 + (fi % 4) * 25)]
          );
        }
      }
      nPlan++;
    }

    // faturas
    for (const inv of (p.invoices || [])) {
      const [ir] = await conn.query(
        'INSERT INTO invoices (nutriID, patientID, issueDate, dueDate, totalValue, status, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [NUTRI_ID, pid, dateOff(inv.off), dateOff(inv.off + 15), inv.st === 'Pending' ? 200 : inv.v, inv.st, inv.st === 'Paid' ? 'PIX' : null]
      );
      await conn.query('INSERT INTO invoice_items (invoiceID, description, amount) VALUES (?, ?, ?)',
        [ir.insertId, 'Consulta nutricional', inv.st === 'Pending' ? 200 : inv.v]);
      nInv++;
    }
  }
  await conn.commit();

  console.log('\n✅ SEED CONCLUÍDO (nutriID=1)');
  console.log(`   Pacientes: ${nPac} | Consultas/agendamentos: ${nApt} | Prontuários: ${nCons}`);
  console.log(`   Antropometria: ${nAnthro} | Planos alimentares: ${nPlan} | Faturas: ${nInv} | Avaliações: ${nNps}`);
  // resumo de verificação
  const [[a]] = await conn.query("SELECT COUNT(*) c FROM appointments WHERE nutriID=1 AND status='Pendente'");
  const [[b]] = await conn.query("SELECT COUNT(*) c FROM appointments WHERE nutriID=1 AND status='Confirmada' AND DATE(appointment_date)=CURDATE()");
  const [[c]] = await conn.query("SELECT COUNT(*) c FROM pacientes WHERE nutriID=1 AND status='Ativo'");
  const [[d]] = await conn.query("SELECT ROUND(AVG(rating),2) avg FROM nutri_nps WHERE nutri_id=1");
  const [[e]] = await conn.query("SELECT COUNT(*) c FROM pacientes p JOIN anamnese an ON p.id=an.patientID WHERE p.nutriID=1 AND p.status='Ativo' AND DATE_FORMAT(an.birthdate,'%m-%d') BETWEEN DATE_FORMAT(CURDATE(),'%m-%d') AND DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL 7 DAY),'%m-%d')");
  console.log(`\n   📊 Dashboard deve mostrar:`);
  console.log(`      Pendentes de aprovação: ${a.c} | Consultas de hoje: ${b.c} | Pacientes ativos: ${c.c}`);
  console.log(`      Nota média (survey): ${d.avg} | Aniversariantes da semana (pontos de atenção): ${e.c}`);
} catch (err) {
  await conn.rollback();
  console.error('❌ ERRO no seed (rollback):', err.message);
} finally {
  conn.release();
  process.exit(0);
}
