document.addEventListener('DOMContentLoaded', () => {
    // Failsafe Storage wrapper for incognito/private mode stability
    const safeStorage = (() => {
        try {
            const key = '__storage_test__';
            localStorage.setItem(key, key);
            localStorage.removeItem(key);
            return localStorage;
        } catch (e) {
            return {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {}
            };
        }
    })();

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
    let currentTheme = safeStorage.getItem('theme') || getNaturalTheme();
    applyTheme(currentTheme);

    // 2. Manual Toggle Click Handler (Saves manual choice)
    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        
        safeStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // 3. Real-Time OS Auto-Switching Listener
    // If the visitor's OS automatically changes from day to night schedule while the tab is open,
    // this listener instantly synchronizes the website and clears the manual override!
    OS_PREF.addEventListener('change', (e) => {
        safeStorage.removeItem('theme'); // Clear manual lock on natural shift
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

            // Smooth scroll back to the top of the tabs anchor to keep the active mockup and content perfectly in context
            const tabsAnchor = document.querySelector('.tabs-anchor');
            if (tabsAnchor) {
                const offset = 70; // Keep space for sticky navbar
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = tabsAnchor.getBoundingClientRect().top;
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
    const WAITLIST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwjTqvUCCOr_nDYBLuInJJzIli_wbU7LWZA4lNSKsD5TEGHuY1iUaKvI5b2C9vs-Alo/exec';
    const SUPPORT_EMAIL = 'fixtureflow.ddlc@gmail.com';

    const form = document.getElementById('waitlist-form');
    if (form) {
        const statusEl = document.getElementById('waitlist-status');

        // Every message shown to a visitor is written here, never taken from the
        // response. The webhook returns String(err) as the message for SERVER_ERROR,
        // and raw exception text must not end up on screen.
        const ERROR_COPY = {
            LOCK_TIMEOUT: 'Our server was busy and your details were not saved. Please try again.',
            VALIDATION_ERROR: 'Please check your name, club and email address, then try again.'
        };
        const GENERIC_FAILURE = 'Something went wrong at our end and your details were not saved. Please try again, or email ' + SUPPORT_EMAIL + '.';
        // Delivery outcome unknown: the row may or may not exist. This must not claim
        // failure (which invites a duplicate signup) nor success (the bug being fixed).
        const UNCONFIRMED = 'We could not confirm your signup. If you do not hear from us, email ' + SUPPORT_EMAIL + ' and we will add you manually.';

        const setStatus = (message, tone) => {
            if (!statusEl) return;
            statusEl.textContent = message || '';
            statusEl.style.color = tone === 'error' ? 'var(--color-alert)' : 'var(--color-primary)';
            statusEl.style.marginBottom = message ? '10px' : '';
        };

        const showSurvey = (userEmail) => {
            const parentWrapper = form.closest('.waitlist-card');
            const formContainer = parentWrapper ? parentWrapper.querySelector('.form-container') : null;
            const successSurvey = parentWrapper ? parentWrapper.querySelector('.success-survey') : null;

            // The entry is saved either way, so a missing survey view must still be
            // reported as the success it is rather than leaving the form mid-submit.
            if (!formContainer || !successSurvey) return false;

            formContainer.style.display = 'none';
            successSurvey.style.display = 'flex';

            const priceBtns = successSurvey.querySelectorAll('.price-btn');
            priceBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const selectedPrice = btn.getAttribute('data-price');

                    // Log budget choice in background sheet. Deliberately fire-and-forget:
                    // this is optional feedback and a failure here is not actionable by
                    // the visitor, who has already been added to the list.
                    const p = new URLSearchParams();
                    p.append('email', userEmail);
                    p.append('budget', "FixtureFlow: " + selectedPrice);

                    fetch(WAITLIST_ENDPOINT, {
                        method: 'POST',
                        mode: 'no-cors',
                        redirect: 'follow',
                        credentials: 'omit',
                        body: p
                    });

                    priceBtns.forEach(b => b.disabled = true);
                    const thanksSpan = successSurvey.querySelector('.survey-thanks');
                    if (thanksSpan) thanksSpan.style.display = 'block';
                });
            });

            return true;
        };

        // Captured once: reading this inside the handler would treat whatever the
        // button currently says as its "original" label.
        const submitButton = form.querySelector('button[type="submit"]');
        const submitLabel = submitButton ? submitButton.textContent : '';
        const restoreButton = () => {
            if (!submitButton) return;
            submitButton.disabled = false;
            submitButton.textContent = submitLabel;
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            setStatus('');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Joining...';
            }

            const formData = new FormData(form);
            const userEmail = formData.get('email');
            const data = new URLSearchParams();
            data.append('name', formData.get('name'));
            data.append('email', userEmail);
            data.append('club', formData.get('club') + " (DDLC Interest)");

            // mode: 'cors' rather than 'no-cors'. An opaque response is unreadable, so
            // the old code showed the success view even when the server replied
            // LOCK_TIMEOUT and wrote no row — the lead vanished silently.
            //
            // This is safe because a URLSearchParams body sends
            // application/x-www-form-urlencoded with no custom headers, making it a CORS
            // simple request: no OPTIONS preflight, which Apps Script cannot answer.
            // Both the 302 and the final response carry access-control-allow-origin: *,
            // and the page CSP already lists script.google.com and
            // script.googleusercontent.com under connect-src.
            fetch(WAITLIST_ENDPOINT, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                credentials: 'omit',
                body: data
            })
                .then((res) => {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(
                    (payload) => {
                        if (payload && payload.result === 'success') {
                            if (!showSurvey(userEmail)) {
                                restoreButton();
                                setStatus("You're on the waiting list. Thank you!", 'ok');
                            }
                            return;
                        }

                        const code = payload && payload.error ? payload.error.code : '';
                        restoreButton();
                        setStatus(ERROR_COPY[code] || GENERIC_FAILURE, 'error');
                    },
                    // Reached on a network failure, a non-2xx status, or a body that is
                    // not JSON. Handled as the second argument to then() rather than a
                    // trailing catch() so that a DOM error while rendering the success
                    // view cannot also trigger a failure message.
                    (err) => {
                        console.error('Waitlist submission could not be confirmed:', err);
                        restoreButton();
                        setStatus(UNCONFIRMED, 'error');
                    }
                );
        });
    }
});
