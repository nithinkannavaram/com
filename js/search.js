import { db } from '../firebase.js';
import { collection, getDocs } from "firebase/firestore";
import { renderProductsGrid } from './ui-helpers.js';

const urlParams = new URLSearchParams(window.location.search);
const queryTerm = (urlParams.get('q') || "").toLowerCase().trim();
const container = document.getElementById('products');
const loading = document.getElementById('loadingIndicator');

// Visual Log for Debugging (since we can't see the console)
function debugLog(msg) {
    console.log(msg);
    // Optionally uncomment to show on screen if needed
    // if(container) container.innerHTML += `<div style="font-size:10px; color:gray">${msg}</div>`;
}

async function performSearch() {
    if (!container) return;
    
    try {
        debugLog("Search started for: " + queryTerm);
        if (loading) loading.style.display = 'block';
        container.innerHTML = '';
        
        // Add a timeout to getDocs
        const fetchPromise = getDocs(collection(db, 'products'));
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Firestore Timeout")), 8000)
        );

        debugLog("Fetching products from Firestore...");
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        debugLog("Fetch successful. Docs found: " + snapshot.docs.length);

        const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const matchedProducts = allProducts.filter(p => {
            // If queryTerm is somehow empty or too short, return no matches instead of all
            if (queryTerm.length < 2) return false;

            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const description = (p.description || '').toLowerCase();
            
            // Check if the search term exists in name, category, or description
            return name.includes(queryTerm) || 
                   category.includes(queryTerm) || 
                   description.includes(queryTerm);
        });

        debugLog("Matches found: " + matchedProducts.length);

        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        
        if (matchedProducts.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="text-align: center; padding: 3rem; width: 100%;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 4rem; color: #ddd; margin-bottom: 1rem;"></i>
                    <h3>No matches found for "${queryTerm}"</h3>
                    <p>Try searching for "shoes", "watch", or "running".</p>
                    <a href="shop.html" class="btn secondary-btn mt-3">Browse all products</a>
                </div>
            `;
        } else {
            renderProductsGrid(matchedProducts, container, wishlist);
        }
    } catch (err) {
        debugLog("Search Error: " + err.message);
        container.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 3rem; width: 100%;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #e74c3c;"></i>
                <h3 class="mt-3">Search Unavailable</h3>
                <p>${err.message === "Firestore Timeout" ? "Database connection timed out." : "Unable to fetch products."}</p>
                <button onclick="location.reload()" class="btn primary-btn mt-3">Try Again</button>
            </div>
        `;
    } finally {
        if (loading) loading.style.display = 'none';
        debugLog("Search finished.");
    }
}

// Global handlers
window._toggleWishlistGlobal = (product, btn) => {
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const idx = wishlist.findIndex(item => item.id === product.id);
    if (idx > -1) {
        wishlist.splice(idx, 1);
        btn.classList.remove('active');
        btn.querySelector('i').className = 'fa-regular fa-heart';
    } else {
        wishlist.push(product);
        btn.classList.add('active');
        btn.querySelector('i').className = 'fa-solid fa-heart';
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

if (queryTerm) {
    performSearch();
} else {
    if (loading) loading.style.display = 'none';
    container.innerHTML = '<p style="text-align: center; padding: 2rem; width: 100%;">What can we find for you today?</p>';
}
