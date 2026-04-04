import { db, auth } from '../firebase.js';
import { collection, getDocs } from "firebase/firestore";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    sendEmailVerification
} from "firebase/auth";

console.log('Firebase initialized, loading products...');

// --- Site State ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

// --- 1. Auth State Management ---
onAuthStateChanged(auth, (user) => {
    console.log("Auth State Changed:", user);

    const guestBtns = document.getElementById("guestBtns");
    const userGreeting = document.getElementById("userGreeting");
    const userNameDisplay = document.getElementById("userNameDisplay");
    const drawerUserDisplay = document.getElementById("drawerUserDisplay");
    const guestLinks = document.getElementById("guestLinks");
    const logoutLinkItem = document.getElementById("logoutLinkItem");

    if (user) {
        // ✅ User is logged in
        if (guestBtns) guestBtns.style.display = "none";
        if (userGreeting) userGreeting.style.display = "flex";
        if (guestLinks) guestLinks.style.display = "none";
        if (logoutLinkItem) logoutLinkItem.style.display = "block";

        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const isVerified = user.emailVerified || user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'phone');
        
        if (userNameDisplay) {
            userNameDisplay.innerHTML = `${displayName} ${!isVerified ? '<small style="color: #e74c3c; font-size: 0.7rem; margin-left: 5px;">(Unverified)</small>' : ''}`;
        }
        
        if (drawerUserDisplay) {
            drawerUserDisplay.innerHTML = `
                <i class="fa-solid fa-circle-user"></i>
                <div style="display: flex; flex-direction: column;">
                    <span>Hello, ${displayName}</span>
                    ${!isVerified ? '<button id="resendVerificationBtn" style="background: none; border: none; color: #e74c3c; font-size: 0.75rem; padding: 0; text-align: left; cursor: pointer; text-decoration: underline;">Verify Email Address</button>' : ''}
                </div>`;
            
            const resendBtn = document.getElementById('resendVerificationBtn');
            if (resendBtn) {
                resendBtn.onclick = async () => {
                    try {
                        await sendEmailVerification(user);
                        alert("Verification email resent to " + user.email);
                    } catch (err) {
                        alert("Error resending email: " + err.message);
                    }
                };
            }
        }

        // Standard Session Cache
        localStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            name: displayName,
            verified: isVerified
        }));

        // 🔥 Logic for handling mandatory redirects
        if (window.location.pathname.includes('signup.html') || window.location.search.includes('login=true')) {
             window.location.href = "index.html"; 
             return;
        }

    } else {
        // ❌ User is logged out
        if (guestBtns) guestBtns.style.display = "flex";
        if (userGreeting) userGreeting.style.display = "none";
        if (guestLinks) guestLinks.style.display = "block";
        if (logoutLinkItem) logoutLinkItem.style.display = "none";
        
        if (drawerUserDisplay) {
            drawerUserDisplay.innerHTML = `<i class="fa-solid fa-circle-user"></i><span>Welcome, Guest</span>`;
        }

        // If URL asks for login (like after a redirect from orders.html), open the modal
        const params = new URLSearchParams(window.location.search);
        if (params.get('login') === 'true') {
            const authModal = document.getElementById('authModal');
            if (authModal) authModal.classList.add('active');
        }

        localStorage.removeItem("user");
    }
});

// --- 2. Product Management ---
async function loadProducts() {
    const container = document.getElementById('products');
    const loading = document.getElementById('loadingIndicator');
    if (!container) return;

    try {
        if (loading) loading.style.display = 'block';
        const snapshot = await getDocs(collection(db, 'products'));
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(allProducts);
    } catch (err) {
        console.error('Error loading products:', err);
        if (container) container.innerHTML = `<p class="error">Failed to load products items.</p>`;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderProducts(productsToRender) {
    const container = document.getElementById('products');
    if (!container) return;

    container.innerHTML = '';
    const validProducts = productsToRender.filter(p => p.name);

    if (validProducts.length === 0) {
        container.innerHTML = '<p class="no-products">No products matched your search.</p>';
        return;
    }

    const productsToDisplay = validProducts.slice(0, 8);
    productsToDisplay.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.setProperty('--i', index);
        card.innerHTML = `
            <div class="product-image-container">
                <a href="product.html?id=${data.id}">
                    <img class="product-image" src="${( (Array.isArray(data.image) ? data.image[0] : (Array.isArray(data.images) ? data.images[0] : (data.image || data.image1 || 'https://via.placeholder.com/300'))) ).toString().trim().replace('cloundinary', 'cloudinary')}" alt="${data.name}">
                </a>
                <button class="wishlist-toggle-btn" title="Add to Wishlist">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <a href="product.html?id=${data.id}" style="text-decoration: none; color: inherit;">
                    <h3 class="product-title">${data.name}</h3>
                </a>
                <p class="product-price">₹${Number(data.price).toFixed(2)}</p>
                <button class="add-to-cart-btn btn primary-btn w-100 addBtn" data-id="${data.id}">Add to Bag</button>
            </div>`;

        // Card Interaction
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.addBtn') && !e.target.closest('.wishlist-toggle-btn') && !e.target.closest('a')) {
                window.location.href = `product.html?id=${data.id}`;
            }
        });

        const addBtn = card.querySelector('.addBtn');
        const wishlistBtn = card.querySelector('.wishlist-toggle-btn');
        const heartIcon = wishlistBtn.querySelector('i');

        // Initial wishlist state
        if (wishlist.some(item => item.id === data.id)) {
            wishlistBtn.classList.add('active');
            heartIcon.classList.remove('fa-regular');
            heartIcon.classList.add('fa-solid');
        }

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(data);
            addBtn.innerText = 'Added!';
            setTimeout(() => addBtn.innerText = 'Add to Bag', 1000);
        });

        wishlistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWishlist(data, wishlistBtn);
        });

        container.appendChild(card);
    });

    // Add "Explore All" button if there are more products
    if (validProducts.length > 8) {
        const moreBtnContainer = document.createElement('div');
        moreBtnContainer.className = 'w-100 text-center mt-3';
        moreBtnContainer.style.gridColumn = '1 / -1';
        moreBtnContainer.innerHTML = `
            <a href="shop.html" class="btn secondary-btn" style="min-width: 250px; border-radius: 40px; padding: 1rem 3rem;">
                Explore All Products <i class="fa-solid fa-arrow-right"></i>
            </a>
        `;
        container.appendChild(moreBtnContainer);
    }
}

function toggleWishlist(product, btn) {
    const idx = wishlist.findIndex(item => item.id === product.id);
    const heartIcon = btn.querySelector('i');
    
    if (idx > -1) {
        // Remove from wishlist
        wishlist.splice(idx, 1);
        btn.classList.remove('active');
        heartIcon.classList.add('fa-regular');
        heartIcon.classList.remove('fa-solid');
    } else {
        // Add to wishlist
        wishlist.push(product);
        btn.classList.add('active');
        heartIcon.classList.remove('fa-regular');
        heartIcon.classList.add('fa-solid');
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    console.log('Wishlist updated. Current count:', wishlist.length);
}

// --- 3. Shopping Bag (Cart) Management ---
function addToCart(product, size = null) {
    const existing = cart.find(item => item.id === product.id && item.size === size);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1, size });
    }
    saveCart();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItems');
    const totalDisplay = document.getElementById('cartTotalValue');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.innerText = totalCount;

    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your bag is empty.</p>';
        if (totalDisplay) totalDisplay.innerText = '₹0.00';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    cartItemsContainer.innerHTML = '';
    let subtotal = 0;

    cart.forEach((item, idx) => {
        subtotal += item.price * item.quantity;
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <img src="${( (Array.isArray(item.image) ? item.image[0] : (Array.isArray(item.images) ? item.images[0] : (item.image || item.image1 || 'https://via.placeholder.com/300'))) ).toString().trim().replace('cloundinary', 'cloudinary')}" alt="${item.name}">
            <div class="cart-item-info">
                <h4>${item.name} ${item.size ? `(${item.size})` : ''}</h4>
                <p>₹${item.price} x ${item.quantity}</p>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="window._changeQty(${idx}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="window._changeQty(${idx}, 1)">+</button>
                    <button class="remove-btn" onclick="window._removeItem(${idx})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(el);
    });

    if (totalDisplay) totalDisplay.innerText = `₹${subtotal.toFixed(2)}`;
    if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.onclick = () => {
            window.location.href = auth.currentUser ? 'address.html' : 'index.html?login=true';
        };
    }
}

// Global scope helpers for onclick handlers
window._changeQty = (idx, delta) => {
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    saveCart();
};

window._removeItem = (idx) => {
    cart.splice(idx, 1);
    saveCart();
};

window._addToCartGlobal = (product) => addToCart(product);
window._toggleWishlistGlobal = (product, btn) => toggleWishlist(product, btn);

// --- 4. Main Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();

    // User Profile Dropdown Toggle
    const userDropdownBtn = document.getElementById('userDropdownBtn');
    const userGreeting = document.getElementById('userGreeting');
    if (userDropdownBtn && userGreeting) {
        userDropdownBtn.onclick = (e) => {
            e.stopPropagation();
            userGreeting.classList.toggle('active');
        };
        // Close when clicking outside
        document.addEventListener('click', () => userGreeting.classList.remove('active'));
    }

    // --- Mobile Drawer Logic ---
    const menuToggle = document.getElementById('menuToggle');
    const navDrawer = document.getElementById('navDrawer');
    const navOverlay = document.getElementById('navOverlay');
    const loginLink = document.getElementById('loginLink');

    if (menuToggle && navDrawer && navOverlay) {
        const toggleDrawer = () => {
            navDrawer.classList.toggle('active');
            navOverlay.classList.toggle('active');
            document.body.style.overflow = navDrawer.classList.contains('active') ? 'hidden' : '';
        };

        menuToggle.onclick = toggleDrawer;
        navOverlay.onclick = toggleDrawer;

        // Close drawer on link click
        navDrawer.querySelectorAll('a').forEach(link => {
            link.onclick = (e) => {
                if (link.id !== 'loginLink') toggleDrawer();
            };
        });

        if (loginLink) {
            loginLink.onclick = (e) => {
                e.preventDefault();
                toggleDrawer();
                isLoginMode = true;
                updateAuthView();
                authModal.classList.add('active');
            };
        }

        // Desktop Dropdown Toggle
        const userDropdownBtn = document.getElementById('userDropdownBtn');
        const userGreeting = document.getElementById('userGreeting');

        if (userDropdownBtn && userGreeting) {
            userDropdownBtn.onclick = (e) => {
                e.stopPropagation();
                userGreeting.classList.toggle('active');
                console.log("Desktop Dropdown Toggled");
            };
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!userGreeting.contains(e.target)) {
                    userGreeting.classList.remove('active');
                }
            });
        }
    }

    // Google Sign-In Button Explicit Listener
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
        googleBtn.onclick = (e) => {
            e.preventDefault();
            console.log("Initiating Google Sign-In...");
            window.loginWithGoogle();
        };
    }

    // Modal Visibility
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const authModal = document.getElementById('authModal');
    const cartToggles = document.querySelectorAll('.cart-toggle');
    const cartModal = document.getElementById('cartModal');

    if (loginBtn) loginBtn.onclick = () => {
        isLoginMode = true;
        updateAuthView();
        authModal.classList.add('active');
    };
    if (signupBtn) signupBtn.onclick = () => {
        isLoginMode = false;
        updateAuthView();
        authModal.classList.add('active');
    };

    if (cartToggles && cartModal) {
        cartToggles.forEach(toggle => {
            toggle.onclick = (e) => {
                e.preventDefault();
                // Close nav drawer if open
                const navDrawer = document.getElementById('navDrawer');
                if (navDrawer && navDrawer.classList.contains('active')) {
                    const toggleDrawer = window.toggleDrawer; 
                    // toggleDrawer is local to DOMContentLoaded but available via window if we set it
                    if (toggleDrawer) toggleDrawer();
                }
                cartModal.classList.add('active');
            };
        });
    }

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => btn.closest('.modal').classList.remove('active');
    });

    // Login/Signup Toggle
    let isLoginMode = true;
    const authSwitchBtn = document.getElementById('authSwitchBtn');
    function updateAuthView() {
        document.getElementById('authTitle').innerText = isLoginMode ? 'Sign In' : 'Create Account';
        document.getElementById('authSubmitBtn').innerText = isLoginMode ? 'Login' : 'Signup';
        document.getElementById('nameGroup').style.display = isLoginMode ? 'none' : 'block';
    }
    if (authSwitchBtn) {
        authSwitchBtn.onclick = () => {
            isLoginMode = !isLoginMode;
            updateAuthView();
        };
    }

    // Auth Form Submit
    const authForm = document.getElementById('authForm');
    const errorDiv = document.getElementById('authError');
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const submitBtn = document.getElementById('authSubmitBtn');
            const errorDiv = document.getElementById('authError');
            
            submitBtn.disabled = true;
            submitBtn.innerText = isLoginMode ? 'Signing In...' : 'Creating Account...';
            
            try {
                if (isLoginMode) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const name = document.getElementById('authName').value;
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    await updateProfile(res.user, { displayName: name });
                    
                    // --- Send Verification Email ---
                    await sendEmailVerification(res.user);
                    alert("Account created! A verification email has been sent to " + email + ". Please verify your address to access all features.");
                }
                authModal.classList.remove('active');
                window.location.reload(); 
            } catch (err) {
                if (errorDiv) errorDiv.innerText = err.message.replace("Firebase:", "");
                submitBtn.disabled = false;
                submitBtn.innerText = isLoginMode ? 'Login' : 'Signup';
            }
        };
    }

    // --- PHONE AUTH LOGIC ---
    let confirmationResult = null;
    const phoneModal = document.getElementById('phoneAuthModal');
    const phoneInput = document.getElementById('phoneNumber');
    const sendOTPBtn = document.getElementById('sendOTPBtn');
    const verifyOTPBtn = document.getElementById('verifyOTPBtn');
    const otpCodeInput = document.getElementById('otpCode');
    const phoneInputSection = document.getElementById('phoneInputSection');
    const otpSection = document.getElementById('otpSection');
    const phoneSwitchBtn = document.getElementById('phoneSignInSwitchBtn');
    const emailAuthSwitchBtn = document.getElementById('emailAuthSwitchBtn');

    // reCAPTCHA initialization
    function initRecaptcha() {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log("reCAPTCHA solved");
                }
            });
        }
    }

    // Switch from Email to Phone
    if (phoneSwitchBtn) {
        phoneSwitchBtn.onclick = () => {
            authModal.classList.remove('active');
            if (phoneModal) phoneModal.classList.add('active');
            initRecaptcha();
        };
    }

    // Switch from Phone back to Email
    if (emailAuthSwitchBtn) {
        emailAuthSwitchBtn.onclick = (e) => {
            e.preventDefault();
            if (phoneModal) phoneModal.classList.remove('active');
            authModal.classList.add('active');
        };
    }

    // Phone input validation
    if (phoneInput) {
        phoneInput.oninput = (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val;
            if (sendOTPBtn) sendOTPBtn.disabled = val.length !== 10;
        };
    }

    // Send OTP
    if (sendOTPBtn) {
        sendOTPBtn.onclick = async () => {
            const phone = document.getElementById('phoneNumber').value;
            const fullPhone = "+91" + phone;
            
            sendOTPBtn.disabled = true;
            sendOTPBtn.innerText = "Sending...";
            
            try {
                initRecaptcha();
                const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
                confirmationResult = result;
                
                // Switch UI to OTP mode
                phoneInputSection.style.display = 'none';
                otpSection.style.display = 'block';
                document.getElementById('sentNumber').innerText = fullPhone;
                console.log("OTP Sent Successfully.");
            } catch (err) {
                console.error("Phone Auth Error:", err);
                alert("Failed to send OTP: " + err.message);
                sendOTPBtn.disabled = false;
                sendOTPBtn.innerText = "Send One-Time Password";
                if (window.recaptchaVerifier) window.recaptchaVerifier.render().then(id => grecaptcha.reset(id));
            }
        };
    }

    // Verify OTP
    if (verifyOTPBtn) {
        verifyOTPBtn.onclick = async () => {
            const code = otpCodeInput.value.trim();
            if (code.length !== 6) return alert("Please enter the 6-digit code.");
            
            verifyOTPBtn.disabled = true;
            verifyOTPBtn.innerText = "Verifying...";
            
            try {
                const res = await confirmationResult.confirm(code);
                console.log("Phone Auth SUCCESS:", res.user.uid);
                localStorage.setItem("user", JSON.stringify({
                    uid: res.user.uid,
                    name: "User (" + res.user.phoneNumber + ")"
                }));
                phoneModal.classList.remove('active');
                window.location.reload();
            } catch (err) {
                console.error("OTP Verification Error:", err);
                alert("Invalid verification code. Please try again.");
                verifyOTPBtn.disabled = false;
                verifyOTPBtn.innerText = "Verify & Login";
            }
        };
    }

    // Resend OTP
    const resendOTPBtn = document.getElementById('resendOTPBtn');
    if (resendOTPBtn) {
        resendOTPBtn.onclick = () => {
            otpSection.style.display = 'none';
            phoneInputSection.style.display = 'block';
            sendOTPBtn.disabled = false;
            sendOTPBtn.innerText = "Send One-Time Password";
        };
    }

    // Search Interaction
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
        // Search on Enter
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const term = e.target.value.trim();
                if (term) window.location.href = `search.html?q=${encodeURIComponent(term)}`;
            }
        };

        // Search on Button Click
        if (searchBtn) {
            searchBtn.onclick = () => {
                const term = searchInput.value.trim();
                if (term) window.location.href = `search.html?q=${encodeURIComponent(term)}`;
            };
        }
    }

    // Category Filtering
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.onclick = () => {
            const filter = item.getAttribute('data-filter');
            
            // UI Update
            categoryItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Data Filter
            if (filter === 'all') {
                renderProducts(allProducts);
            } else {
                const filtered = allProducts.filter(p => 
                    p.category?.toLowerCase() === filter.toLowerCase()
                );
                renderProducts(filtered);
            }
        };
    });

    // --- Global Event Delegation for Dynamic Elements ---
    document.addEventListener('click', async (e) => {
        const logoutBtn = e.target.closest('#logoutBtnDropdown, #logoutBtnProfile, #logoutBtnDrawer');
        if (!logoutBtn) return;

        e.preventDefault();
        console.log("Logout triggered via:", logoutBtn.id);
        const originalContent = logoutBtn.innerHTML;
        logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        logoutBtn.disabled = true;

        try {
            await signOut(auth);
            localStorage.removeItem("user");
            console.log("Firebase SignOut successful. Redirecting...");
            window.location.href = 'index.html';
        } catch (err) {
            console.error("Logout error:", err);
            logoutBtn.innerHTML = originalContent;
            logoutBtn.disabled = false;
            alert("Logging out failed. Please check your connection.");
        }
    });

    // --- PROTECTED LINKS INTERCEPTOR ---
    document.addEventListener('click', (e) => {
        const ordersLink = e.target.closest('a[href="orders.html"], a[href^="orders.html"]');
        const profileLink = e.target.closest('a[href="profile.html"], a[href^="profile.html"], a[href="address.html"]');
        
        if (ordersLink || profileLink) {
            // Check Firebase Auth state
            if (!auth.currentUser) {
                e.preventDefault();
                console.log("Interception: User not logged in, opening Auth Modal.");
                
                const authModal = document.getElementById('authModal');
                if (authModal) {
                    authModal.classList.add('active');
                } else {
                    // Fallback if modal is missing (should not happen after recent fixes)
                    window.location.href = 'index.html?login=true';
                }
            }
        }
    });
});

// --- 5. Global Helpers for Popups ---
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    console.log("Starting Google Sign-In popup...");
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Google Login SUCCESS:", result.user.email);
        localStorage.setItem("user", JSON.stringify({
            uid: result.user.uid,
            name: result.user.displayName || result.user.email
        }));
        window.location.reload(); 
    } catch (err) {
        console.error("Google Sign-In Error:", err);
        if (err.code === "auth/unauthorized-domain") {
            alert("Error: Unauthorized Domain. Please add '" + window.location.hostname + "' to Firebase Console -> Auth -> Settings -> Authorized Domains.");
        } else if (err.code === "auth/popup-closed-by-user") {
            console.log("User closed the popup.");
        } else {
            alert("Login Failed: " + err.message);
        }
    }
};