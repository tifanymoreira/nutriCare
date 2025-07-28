import React, { useState } from 'react';
import styles from '../common/AccordionItem.css';
import { FiChevronDown } from 'react-icons/fi';

const AccordionItem = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`${styles.accordionItem} ${isOpen ? styles.isOpen : ''}`}>
      <button className={styles.accordionTitle} onClick={toggleOpen}>
        <span>{title}</span>
        <FiChevronDown className={styles.accordionIcon} />
      </button>
      <div className={styles.accordionContent}>
        <div className={styles.accordionContentInner}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionItem;