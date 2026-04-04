// Shared UI Helpers for KN SHOP
export function renderProductsGrid(productsToRender, container, wishlist) {
    if (!container) return;
    container.innerHTML = '';

    if (productsToRender.length === 0) {
        container.innerHTML = '<p class="no-products">No products found in this category.</p>';
        return;
    }

    productsToRender.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.setProperty('--i', index);
        card.innerHTML = `
            <div class="product-image-container">
                <a href="product.html?id=${data.id}">
                    <img class="product-image" src="${( (Array.isArray(data.image) ? data.image[0] : (Array.isArray(data.images) ? data.images[0] : (data.image || data.image1 || 'https://via.placeholder.com/300'))) ).toString().trim().replace('cloundinary', 'cloudinary')}" alt="${data.name}">
                </a>
                <button class="wishlist-toggle-btn ${wishlist.some(item => item.id === data.id) ? 'active' : ''}" title="Add to Wishlist">
                    <i class="${wishlist.some(item => item.id === data.id) ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <a href="product.html?id=${data.id}" style="text-decoration: none; color: inherit;">
                    <h3 class="product-title">${data.name}</h3>
                </a>
                <p class="product-price">₹${Number(data.price).toFixed(2)}</p>
                <button class="add-to-cart-btn btn primary-btn w-100 addBtn" data-id="${data.id}">Add to Bag</button>
            </div>`;

        // Interaction for wishlist
        const wishlistBtn = card.querySelector('.wishlist-toggle-btn');
        wishlistBtn.onclick = (e) => {
            e.stopPropagation();
            window._toggleWishlistGlobal(data, wishlistBtn);
        };

        // Interaction for cart
        const addBtn = card.querySelector('.addBtn');
        addBtn.onclick = (e) => {
            e.stopPropagation();
            window._addToCartGlobal(data);
            addBtn.innerText = 'Added!';
            setTimeout(() => addBtn.innerText = 'Add to Bag', 1000);
        };

        // Card-level link
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.addBtn') && !e.target.closest('.wishlist-toggle-btn') && !e.target.closest('a')) {
                window.location.href = `product.html?id=${data.id}`;
            }
        });

        container.appendChild(card);
    });
}
