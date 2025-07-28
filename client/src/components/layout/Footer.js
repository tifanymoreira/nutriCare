import React from 'react';
import '../../assets/styles/navbar.css'; 

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h4>NutriSystem</h4>
                    <p>Potencializando a nutrição através da tecnologia.</p>
                </div>
                <div className="footer-section">
                    <h4>Links Rápidos</h4>
                    <ul>
                        <li><a href="/">Início</a></li>
                        <li><a href="#features">Funcionalidades</a></li>
                        <li><a href="/login">Login</a></li>
                    </ul>
                </div>
                <div className="footer-section">
                    <h4>Legal</h4>
                    <ul>
                        <li><a href="/termos">Termos de Serviço</a></li>
                        <li><a href="/privacidade">Política de Privacidade</a></li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {currentYear} NutriSystem. Todos os direitos reservados.</p>
            </div>
        </footer>
    );
};

export default Footer;