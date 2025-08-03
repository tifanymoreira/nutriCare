document.addEventListener("DOMContentLoaded", function() {

    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    const sr = ScrollReveal({
        distance: '60px',
        duration: 2000,
        delay: 200,
        reset: false 
    });

    sr.reveal('.hero-text', { origin: 'left' });
    sr.reveal('.hero-image', { origin: 'right', delay: 400 });
    sr.reveal('.section-title, .section-subtitle', { origin: 'top' });
    sr.reveal('.feature-card', { origin: 'bottom', interval: 200 });
    sr.reveal('#sobre .col-lg-6:first-child', { origin: 'left' });
    sr.reveal('#sobre .col-lg-6:last-child', { origin: 'right' });
    sr.reveal('.cta-section', { origin: 'bottom' });

});