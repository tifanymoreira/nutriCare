import React from 'react';
import styles from '../common/Button.css'; 

const Button = ({ children, variant = 'primary', ...props }) => {
  const buttonClass = `${styles.btn} ${styles[variant]}`;

  return (
    <button className={buttonClass} {...props}>
      {children}
    </button>
  );
};

export default Button;