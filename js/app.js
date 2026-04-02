import { db, auth } from '../firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

console.log('Firebase initialized, loading products...');

// --- Cart Logic State ---
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
        const snapshot = await getDocs(collection(db, 'products'));
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-products">No products found.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; // Store document ID to prevent duplicates in cart
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img class="product-image" src="${data.image || 'https://via.placeholder.com/150'}" alt="${data.name}">
                <div class="product-info">
                    <h3 class="product-title">${data.name}</h3>
                    <p class="product-price">₹${Number(data.price).toFixed(2)}</p>
                    <button class="add-to-cart-btn btn primary-btn">Add to Cart</button>
                </div>`;
                
            // Bind Add to Cart action
            const addBtn = card.querySelector('.add-to-cart-btn');
            addBtn.addEventListener('click', () => {
                const existingItem = cart.find(item => item.id === data.id);
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({ ...data, quantity: 1 });
                }
                saveAndRenderCart();
                
                // Optional: visual feedback
                addBtn.innerText = 'Added!';
                setTimeout(() => addBtn.innerText = 'Add to Cart', 1000);
            });
            
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading products:', err);
        if (loading) {
            loading.innerHTML = '<p class="error">Failed to load products.</p>';
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.innerHTML = '<p>Loading products...</p>';
    updateCartUI(); // Initialize cart UI from localStorage
    loadProducts();

    // --- Theme Toggle Logic ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const currentTheme = localStorage.getItem('theme') || 'dark'; // Default to dark Antigravity theme
    
    // Initial load
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
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
    const verificationCodeInput = document.getElementById('verificationCode');
    const phoneNumberGroup = document.getElementById('phoneNumberGroup');
    const otpGroup = document.getElementById('otpGroup');
    
    let isLoginMode = true;

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
                document.getElementById('authError').innerText = error.message.replace("Firebase: ", "");
            }
        });
    }

    // Phone Auth Logic
    if (phoneSignInSwitchBtn) {
        phoneSignInSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authForm.style.display = 'none';
            const divider = document.querySelector('.auth-divider');
            if (divider) divider.style.display = 'none';
            googleSignInBtn.style.display = 'none';
            phoneSignInSwitchBtn.style.display = 'none';
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'none';
            
            phoneAuthSection.style.display = 'block';
            document.getElementById('authTitle').innerText = 'Phone Login';
            document.getElementById('authError').innerText = '';

            // Setup Recaptcha
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': (response) => {
                        // reCAPTCHA solved
                    }
                });
                window.recaptchaVerifier.render().catch(err => {
                    console.error("Recaptcha Render Error: ", err);
                });
            }
        });
    }

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            const errorDiv = document.getElementById('authError');
            errorDiv.innerText = '';
            const countryCode = document.getElementById('countryCode').value;
            const purePhoneNumber = phoneNumberInput.value.trim();
            const phoneNumber = `${countryCode}${purePhoneNumber}`;
            const appVerifier = window.recaptchaVerifier;

            if (!purePhoneNumber) {
                errorDiv.innerText = "Please enter a valid phone number.";
                return;
            }

            try {
                window.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
                phoneNumberGroup.style.display = 'none';
                document.getElementById('recaptcha-container').style.display = 'none';
                otpGroup.style.display = 'block';
            } catch (error) {
                console.error("SMS Error: ", error);
                errorDiv.innerText = error.message.replace("Firebase: ", "");
            }
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const errorDiv = document.getElementById('authError');
            errorDiv.innerText = '';
            const code = verificationCodeInput.value.trim();
            
            if (!code) {
                errorDiv.innerText = "Please enter the verification code.";
                return;
            }

            try {
                const result = await window.confirmationResult.confirm(code);
                // User signed in successfully.
                authModal.classList.remove('active');
                
                // Reset form state for next time
                phoneAuthSection.style.display = 'none';
                otpGroup.style.display = 'none';
                phoneNumberGroup.style.display = 'block';
                document.getElementById('recaptcha-container').style.display = 'block';
                
            } catch (error) {
                console.error("Verification Error: ", error);
                errorDiv.innerText = error.message.replace("Firebase: ", "");
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
                userNameDisplay.innerText = user.displayName || user.email.split('@')[0];
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