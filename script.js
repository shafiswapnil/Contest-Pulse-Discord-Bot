document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70, // Offset for the fixed header
                    behavior: 'smooth'
                });
            }
        });
    });

    // Mobile menu toggle (for future implementation)
    // const mobileMenuButton = document.getElementById('mobile-menu-button');
    // const navMenu = document.querySelector('nav ul');
    
    // if (mobileMenuButton) {
    //     mobileMenuButton.addEventListener('click', function() {
    //         navMenu.classList.toggle('active');
    //     });
    // }
    
    // Add year to copyright
    const yearSpan = document.querySelector('.footer-copyright .year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}); 