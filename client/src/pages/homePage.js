import React, { useEffect } from 'react';

// Componentes
import Navbar from '../components/layout/navBar';
import Footer from '../components/layout/Footer';
import Button from '../components/layout/Button';
import AccordionItem from '../components/layout/AccordionItem';

// Estilos
import styles from '../assets/styles/homePage.css'; // Importando o CSS específico para a página

// Ícones
import { FiCalendar, FiClipboard, FiTrendingUp, FiCheckCircle, FiUser, FiHeart, FiAward, FiStar, FiShield, FiZap, FiTarget, FiMessageSquare, FiHelpCircle } from 'react-icons/fi';

const HomePage = () => {
  useEffect(() => {
    const animationClass = styles.fadeUp;
    const visibilityClass = styles.isVisible;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add(visibilityClass);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    const elementsToAnimate = document.querySelectorAll(`.${animationClass}`);
    elementsToAnimate.forEach(el => observer.observe(el));

    return () => elementsToAnimate.forEach(el => { if (el) observer.unobserve(el); });
  }, []);

  const faqData = [
    { title: "A plataforma é segura para os dados dos meus pacientes?", content: "Sim. A segurança é nossa prioridade máxima. Utilizamos criptografia de ponta e seguimos rigorosamente as diretrizes da LGPD para garantir que todos os dados sejam confidenciais e seguros." },
    { title: "Existe um aplicativo para celular?", content: "Atualmente, nossa plataforma é totalmente responsiva e otimizada para uso em navegadores de qualquer dispositivo. Um aplicativo nativo está em nosso roadmap de desenvolvimento." },
    { title: "Preciso instalar algum software?", content: "Não. Nossa plataforma é 100% baseada na nuvem. Você e seus pacientes podem acessá-la de qualquer lugar com uma conexão à internet, sem necessidade de instalações. Basta ter um computador e internet conectada." },
    { title: "Há um período de teste gratuito?", content: "Sim! Oferecemos uma avaliação gratuita de 14 dias com acesso a todas as funcionalidades premium. Não é necessário cartão de crédito para começar." },
  ];

  return (
    <div className={styles.pageWrapper}>
      <Navbar />
      <main>
        {/* --- HERO --- */}
        <section className={`${styles.hero} container`}>
          <div className={`${styles.heroContent} ${styles.fadeUp}`}>
            <h1 className={styles.heroTitle}>A Próxima Geração da Gestão Nutricional</h1>
            <p className={styles.heroSubtitle}>Software inteligente para nutricionistas que valorizam precisão, eficiência e uma experiência premium para seus pacientes.</p>
            <div className={styles.heroActions}>
              <Button>Iniciar Avaliação Gratuita</Button>
              <Button variant="secondary">Agendar Demonstração</Button>
            </div>
          </div>
        </section>

        {/* --- FUNCIONALIDADES --- */}
        <section className={`${styles.features} container`}>
          <div className={`${styles.sectionHeader} ${styles.fadeUp}`}>
            <h2>Tudo o que você precisa. E nada do que você não precisa.</h2>
            <p>Foco total em ferramentas que geram impacto real no seu dia a dia e na jornada dos seus pacientes.</p>
            <p>Facilidade para a gestão de resultados.</p>
            <p>.</p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={`${styles.featureCard} ${styles.fadeUp}`}>
              <FiCalendar size={40} className={styles.featureIcon} />
              <h3>Agendamento Inteligente</h3>
              <p>Gerencie consultas com facilidade e evite faltas com lembretes automáticos.</p>
            </div>
            <div className={`${styles.featureCard} ${styles.fadeUp}`}>
              <FiClipboard size={40} className={styles.featureIcon} />
              <h3>Planos Alimentares Personalizados</h3>
              <p>Crie e edite planos alimentares dinâmicos adaptados às necessidades de cada paciente.</p>
            </div>
            <div className={`${styles.featureCard} ${styles.fadeUp}`}>
              <FiTrendingUp size={40} className={styles.featureIcon} />
              <h3>Dashboards de Progresso</h3>
              <p>Visualize o progresso dos pacientes com gráficos intuitivos e relatórios detalhados.</p>
            </div>
            <div className={`${styles.featureCard} ${styles.fadeUp}`}>
              <FiMessageSquare size={40} className={styles.featureIcon} />
              <h3>Comunicação Segura</h3>
              <p>Chat integrado para interações rápidas e seguras entre nutricionistas e pacientes.</p>
            </div>
          </div>
        </section>

        {/* --- COMO FUNCIONA --- */}
        <section className={`${styles.howItWorks} ${styles.fadeUp}`}>
          <div className="container">
            <div className={`${styles.sectionHeader}`}>
              <h2>Comece a transformar vidas em 3 passos</h2>
            </div>
            <div className={styles.stepsGrid}>
              <div className={styles.step}>
                <div className={styles.stepIconWrapper}><FiUser size={32}/></div>
                <h3>1. Cadastre-se e Convide</h3>
                <p>Crie seu perfil profissional e convide seus pacientes para a plataforma com um link simples.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepIconWrapper}><FiClipboard size={32}/></div>
                <h3>2. Personalize a Jornada</h3>
                <p>Realize anamneses completas, crie planos alimentares dinâmicos e agende as próximas consultas.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepIconWrapper}><FiTrendingUp size={32}/></div>
                <h3>3. Acompanhe e Evolua</h3>
                <p>Monitore o progresso com dashboards visuais, comunique-se via chat e celebre cada conquista.</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* --- FEITO PARA VOCÊ --- */}
        <section className={`${styles.madeForYou} container ${styles.fadeUp}`}>
          <div className={styles.madeForYouColumn}>
            <FiAward size={40} className={styles.columnIcon} />
            <h3>Para Nutricionistas</h3>
            <p>Eleve sua autoridade e eficiência.</p>
            <ul>
              <li><FiCheckCircle/> Otimize seu tempo em até 70%.</li>
              <li><FiCheckCircle/> Aumente a adesão dos pacientes ao tratamento.</li>
              <li><FiCheckCircle/> Centralize toda sua operação em um só lugar.</li>
            </ul>
          </div>
          <div className={styles.madeForYouColumn}>
            <FiHeart size={40} className={styles.columnIcon} />
            <h3>Para Pacientes</h3>
            <p>Uma experiência que motiva e engaja.</p>
            <ul>
              <li><FiCheckCircle/> Tenha seu plano sempre à mão.</li>
              <li><FiCheckCircle/> Visualize seu progresso de forma clara.</li>
              <li><FiCheckCircle/> Comunique-se facilmente com seu(sua) nutri.</li>
            </ul>
          </div>
        </section>
        
        {/* --- DEPOIMENTOS --- */}
        <section className={`${styles.testimonials} ${styles.fadeUp}`}>
          <div className="container">
            <div className={`${styles.sectionHeader}`}>
              <h2>Amado por quem mais importa</h2>
            </div>
            <div className={styles.testimonialsGrid}>
              {/* ... cards de depoimentos como antes ... */}
            </div>
          </div>
        </section>

        {/* --- FAQ --- */}
        <section className={`${styles.faq} container ${styles.fadeUp}`}>
          <div className={`${styles.sectionHeader}`}>
            <h2>Perguntas Frequentes</h2>
          </div>
          <div className={styles.faqList}>
            {faqData.map((item, index) => (
              <AccordionItem key={index} title={item.title}>
                {item.content}
              </AccordionItem>
            ))}
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
};

export default HomePage;