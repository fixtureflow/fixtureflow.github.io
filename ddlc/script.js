document.addEventListener('DOMContentLoaded', () => {
    // --- ADVANCED THEME TOGGLE & AUTO-SCHEDULE SYSTEM ---
    const themeToggle = document.querySelector('.theme-toggle');
    const OS_PREF = window.matchMedia('(prefers-color-scheme: dark)');

    // Helper to determine natural system theme based on OS preference or local time (7 PM - 7 AM Dark)
    function getNaturalTheme() {
        if (OS_PREF.matches) return 'dark';
        const hour = new Date().getHours();
        return (hour >= 19 || hour < 7) ? 'dark' : 'light';
    }

    // 1. Initialize Theme (Check manual override first, fallback to natural OS/Time schedule)
    let currentTheme = localStorage.getItem('theme') || getNaturalTheme();
    applyTheme(currentTheme);

    // 2. Manual Toggle Click Handler (Saves manual choice)
    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // 3. Real-Time OS Auto-Switching Listener
    // If the visitor's OS automatically changes from day to night schedule while the tab is open,
    // this listener instantly synchronizes the website and clears the manual override!
    OS_PREF.addEventListener('change', (e) => {
        localStorage.removeItem('theme'); // Clear manual lock on natural shift
        applyTheme(e.matches ? 'dark' : 'light');
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleIcon(theme);
    }

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

            // Smooth scroll back to the top of the tabs wrapper to keep the active mockup and content perfectly in context
            const tabsWrapper = document.querySelector('.tabs-wrapper');
            if (tabsWrapper) {
                const offset = 70; // Keep space for sticky navbar
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = tabsWrapper.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
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
            const userName = formData.get('name');
            const userEmail = formData.get('email');
            const data = new URLSearchParams();
            data.append('name', userName);
            data.append('email', userEmail);
            data.append('club', formData.get('club') + " (DDLC Interest)");

            // Live webhook call to the deployed Apps Script Marketing CRM endpoint (v5 Robust Regex)
            fetch('https://script.google.com/macros/s/AKfycbwjTqvUCCOr_nDYBLuInJJzIli_wbU7LWZA4lNSKsD5TEGHuY1iUaKvI5b2C9vs-Alo/exec', {
                method: 'POST',
                mode: 'no-cors',
                redirect: 'follow',
                credentials: 'omit',
                body: data
            })
            .then(() => {
                // Hide form container, show survey
                const parentWrapper = form.closest('.lead-wrapper');
                const formContainer = parentWrapper.querySelector('.form-container');
                const successSurvey = parentWrapper.querySelector('.success-survey');
                
                if (formContainer && successSurvey) {
                    formContainer.style.display = 'none';
                    successSurvey.style.display = 'flex';
                    
                    // Add event listeners to pricing pills
                    const priceBtns = successSurvey.querySelectorAll('.price-btn');
                    priceBtns.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const selectedPrice = btn.getAttribute('data-price');
                            
                            // Log budget choice in background sheet
                            const p = new URLSearchParams();
                            p.append('email', userEmail);
                            p.append('budget', "FixtureFlow: " + selectedPrice);
                            
                            fetch('https://script.google.com/macros/s/AKfycbwjTqvUCCOr_nDYBLuInJJzIli_wbU7LWZA4lNSKsD5TEGHuY1iUaKvI5b2C9vs-Alo/exec', {
                                method: 'POST',
                                mode: 'no-cors',
                                redirect: 'follow',
                                credentials: 'omit',
                                body: p
                            });
                            
                            // Show thank you and disable buttons
                            priceBtns.forEach(b => b.disabled = true);
                            const thanksSpan = successSurvey.querySelector('.survey-thanks');
                            if (thanksSpan) thanksSpan.style.display = 'block';
                        });
                    });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                submitButton.textContent = '⚠️ Network error, please retry.';
                submitButton.style.backgroundColor = 'var(--color-alert)';
            })
            .finally(() => {
                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                    submitButton.style.backgroundColor = '';
                    submitButton.style.color = '';
                }, 4000);
            });
        });
    }
});
