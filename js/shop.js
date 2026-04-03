import { db } from "../firebase.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { renderProductsGrid } from "./ui-helpers.js";

document.addEventListener('DOMContentLoaded', async () => {
    const shopProducts = document.getElementById('shopProducts');
    const loading = document.getElementById('loadingIndicator');
    const resultCount = document.getElementById('resultCount');

    if (!shopProducts) return;

    try {
        if (loading) loading.style.display = 'block';
        
        // Fetch all products from 🔥 Firebase
        const q = query(collection(db, "products"), orderBy("name"));
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

        if (loading) loading.style.display = 'none';

        if (products.length === 0) {
            shopProducts.innerHTML = '<p class="no-products">No products found in our collection yet.</p>';
            if (resultCount) resultCount.innerText = '0 products found.';
            return;
        }

        if (resultCount) resultCount.innerText = `Showing all ${products.length} premium products.`;

        // Use central helper for consistent look and feel
        renderProductsGrid(products, shopProducts, wishlist);

    } catch (error) {
        console.error("🔥 Firebase Error:", error);
        if (loading) loading.style.display = 'none';
        if (shopProducts) {
            shopProducts.innerHTML = `<p class='error'>Failed to load our collection. Please check your connection.</p>`;
        }
    }
});
