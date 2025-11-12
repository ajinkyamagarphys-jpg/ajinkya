// ============================================
// TIME MANAGEMENT (IST Timezone)
// ============================================
var REGISTRATION_CLOSE_TIME = new Date('2025-11-12T00:00:00+05:30'); // Nov 12, 12:00 AM IST
var CONTEST_START_TIME = new Date('2025-11-12T15:30:00+05:30'); // Nov 12, 3:20 PM IST

function getCurrentISTTime() {
    // Get current time and convert to IST
    var now = new Date();
    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    var istOffset = 5.5 * 60 * 60000; // IST is UTC+5:30
    return new Date(utc + istOffset);
}

function getEventState() {
    var now = getCurrentISTTime();
    
    if (now < REGISTRATION_CLOSE_TIME) {
        return 'REGISTRATION_OPEN';
    } else if (now < CONTEST_START_TIME) {
        return 'COUNTDOWN';
    } else {
        return 'CONTEST_LIVE';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.feather && typeof feather.replace === 'function') {
        feather.replace();
    }

    // Initialize particles if available (won't break if file missing)
    try {
        if (window.particlesJS) {
            particlesJS.load('particles-js', 'particles.json', function() {
                // Particles loaded
            });
        }
    } catch (_) {}

    // Initialize page based on event state
    initializePageState();

    // Initialize page based on event state
    initializePageState();

    // Pre-fill event details from URL params
    var urlParams = new URLSearchParams(window.location.search);
    var eventName = urlParams.get('event');
    var eventDate = urlParams.get('date');
    if (eventName) {
        var decoded = decodeURIComponent(eventName);
        var titleEl = document.getElementById('event-title');
        if (titleEl) titleEl.textContent = decoded;
    }
    if (eventDate) {
        var dateEl = document.getElementById('event-date');
        if (dateEl) dateEl.textContent = decodeURIComponent(eventDate);
    }

    var form = document.getElementById('registration-form');
    
    // Handle state-specific initialization
    var state = getEventState();
    if (state === 'REGISTRATION_OPEN' && form) {
        initializeRegistrationForm(form, eventName, eventDate);
    } else if (state === 'COUNTDOWN') {
        startCountdownTimer();
    } else if (state === 'CONTEST_LIVE') {
        initializeLoginForm();
    }
});

// ============================================
// STATE MANAGEMENT
// ============================================
function initializePageState() {
    var state = getEventState();
    
    var registrationSection = document.getElementById('registration-section');
    var closedSection = document.getElementById('closed-section');
    var countdownSection = document.getElementById('countdown-section');
    var loginSection = document.getElementById('login-section');
    var contestSection = document.getElementById('contest-section');
    
    // Hide all sections first
    if (registrationSection) registrationSection.classList.add('hidden');
    if (closedSection) closedSection.classList.add('hidden');
    if (countdownSection) countdownSection.classList.add('hidden');
    if (loginSection) loginSection.classList.add('hidden');
    if (contestSection) contestSection.classList.add('hidden');
    
    // Show appropriate section based on state
    if (state === 'REGISTRATION_OPEN') {
        if (registrationSection) registrationSection.classList.remove('hidden');
    } else if (state === 'COUNTDOWN') {
        if (closedSection) closedSection.classList.remove('hidden');
        if (countdownSection) countdownSection.classList.remove('hidden');
    } else if (state === 'CONTEST_LIVE') {
        if (closedSection) closedSection.classList.remove('hidden');
        if (loginSection) loginSection.classList.remove('hidden');
    }
}

// ============================================
// COUNTDOWN TIMER
// ============================================
function startCountdownTimer() {
    updateCountdown(); // Initial update
    setInterval(updateCountdown, 1000); // Update every second
}

function updateCountdown() {
    var now = getCurrentISTTime();
    var diff = CONTEST_START_TIME - now;
    
    if (diff <= 0) {
        // Timer ended, reload to show login
        location.reload();
        return;
    }
    
    var hours = Math.floor(diff / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Update timer display
    var hoursEl = document.getElementById('timer-hours');
    var minutesEl = document.getElementById('timer-minutes');
    var secondsEl = document.getElementById('timer-seconds');
    
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
}

// ============================================
// LOGIN FORM HANDLING
// ============================================
function initializeLoginForm() {
    var loginForm = document.getElementById('contest-login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        var prn = document.getElementById('login-prn').value.trim().toUpperCase();
        var password = document.getElementById('login-password').value.trim();
        
        if (!prn || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        
        // Validate credentials by checking against registrations
        validateAndShowContest(prn, password);
    });
}

async function validateAndShowContest(prn, password) {
    if (!window.supabaseClient) {
        showToast('System error. Please refresh and try again.', 'error');
        return;
    }
    
    try {
        // Fetch user's registration data
        var result = await window.supabaseClient
            .from('registrations')
            .select('gfg_id, email')
            .eq('prn', prn)
            .eq('event_name', 'GFG X NOVA')
            .maybeSingle();
        
        if (result.error || !result.data) {
            showToast('Invalid PRN. Please check and try again.', 'error');
            return;
        }
        
        var gfgId = result.data.gfg_id;
        var email = result.data.email;
        if (!gfgId || gfgId.length < 3) {
            showToast('Invalid GFG ID in registration. Please contact support.', 'error');
            return;
        }
        
        // Generate expected password: last3ofGFGID@last3ofPRN
        var expectedPassword = gfgId.substring(gfgId.length - 3) + '@' + prn.substring(prn.length - 3);
        
        if (password !== expectedPassword) {
            showToast('Incorrect password. Format: last3ofGFGID@last3ofPRN', 'error');
            return;
        }
        
        // Credentials valid - show contest details
        showContestDetails(prn, expectedPassword, gfgId, email);
        
    } catch (err) {
        console.error(err);
        showToast('Error validating credentials. Please try again.', 'error');
    }
}

function showContestDetails(username, password, gfgId, email) {
    var loginSection = document.getElementById('login-section');
    var contestSection = document.getElementById('contest-section');
    
    if (loginSection) loginSection.classList.add('hidden');
    if (contestSection) {
        contestSection.classList.remove('hidden');
        
        // Inject credentials (not in HTML source)
        var usernameEl = document.getElementById('contest-username');
        var passwordEl = document.getElementById('contest-password');
        var gfgIdEl = document.getElementById('contest-gfgid');
        var emailEl = document.getElementById('contest-email');
        var linkEl = document.getElementById('contest-link');
        
        if (usernameEl) usernameEl.textContent = username;
        if (passwordEl) passwordEl.textContent = password;
        if (gfgIdEl) gfgIdEl.textContent = gfgId;
        if (emailEl) emailEl.textContent = email;
        if (linkEl) {
            linkEl.href = 'https://practice.geeksforgeeks.org/contest/codearena-mitaoe-gfg-x-nova';
            linkEl.textContent = 'Open Contest';
        }
        
        // Re-initialize feather icons for the copy button
        if (window.feather) {
            feather.replace();
        }
    }
}

// Copy contest link function
function copyContestLink() {
    var input = document.getElementById('contest-url-text');
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile
        
        try {
            document.execCommand('copy');
            showToast('Contest link copied!', 'success');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(input.value).then(function() {
                showToast('Contest link copied!', 'success');
            }).catch(function() {
                showToast('Failed to copy. Please copy manually.', 'error');
            });
        }
    }
}

// Make copyContestLink available globally
window.copyContestLink = copyContestLink;

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message, type) {
    var toast = document.getElementById('toast');
    var body = document.getElementById('toast-body');
    if (!toast || !body) return;
    body.textContent = message;
    body.className = 'px-4 py-2 rounded-lg font-semibold shadow-lg ' + (type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-600 text-black');
    toast.classList.remove('hidden');
    setTimeout(function() { toast.classList.add('hidden'); }, 3500);
}

// ============================================
// REGISTRATION FORM HANDLING
// ============================================
function initializeRegistrationForm(form, eventName, eventDate) {
    if (!form) return;

    // Preview screenshot when file is selected
    var fileInput = document.getElementById('paymentss');
    var previewContainer = document.getElementById('screenshot-preview');
    var previewImg = document.getElementById('screenshot-preview-img');
    
    if (fileInput && previewContainer && previewImg) {
        fileInput.addEventListener('change', function(e) {
            var file = e.target.files && e.target.files[0];
            if (file) {
                // Validate file type and size before showing preview
                var allowed = ['image/png', 'image/jpeg', 'image/webp'];
                if (allowed.indexOf(file.type) === -1) {
                    showToast('Invalid file type. Please upload PNG, JPG or WEBP.', 'error');
                    fileInput.value = '';
                    previewContainer.classList.add('hidden');
                    return;
                }
                if (file.size > 2097152) {
                    showToast('Screenshot exceeds 2 MB limit. Please choose a smaller file.', 'error');
                    fileInput.value = '';
                    previewContainer.classList.add('hidden');
                    return;
                }
                
                // Show preview
                var reader = new FileReader();
                reader.onload = function(event) {
                    previewImg.src = event.target.result;
                    previewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.classList.add('hidden');
            }
        });
    }

    // Enforce numeric input and 10-digit limit on phone field
    var phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            var digits = this.value.replace(/\D/g, '').slice(0, 10);
            this.value = digits;
            // Clear any custom validity when user types
            this.setCustomValidity('');
        });
        
        // Also clear validity on blur to ensure clean state
        phoneInput.addEventListener('blur', function() {
            if (this.value.length === 10 && /^\d{10}$/.test(this.value)) {
                this.setCustomValidity('');
            }
        });
    }

    function setButtonLoading(isLoading) {
        var submitBtn = document.getElementById('submit-btn');
        var submitText = document.getElementById('submit-text');
        var submitSpinner = document.getElementById('submit-spinner');
        
        if (!submitBtn || !submitText || !submitSpinner) return;
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitText.textContent = 'Submitting...';
            submitSpinner.classList.remove('hidden');
            submitBtn.classList.add('opacity-90');
        } else {
            submitBtn.disabled = false;
            submitText.textContent = 'Submit Registration';
            submitSpinner.classList.add('hidden');
            submitBtn.classList.remove('opacity-90');
        }
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // CHECK IF REGISTRATION IS CLOSED
        var state = getEventState();
        if (state !== 'REGISTRATION_OPEN') {
            showToast('Registrations are closed. The deadline has passed.', 'error');
            return;
        }

        setButtonLoading(true);

        var bringLaptopEl = document.querySelector('input[name="bring_laptop"]:checked');
        var bringOwnLaptop = bringLaptopEl ? (bringLaptopEl.value === 'yes') : null;

        var payload = {
            name: document.getElementById('name') ? document.getElementById('name').value.trim() : '',
            email: document.getElementById('email') ? document.getElementById('email').value.trim() : '',
                gfg_id: document.getElementById('gfg_id') ? document.getElementById('gfg_id').value.trim() : null,
            prn: document.getElementById('roll') ? document.getElementById('roll').value.trim() : '',
            department: document.getElementById('department') ? document.getElementById('department').value : '',
            year: document.getElementById('year') ? document.getElementById('year').value : '',
            phone: document.getElementById('phone') ? document.getElementById('phone').value.trim() : '',
            upi: document.getElementById('upi') ? document.getElementById('upi').value.trim() : null,
            transaction_id: document.getElementById('transaction') ? document.getElementById('transaction').value.trim() : '',
            bring_own_laptop: bringOwnLaptop,
            event_name: eventName ? decodeURIComponent(eventName) : document.getElementById('event-title').textContent,
            event_date: eventDate ? decodeURIComponent(eventDate) : document.getElementById('event-date').textContent
        };

        // Basic front-end validation
        var requiredFields = ['name', 'email', 'prn', 'department', 'year', 'phone', 'transaction_id'];
        for (var i = 0; i < requiredFields.length; i++) {
            var key = requiredFields[i];
            if (!payload[key] || payload[key].length === 0) {
                showToast('Please fill out ' + key.replace('_', ' ') + '.', 'error');
                setButtonLoading(false);
                return;
            }
        }
        if (payload.bring_own_laptop === null) {
            showToast('Please select if you will bring your own laptop.', 'error');
            setButtonLoading(false);
            return;
        }

        // Additional lightweight validations
        var emailOk = /.+@.+\..+/.test(payload.email);
        if (!emailOk) {
            document.getElementById('email').setCustomValidity('Enter a valid email');
            document.getElementById('email').reportValidity();
            showToast('Invalid email address', 'error');
            setButtonLoading(false);
            return;
        }
        // Clean phone number - remove any non-digits and ensure it's exactly 10 digits
        var cleanPhone = payload.phone.replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            document.getElementById('phone').setCustomValidity('Phone must be exactly 10 digits');
            document.getElementById('phone').reportValidity();
            showToast('Phone must be exactly 10 digits', 'error');
            setButtonLoading(false);
            return;
        }
        // Update payload with cleaned phone
        payload.phone = cleanPhone;
        // clear custom validity
        document.getElementById('email').setCustomValidity('');
        document.getElementById('phone').setCustomValidity('');

        if (!window.supabaseClient) {
            console.error('Supabase client is not initialized.');
            showToast('Configuration error: Supabase not initialized.', 'error');
            setButtonLoading(false);
            return;
        }

        try {
            // Check for existing registration to enforce immutability of choices
            var existing = await window.supabaseClient
                .from('registrations')
                .select('id')
                .eq('event_name', payload.event_name)
                .eq('prn', payload.prn)
                .maybeSingle();

            if (existing && !existing.error && existing.data) {
                showToast('You have already registered for this event.', 'error');
                setButtonLoading(false);
                return;
            }

            // Handle screenshot upload (if provided)
            // Enforce 2 MB client-side limit (2 * 1024 * 1024 = 2097152 bytes)
            var uploadedFilePath = null;
            var fileInput = document.getElementById('paymentss');
            if (fileInput && fileInput.files && fileInput.files.length) {
                var file = fileInput.files[0];
                var allowed = ['image/png', 'image/jpeg', 'image/webp'];
                if (allowed.indexOf(file.type) === -1) {
                    showToast('Invalid file type. Please upload PNG, JPG or WEBP.', 'error');
                    setButtonLoading(false);
                    return;
                }
                if (file.size > 2097152) {
                    showToast('Screenshot exceeds 2 MB limit. Please choose a smaller file.', 'error');
                    setButtonLoading(false);
                    return;
                }

                try {
                    // Build a predictable path inside the bucket
                    var safeId = (payload.prn && payload.prn.length) ? payload.prn : (payload.email ? payload.email.split('@')[0] : 'anon');
                    // preserve extension if available
                    var ext = '';
                    var nameParts = (file.name || '').split('.');
                    if (nameParts.length > 1) ext = '.' + nameParts.pop();
                    var fName = payload.name.trim().split(/\s+/)[0];
                    var filePath = 'registrations/' + safeId + '-' + fName + ext;

                    // Upload to the configured bucket
                    var uploadRes = await window.supabaseClient.storage
                        .from('Payment_screenshots')
                        .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

                    if (uploadRes.error) {
                        console.error('Upload error', uploadRes.error);
                        showToast('Failed to upload screenshot: ' + (uploadRes.error.message || 'Unknown error'), 'error');
                        setButtonLoading(false);
                        return;
                    }

                    uploadedFilePath = filePath;

                    // Get public URL (works for public buckets; use createSignedUrl for private buckets)
                    var urlRes = window.supabaseClient.storage
                        .from('Payment_screenshots')
                        .getPublicUrl(filePath);

                    if (urlRes && urlRes.data && urlRes.data.publicUrl) {
                        payload.screenshot_url = urlRes.data.publicUrl;
                    }

                    // Store storage path (relative to bucket) in payload so it will be saved to DB
                    payload.screenshot_path = filePath;
                } catch (upErr) {
                    console.error('Unexpected upload error', upErr);
                    showToast('Unexpected error uploading screenshot. Please try again.', 'error');
                    setButtonLoading(false);
                    return;
                }
            }

            // Insert new registration
            var insertResult = await window.supabaseClient
                .from('registrations')
                .insert(payload);

            if (insertResult.error) {
                console.error(insertResult.error);
                var msg = insertResult.error.message || 'Request failed';
                
                // If DB insert failed and we uploaded a file, attempt to clean up
                if (uploadedFilePath) {
                    try {
                        await window.supabaseClient.storage
                            .from('Payment_screenshots')
                            .remove([uploadedFilePath]);
                        console.log('Cleaned up uploaded file after DB error');
                    } catch (cleanupErr) {
                        console.error('Failed to cleanup uploaded file', cleanupErr);
                    }
                }
                
                if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('bring_own_laptop')) {
                    msg = 'Database missing bring_own_laptop column. Please add it and retry.';
                }
                showToast('Registration failed: ' + msg, 'error');
                setButtonLoading(false);
                return;
            }

            // Success UI
            setButtonLoading(false);
            var success = document.getElementById('success-message');
            form.classList.add('hidden');
            if (success) success.classList.remove('hidden');
            showToast('Registration successful!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Unexpected error. Please try again.', 'error');
            setButtonLoading(false);
        }
    });
}


