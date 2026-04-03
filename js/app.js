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
    signInWithPhoneNumber
} from "firebase/auth";

console.log('Firebase initialized, loading products...');

// --- Site State ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const checkoutBtn = document.getElementById('checkoutBtn');

    // Update notification bubble
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.innerText = totalItems;

    // Remove existing listener to prevent duplicates
    if (checkoutBtn) {
        const newCheckoutBtn = checkoutBtn.cloneNode(true);
        checkoutBtn.parentNode.replaceChild(newCheckoutBtn, checkoutBtn);
    }

    const currentCheckoutBtn = document.getElementById('checkoutBtn');

    // Update items list
    if (cartItemsContainer) {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your cart is empty.</p>';
            if (checkoutBtn) checkoutBtn.disabled = true;
            if (cartTotalValue) cartTotalValue.innerText = '₹0.00';
            return;
        }

        cartItemsContainer.innerHTML = '';
        let totalCost = 0;

        cart.forEach((item, index) => {
            totalCost += item.price * item.quantity;
            const cartItemEl = document.createElement('div');
            cartItemEl.className = 'cart-item';
            cartItemEl.innerHTML = `
                <img src="${item.image || 'https://via.placeholder.com/60'}" alt="${item.name}">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <p class="cart-item-price">₹${Number(item.price).toFixed(2)}</p>
                    <div class="cart-item-actions">
                        <button class="qty-btn minus-btn" data-index="${index}">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn plus-btn" data-index="${index}">+</button>
                        <button class="remove-btn" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            cartItemsContainer.appendChild(cartItemEl);
        });

        if (cartTotalValue) cartTotalValue.innerText = `₹${totalCost.toFixed(2)}`;
        if (currentCheckoutBtn) {
            currentCheckoutBtn.disabled = false;
            currentCheckoutBtn.addEventListener('click', () => {
                if (auth.currentUser) {
                    window.location.href = 'address.html';
                } else {
                    document.getElementById('cartModal').classList.remove('active');
                    document.getElementById('authModal').classList.add('active');
                }
            });
        }

        // Attach listeners to newly created buttons
        document.querySelectorAll('.minus-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                if (cart[idx].quantity > 1) {
                    cart[idx].quantity -= 1;
                } else {
                    cart.splice(idx, 1);
                }
                saveAndRenderCart();
            });
        });

        document.querySelectorAll('.plus-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                cart[idx].quantity += 1;
                saveAndRenderCart();
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                cart.splice(idx, 1);
                saveAndRenderCart();
            });
        });
    }
}

function saveAndRenderCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

/**
 * Load products from Firestore and render them into the #products container.
 */
async function loadProducts() {
    const container = document.getElementById('products');
    const loading = document.getElementById('loadingIndicator');
    if (!container) {
        console.error('Product container not found');
        return;
    }
    try {
        if (loading) loading.style.display = 'block';
        const snapshot = await getDocs(collection(db, 'products'));
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(allProducts);
    } catch (err) {
        console.error('Error loading products:', err);
        if (container) {
            container.innerHTML = '<p class="error">Failed to load products. Please check your connection.</p>';
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderProducts(productsToRender) {
    const container = document.getElementById('products');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Filter out truly empty/invalid documents
    const validProducts = productsToRender.filter(p => p.name);
    
    if (validProducts.length === 0) {
        container.innerHTML = '<p class="no-products">No products found matching your criteria.</p>';
        return;
    }

    validProducts.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.setProperty('--i', index);
        card.innerHTML = `
            <div class="product-image-container">
                <img class="product-image" src="${data.image || 'https://placehold.co/600x600/FDF8EE/8C6339?text=Product'}" alt="${data.name || 'No Brand'}">
            </div>
            <div class="product-info">
                <h3 class="product-title">${data.name || 'Anonymous Product'}</h3>
                <p class="product-price">₹${Number(data.price || 0).toFixed(2)}</p>
                <button class="add-to-cart-btn btn primary-btn w-100">Add to Bag</button>
            </div>`;

            
        const addBtn = card.querySelector('.add-to-cart-btn');
        addBtn.addEventListener('click', () => {
            const existingItem = cart.find(item => item.id === data.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ ...data, quantity: 1 });
            }
            saveAndRenderCart();
            
            addBtn.innerText = 'In Bag!';
            setTimeout(() => addBtn.innerText = 'Add to Bag', 1000);
        });
        
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.innerHTML = '<p>Loading products...</p>';
    updateCartUI(); // Initialize cart UI from localStorage
    loadProducts();

    // --- Filtering & Search Logic ---
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');

    function performSearch() {
        const term = searchInput.value.toLowerCase().trim();
        const filtered = allProducts.filter(p => 
            (p.name && p.name.toLowerCase().includes(term)) || 
            (p.category && p.category.toLowerCase().includes(term))
        );
        renderProducts(filtered);
    }

    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.getAttribute('data-filter');
            if (category === 'all') {
                renderProducts(allProducts);
            } else {
                const filtered = allProducts.filter(p => 
                    p.category && p.category.toLowerCase() === category.toLowerCase()
                );
                renderProducts(filtered);
            }
        });
    });

    // --- Hamburger Menu Logic ---
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            menuToggle.innerHTML = navLinks.classList.contains('active')
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-bars"></i>';
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
                navLinks.classList.remove('active');
                menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            });
        });
    }

    // --- Cart Modal Logic ---
    const cartBtn = document.getElementById('cartBtn');
    const cartModal = document.getElementById('cartModal');
    if (cartBtn && cartModal) {
        cartBtn.addEventListener('click', () => {
            cartModal.classList.add('active');
        });
    }

    // --- Authentication Logic ---
    const authModal = document.getElementById('authModal');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeBtns = document.querySelectorAll('.close-btn');
    const authForm = document.getElementById('authForm');
    const authSwitchBtn = document.getElementById('authSwitchBtn');
    const googleSignInBtn = document.getElementById('googleSignInBtn');

    // Phone Auth Elements
    const phoneSignInSwitchBtn = document.getElementById('phoneSignInSwitchBtn');
    const phoneAuthSection = document.getElementById('phoneAuthSection');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const phoneNumberInput = document.getElementById('phoneNumber');
    const otpInput = document.getElementById('otpInput');
    const phoneNumberGroup = document.getElementById('phoneNumberGroup');
    const otpGroup = document.getElementById('otpGroup');

    let isLoginMode = true;

    // Auto-open login modal if redirected with ?login=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true' && authModal) {
        authModal.classList.add('active');
    }

    // Open Modal
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            authModal.classList.add('active');

            // Reset to default email view
            authForm.style.display = 'block';
            const divider = document.querySelector('.auth-divider');
            if (divider) divider.style.display = 'flex';
            if (googleSignInBtn) googleSignInBtn.style.display = 'block';
            if (phoneSignInSwitchBtn) phoneSignInSwitchBtn.style.display = 'block';
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'block';
            if (phoneAuthSection) phoneAuthSection.style.display = 'none';
        });
    }

    // Close Modals
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });

    // Switch between Login and Register
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            document.getElementById('authTitle').innerText = isLoginMode ? 'Login' : 'Register';
            document.getElementById('authSubmitBtn').innerText = isLoginMode ? 'Login' : 'Register';
            document.getElementById('authSwitchText').innerText = isLoginMode ? "Don't have an account?" : 'Already have an account?';
            authSwitchBtn.innerText = isLoginMode ? 'Register' : 'Login';
            document.getElementById('nameGroup').style.display = isLoginMode ? 'none' : 'block';
            document.getElementById('authError').innerText = '';
        });
    }

    // Handle Form Submit (Email/Password)
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const errorDiv = document.getElementById('authError');
            errorDiv.innerText = '';

            try {
                if (isLoginMode) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const name = document.getElementById('authName').value;
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    await updateProfile(res.user, { displayName: name });
                }
                authModal.classList.remove('active');
                authForm.reset();
            } catch (error) {
                console.error("Auth error:", error);
                errorDiv.innerText = error.message.replace("Firebase: ", "");
                errorDiv.classList.add('active');
            }
        });
    }

    // Handle Google Sign-In
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            document.getElementById('authError').innerText = '';
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                authModal.classList.remove('active');
            } catch (error) {
                console.error("Google auth error:", error);
                const errorDiv = document.getElementById('authError');
                errorDiv.innerText = error.message.replace("Firebase: ", "");
                errorDiv.classList.add('active');
            }
        });
    }

    // Phone Authentication Integration Logic
    if (phoneSignInSwitchBtn) {
        phoneSignInSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authForm.style.display = 'none';
            const divider = document.querySelector('.auth-divider');
            if (divider) divider.style.display = 'none';
            if (googleSignInBtn) googleSignInBtn.style.display = 'none';
            phoneSignInSwitchBtn.style.display = 'none';
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'none';

            phoneAuthSection.style.display = 'block';
            document.getElementById('authTitle').innerText = 'Phone Login';
            const errorDiv = document.getElementById('authError');
            if (errorDiv) {
                errorDiv.innerText = '';
                errorDiv.classList.remove('active');
            }
        });
    }

    // --- Phone Authentication Implementation ---
    let timerInterval = null;

    function startTimer() {
        const timerCount = document.getElementById('timerCount');
        const countdownArea = document.getElementById('countdownArea');
        const resendOtpBtn = document.getElementById('resendOtpBtn');
        
        let timeLeft = 60;
        if (countdownArea) countdownArea.style.display = 'block';
        if (resendOtpBtn) resendOtpBtn.style.display = 'none';

        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            if (timerCount) timerCount.innerText = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (countdownArea) countdownArea.style.display = 'none';
                if (resendOtpBtn) resendOtpBtn.style.display = 'block';
            }
        }, 1000);
    }

    let recaptchaVerifier;

    function setupRecaptcha() {
        if (!recaptchaVerifier && auth) {
            recaptchaVerifier = new RecaptchaVerifier(auth, 'sendOtpBtn', {
                'size': 'invisible'
            });
            recaptchaVerifier.render().then(() => {
                console.log("reCAPTCHA rendered");
            });
        }
    }

    window.onload = function() {
        setupRecaptcha();
    };

    function sendOTP() {
        const phoneInput = document.getElementById('phone');
        const errorDiv = document.getElementById('authError');
        
        if (errorDiv) {
            errorDiv.innerText = '';
            errorDiv.classList.remove('active');
        }

        const inputNumber = phoneInput ? phoneInput.value.trim() : '';
        const phoneNumber = "+91" + inputNumber;

        if (!inputNumber || inputNumber.length < 10) {
            if (errorDiv) {
                errorDiv.innerText = "Please enter a valid 10-digit phone number.";
                errorDiv.classList.add('active');
            }
            return;
        }

        // --- Real Firebase Phone Auth (Modular Promise logic) ---
        setupRecaptcha();

        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending SMS...';
        sendOtpBtn.disabled = true;

        signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                alert("OTP Sent!");
                
                phoneNumberGroup.style.display = 'none';
                otpGroup.style.display = 'block';
                const otpInput = document.getElementById('otpInput');
                if (otpInput) otpInput.focus();
                startTimer();
            })
            .catch((error) => {
                console.error("Phone Auth Error: ", error);
                sendOtpBtn.innerHTML = 'Send OTP';
                sendOtpBtn.disabled = false;
                
                let message = error.message.replace("Firebase: ", "");
                if (error.code === 'auth/unauthorized-domain') {
                    message = `Unauthorized Domain: ${window.location.hostname}. Please add this to Firebase Console > Auth > Settings > Authorized Domains.`;
                } else if (error.code === 'auth/quota-exceeded') {
                    message = "SMS Quota Exceeded! Please add this number as a 'Test Phone Number' in the Firebase Console.";
                }
                
                alert(message);
                if (errorDiv) {
                    errorDiv.innerText = message;
                    errorDiv.classList.add('active');
                }
            });
    }

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', () => {
            sendOTP();
        });
    }

    // Handle Resend OTP Click
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', () => {
            if (sendOtpBtn) {
                otpGroup.style.display = 'none';
                phoneNumberGroup.style.display = 'block';
                sendOtpBtn.click(); // Trigger send again
            }
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const errorDiv = document.getElementById('authError');
            errorDiv.innerText = '';
            const code = otpInput.value.trim();

            if (!code) {
                errorDiv.innerText = "Please enter the verification code.";
                errorDiv.classList.add('active');
                return;
            }

            verifyOtpBtn.innerText = 'Verifying...';
            verifyOtpBtn.disabled = true;

            try {
                await window.confirmationResult.confirm(code);
                authModal.classList.remove('active');

                // Cleanup Modal for next opening
                setTimeout(() => {
                    otpGroup.style.display = 'none';
                    phoneNumberGroup.style.display = 'block';
                    sendOtpBtn.innerText = 'Send OTP';
                    sendOtpBtn.disabled = false;
                    verifyOtpBtn.innerText = 'Verify Code';
                    verifyOtpBtn.disabled = false;
                    if (timerInterval) clearInterval(timerInterval);
                }, 500);

            } catch (error) {
                console.error("Verification Error: ", error);
                errorDiv.innerText = "Invalid code. Please try again.";
                errorDiv.classList.add('active');
                verifyOtpBtn.innerText = 'Verify Code';
                verifyOtpBtn.disabled = false;
            }
        });

        otpInput.addEventListener('input', () => {
            if (otpInput.value.trim().length === 6) {
                verifyOtpBtn.click();
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth);
        });
    }

    // Monitor Auth State Changes
    onAuthStateChanged(auth, (user) => {
        const userGreeting = document.getElementById('userGreeting');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const ordersLink = document.getElementById('ordersLink');

        if (user) {
            // User is signed in
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';
            if (userGreeting) {
                userGreeting.style.display = 'block';
                userNameDisplay.innerText = user.displayName || (user.email ? user.email.split('@')[0] : (user.phoneNumber || 'User'));
            }
            if (ordersLink) ordersLink.style.display = 'block';
        } else {
            // User is signed out
            loginBtn.style.display = 'inline-flex';
            logoutBtn.style.display = 'none';
            if (userGreeting) {
                userGreeting.style.display = 'none';
            }
            if (ordersLink) ordersLink.style.display = 'none';
        }
    });
});