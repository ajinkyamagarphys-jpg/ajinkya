document.addEventListener('DOMContentLoaded', function() {
    if (window.feather && typeof feather.replace === 'function') {
        feather.replace();
    }

    // Smooth scroll for in-page anchors
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId.length > 1) {
                var el = document.querySelector(targetId);
                if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // Small hover pulse effect on primary buttons
    document.querySelectorAll('a, button').forEach(function(btn) {
        btn.addEventListener('mousedown', function() {
            btn.style.transform = 'scale(0.98)';
        });
        btn.addEventListener('mouseup', function() {
            btn.style.transform = '';
        });
        btn.addEventListener('mouseleave', function() {
            btn.style.transform = '';
        });
    });

    // Mobile menu toggle
    var toggle = document.getElementById('mobile-menu-toggle');
    var header = document.querySelector('header');
    var mobileMenu;
    if (toggle && header) {
        toggle.addEventListener('click', function() {
            if (!mobileMenu) {
                mobileMenu = document.createElement('div');
                mobileMenu.id = 'mobile-menu';
                mobileMenu.className = 'md:hidden bg-black/90 backdrop-blur-md border-b border-emerald-400/20';
                mobileMenu.innerHTML = '\n                <div class="container mx-auto px-6 py-4 flex flex-col gap-4">\n                    <a href="#events" class="text-gray-300 hover:text-emerald-400 transition-colors">Events</a>\n                    <button disabled class="px-4 py-2 bg-emerald-500 text-black font-bold rounded-full cursor-not-allowed opacity-75 w-max">Login</button>\n                </div>\n                ';
                header.insertAdjacentElement('afterend', mobileMenu);
            }
            var isHidden = mobileMenu.style.display === 'none' || !mobileMenu.style.display;
            mobileMenu.style.display = isHidden ? 'block' : 'none';
        });

        document.addEventListener('click', function(e) {
            if (!mobileMenu) return;
            var clickedToggle = toggle.contains(e.target);
            var clickedMenu = mobileMenu.contains(e.target);
            if (!clickedToggle && !clickedMenu) {
                mobileMenu.style.display = 'none';
            }
        });
    }
    
    // Live registration count for GFG X NOVA (if Supabase available)
    var countEl = document.getElementById('count-gfg-nova');
    async function refreshCount() {
        if (!window.supabaseClient || !countEl) return;
        try {
            var res = await window.supabaseClient
                .from('registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_name', 'GFG X NOVA');
            if (res && typeof res.count === 'number') {
                countEl.textContent = String(res.count);
            }
        } catch (_) {}
    }
    refreshCount();
    setInterval(refreshCount, 10000);
});


