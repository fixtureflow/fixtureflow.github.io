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
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme');
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // 3. Real-Time OS Auto-Switching Listener
    OS_PREF.addEventListener('change', (e) => {
        localStorage.removeItem('theme'); // Clear manual lock on natural shift
        applyTheme(e.matches ? 'dark' : 'light');
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleIcon(theme);
        
        // Dynamically synchronize browser address bar/status bar theme
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            const lightColor = '#f8fafc';
            let darkColor = '#0b1329'; // Default for Homepage & CourtFlow
            if (window.location.pathname.includes('/ddlc/')) {
                darkColor = '#0b0f19'; // DDLC deep obsidian dark color
            }
            themeColorMeta.setAttribute('content', theme === 'dark' ? darkColor : lightColor);
        }
    }

    function updateToggleIcon(theme) {
        if (!themeToggle) return;
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
    if (header) {
        let isScrolled = false;
        window.addEventListener('scroll', () => {
            const shouldScroll = window.scrollY > 50;
            if (shouldScroll !== isScrolled) {
                isScrolled = shouldScroll;
                if (isScrolled) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        }, { passive: true });
    }
});
