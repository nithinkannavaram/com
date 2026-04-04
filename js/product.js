import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

async function loadProduct() {
    const productLoading = document.getElementById("productLoading");
    const productContent = document.getElementById("productContent");

    if (!id) {
        window.location.href = "index.html";
        return;
    }

    try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const product = { id: docSnap.id, ...docSnap.data() };

            document.getElementById("title").innerText = product.name;
            
            // Handle image sources (Array or Strings - Support both 'image' and 'images' fields)
            let rawImages = [];
            if (Array.isArray(product.image)) rawImages = product.image;
            else if (Array.isArray(product.images)) rawImages = product.images;
            else if (product.image || product.image1) rawImages = [product.image || product.image1];
            else rawImages = ['https://via.placeholder.com/300'];

            const allImages = rawImages.map(url => url.toString().trim().replace('cloundinary', 'cloudinary'));

            const mainImageEl = document.getElementById("image");
            mainImageEl.src = allImages[0];

            // Render Thumbnails
            const thumbContainer = document.getElementById('thumbnails');
            if (thumbContainer) {
                thumbContainer.innerHTML = '';
                if (allImages.length > 1) {
                    allImages.forEach((imgSrc, idx) => {
                        const thumb = document.createElement('img');
                        thumb.src = imgSrc;
                        thumb.className = `thumbnail ${idx === 0 ? 'active' : ''}`;
                        thumb.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid transparent; flex-shrink: 0;';
                        if (idx === 0) thumb.style.borderColor = 'var(--primary-color)';
                        
                        thumb.onclick = () => {
                            mainImageEl.src = imgSrc;
                            document.querySelectorAll('.thumbnail').forEach(t => t.style.borderColor = 'transparent');
                            thumb.style.borderColor = 'var(--primary-color)';
                        };
                        thumbContainer.appendChild(thumb);
                    });
                } else {
                    thumbContainer.style.display = 'none';
                }
            }

            document.getElementById("price").innerText = "₹" + Number(product.price).toFixed(2);
            document.getElementById("description").innerText = product.description || "Premium quality product details.";

            if (productLoading) productLoading.style.display = "none";
            if (productContent) productContent.style.display = "grid";

            // Dynamic Size Selection from 🔥 Firebase
            const sizeArea = document.getElementById('sizeSelectorArea');
            const sizeOptions = document.getElementById('sizeOptions');
            let selectedSize = null;

            if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
                sizeArea.style.display = 'block';
                sizeOptions.innerHTML = ''; // Clear items
                
                product.sizes.forEach(size => {
                    const btn = document.createElement('button');
                    btn.className = 'size-btn';
                    btn.innerText = size;
                    btn.dataset.size = size;
                    btn.onclick = () => {
                        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedSize = size;
                    };
                    sizeOptions.appendChild(btn);
                });
            } else {
                sizeArea.style.display = 'none';
                selectedSize = 'Default'; // Auto-select default if no size required
            }

            // Support buttons
            const addToBagBtn = document.getElementById('addToBagBtn');
            const buyNowBtn = document.getElementById('buyNowBtn');

            if (addToBagBtn) {
                addToBagBtn.onclick = () => {
                    if (sizeArea.style.display !== 'none' && !selectedSize) {
                        return alert('Please select a size first!');
                    }
                    addToCart(product, selectedSize);
                    addToBagBtn.innerText = 'Added ' + (selectedSize !== 'Default' ? '('+selectedSize+')' : '');
                    setTimeout(() => addToBagBtn.innerText = 'Add to Bag', 2000);
                };
            }

            if (buyNowBtn) {
                buyNowBtn.onclick = () => {
                    if (sizeArea.style.display !== 'none' && !selectedSize) {
                        return alert('Please select a size first!');
                    }
                    addToCart(product, selectedSize);
                    window.location.href = auth.currentUser ? 'address.html' : 'index.html?login=true';
                };
            }

            const addToWishlistBtn = document.getElementById('addToWishlistBtn');
            if (addToWishlistBtn) {
                addToWishlistBtn.onclick = () => {
                    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
                    if (!wishlist.some(item => item.id === product.id)) {
                        wishlist.push(product);
                        localStorage.setItem('wishlist', JSON.stringify(wishlist));
                        addToWishlistBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Added to Wishlist';
                    }
                };
            }

        } else {
            document.body.innerHTML = "<div class='text-center' style='margin-top: 5rem;'><h2>❌ Product not found</h2><br><a href='index.html'>Back to Store</a></div>";
        }
    } catch (error) {
        console.error("Data Error:", error);
        if (productLoading) productLoading.innerHTML = "❌ Loading failed. Please try again.";
    }
}

function addToCart(product, size = null) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(item => item.id === product.id && item.size === size);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1, size: size });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
}

loadProduct();
