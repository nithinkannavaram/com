import { db } from '../firebase.js';
import { collection, getDocs } from "firebase/firestore";
import { renderProductsGrid } from './ui-helpers.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTerm = urlParams.get('q')?.toLowerCase() || "";
    const container = document.getElementById('products');
    const loading = document.getElementById('loadingIndicator');

    // Reuse the same global handlers as other pages
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

    async function performSearch() {
        try {
            loading.style.display = 'block';
            const snapshot = await getDocs(collection(db, 'products'));
            const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const matchedProducts = allProducts.filter(p => 
                p.name.toLowerCase().includes(queryTerm) || 
                (p.category && p.category.toLowerCase().includes(queryTerm))
            );

            const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
            renderProductsGrid(matchedProducts, container, wishlist);
        } catch (err) {
            console.error('Error during search:', err);
            container.innerHTML = `<p class="error">Search failed. Please try again.</p>`;
        } finally {
            loading.style.display = 'none';
        }
    }

    performSearch();
});
