import { db, auth } from '../firebase.js';
import { collection, getDocs } from "firebase/firestore";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
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
    const logoutBtnDropdown = document.getElementById("logoutBtnDropdown");

    if (user) {
        // ✅ User is logged in
        if (guestBtns) guestBtns.style.display = "none";
        if (userGreeting) userGreeting.style.display = "flex";

        if (userNameDisplay) {
            userNameDisplay.innerText = user.displayName || user.email;
        }

        // Standard Session Cache
        localStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User'
        }));

        // 🔥 Logic for handling mandatory redirects
        const onSignupPage = window.location.pathname.includes('signup.html');
        const inLoginModal = window.location.search.includes('login=true');
        
        if (onSignupPage || inLoginModal) {
             window.location.href = "index.html"; 
             return;
        }

        // Attach Logout Event
        if (logoutBtnDropdown) {
            logoutBtnDropdown.onclick = () => {
                signOut(auth).then(() => {
                    localStorage.removeItem("user");
                    window.location.href = 'index.html';
                });
            };
        }

    } else {
        // ❌ User is logged out
        if (guestBtns) guestBtns.style.display = "flex";
        if (userGreeting) userGreeting.style.display = "none";

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
                    <img class="product-image" src="${data.image || 'https://via.placeholder.com/300'}" alt="${data.name}">
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
            <img src="${item.image}" alt="${item.name}">
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

    // Menu Toggle
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if (menuToggle && navLinks) {
        menuToggle.onclick = () => navLinks.classList.toggle('active');
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
    const cartBtn = document.getElementById('cartBtn');
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
    if (cartBtn) cartBtn.onclick = () => cartModal.classList.add('active');

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
            try {
                if (isLoginMode) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const name = document.getElementById('authName').value;
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    await updateProfile(res.user, { displayName: name });
                }
                authModal.classList.remove('active');
                window.location.reload(); // Refresh to catch profile update
            } catch (err) {
                if (errorDiv) errorDiv.innerText = err.message.replace("Firebase:", "");
            }
        };
    }

    // Search Interaction
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const term = e.target.value.trim();
                if (term) window.location.href = `search.html?q=${encodeURIComponent(term)}`;
            }
        };
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
        const logoutBtn = e.target.closest('#logoutBtnDropdown, #logoutBtnProfile');
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