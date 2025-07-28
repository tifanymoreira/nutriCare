import React from "react";
import "../../assets/styles/navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <a href="/">NutriSystem</a>
      </div>
      <ul className="navbar-links">
        <li>
          <a href="#features">Funcionalidades</a>
        </li>
        <li>
          <a href="/sobre">Sobre</a>
        </li>
        <li>
          <a href="/contato">Contato</a>
        </li>
      </ul>
      <div className="navbar-auth">
        <button className="btn btn-secondary">Login</button>
        <button className="btn btn-primary">Cadastre-se</button>
      </div>
    </nav>
  );
};

export default Navbar;
