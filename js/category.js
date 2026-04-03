import { db } from '../firebase.js';
import { collection, getDocs, query, where } from "firebase/firestore";
import { renderProductsGrid } from './ui-helpers.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('type');
    const container = document.getElementById('products');
    const loading = document.getElementById('loadingIndicator');
    const categoryTitle = document.getElementById('categoryTitle');

    if (!category) {
        window.location.href = 'index.html';
        return;
    }

    categoryTitle.innerText = category.charAt(0).toUpperCase() + category.slice(1);

    // Global toggle and add-to-cart for the helpers
    window._toggleWishlistGlobal = (product, btn) => {
        let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        const idx = wishlist.findIndex(item => item.id === product.id);
        const heartIcon = btn.querySelector('i');
        
        if (idx > -1) {
            wishlist.splice(idx, 1);
            btn.classList.remove('active');
            heartIcon.classList.add('fa-regular');
            heartIcon.classList.remove('fa-solid');
        } else {
            wishlist.push(product);
            btn.classList.add('active');
            heartIcon.classList.remove('fa-regular');
            heartIcon.classList.add('fa-solid');
        }
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
    };

    window._addToCartGlobal = (product) => {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
    };

    async function loadCategoryProducts() {
        try {
            loading.style.display = 'block';
            const q = query(collection(db, 'products'), where('category', '==', category));
            const snapshot = await getDocs(q);
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
            renderProductsGrid(products, container, wishlist);
        } catch (err) {
            console.error('Error loading products:', err);
            if (container) container.innerHTML = `<p class="error">Failed to load category products.</p>`;
        } finally {
            loading.style.display = 'none';
        }
    }

    loadCategoryProducts();
});
