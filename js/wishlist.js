// Removed unused Firebase imports to prevent module resolution issues if not needed
document.addEventListener('DOMContentLoaded', () => {
    console.log('Wishlist page loaded');
    const wishlistContainer = document.getElementById('wishlistContainer');
    const emptyWishlist = document.getElementById('emptyWishlist');
    
    // Refresh items directly from storage on load
    function getWishlistItems() {
        try {
            return JSON.parse(localStorage.getItem('wishlist')) || [];
        } catch (e) {
            console.error('Error parsing wishlist from storage:', e);
            return [];
        }
    }
    
    let wishlistItems = getWishlistItems();
    console.log('Current wishlist items:', wishlistItems);
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    function renderWishlist() {
        console.log('Rendering wishlist...');
        if (!wishlistContainer) {
            console.error('Wishlist container not found!');
            return;
        }
        
        wishlistItems = getWishlistItems();
        
        if (wishlistItems.length === 0) {
            wishlistContainer.style.display = 'none';
            emptyWishlist.style.display = 'block';
            return;
        }

        wishlistContainer.style.display = 'grid';
        emptyWishlist.style.display = 'none';
        wishlistContainer.innerHTML = '';

        wishlistItems.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'wishlist-card';
            card.style.setProperty('--i', index);
            card.innerHTML = `
                <div class="wishlist-img-wrap">
                    <img src="${item.image || 'https://via.placeholder.com/300'}" alt="${item.name}">
                    <button class="remove-wish-btn" title="Remove from Wishlist">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="wishlist-info">
                    <h3 class="wishlist-name">${item.name}</h3>
                    <p class="wishlist-price">₹${Number(item.price).toFixed(2)}</p>
                    <button class="btn primary-btn w-100 wishlist-shop-btn addBtn">Move to Bag</button>
                </div>
            `;

            // Remove Button
            const removeBtn = card.querySelector('.remove-wish-btn');
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeFromWishlist(item.id);
            };

            // Add to Cart
            const addBtn = card.querySelector('.addBtn');
            addBtn.onclick = (e) => {
                e.stopPropagation();
                addToCart(item);
                removeFromWishlist(item.id);
            };

            wishlistContainer.appendChild(card);
        });
    }

    function removeFromWishlist(id) {
        wishlistItems = wishlistItems.filter(item => item.id !== id);
        localStorage.setItem('wishlist', JSON.stringify(wishlistItems));
        renderWishlist();
    }

    function addToCart(product) {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    renderWishlist();
});
