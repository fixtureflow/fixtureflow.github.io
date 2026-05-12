document.addEventListener('DOMContentLoaded', () => {
    // --- THEME TOGGLE SYSTEM ---
    const themeToggle = document.querySelector('.theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'dark'; // Default to dark mode as requested

    // Initialize theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateToggleIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateToggleIcon(newTheme);
    });

    function updateToggleIcon(theme) {
        if (theme === 'dark') {
            // Sun icon for switching to light mode
            themeToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m0 13.5V21M4.25 12h2.25m13.5 0L21 12M18.364 5.636l-1.591 1.591M6.717 17.283l-1.59 1.59M18.364 18.364l-1.591-1.591M6.717 6.717L5.127 5.127M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
                </svg>
            `;
        } else {
            // Moon icon for switching to dark mode
            themeToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
            `;
        }
    }

    // --- HEADER SCROLL EFFECT ---
    const header = document.querySelector('header.nav-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- PORTAL TABS SYSTEM ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const portalContents = document.querySelectorAll('.portal-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-portal');

            // Deactivate current state
            tabButtons.forEach(btn => btn.classList.remove('active'));
            portalContents.forEach(content => content.classList.remove('active'));

            // Activate target state
            button.classList.add('active');
            const activeContent = document.getElementById(`${targetTab}-portal`);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        });
    });

    // --- LEAD FORM INTERACTION ---
    const form = document.getElementById('waitlist-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const submitButton = form.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            submitButton.disabled = true;
            submitButton.textContent = 'Joining...';

            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                club: formData.get('club')
            };

            // Propose a mock successful submission logic until user links their Google Sheet Web App
            setTimeout(() => {
                submitButton.textContent = '✓ You\'re on the list!';
                submitButton.style.backgroundColor = 'var(--color-success)';
                submitButton.style.color = '#ffffff';
                
                // Reset form fields
                form.reset();
                
                // Reset button after a few seconds
                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                    submitButton.style.backgroundColor = '';
                    submitButton.style.color = '';
                }, 4000);
            }, 1500);
        });
    }
});
