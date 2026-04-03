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
import { doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let savedAddress = null;
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Redirect if cart is empty
    if (cart.length === 0) {
        window.location.href = 'index.html';
        return;
    }

    // Render Order Summary
    let totalCost = 0;
    let discount = 0;
    let appliedCoupon = null;
    const summaryContainer = document.getElementById('orderSummaryContainer');
    cart.forEach(item => {
        totalCost += item.price * item.quantity;
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '1rem';
        div.innerHTML = `
            <span>${item.quantity}x ${item.name}</span>
            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
        `;
        summaryContainer.appendChild(div);
    });
    document.getElementById('finalTotal').innerText = `₹${totalCost.toFixed(2)}`;

    // Coupon Logic
    const couponInput = document.getElementById('couponInput');
    const applyBtn = document.getElementById('applyCouponBtn');
    const couponMsg = document.getElementById('couponMessage');
    const discountRow = document.getElementById('discountRow');
    const discountAmt = document.getElementById('discountAmount');
    const finalTotalEl = document.getElementById('finalTotal');

    applyBtn.addEventListener('click', () => {
        const code = couponInput.value.trim().toUpperCase();
        if (!code) {
            couponMsg.innerText = "Please enter a coupon code.";
            couponMsg.style.color = "#e74c3c";
            return;
        }

        // Coupon rules from coupons.html
        // NEW10OFF: 10% OFF on > ₹999
        // SMART150: ₹150 OFF on > ₹1200
        // FREESHIP: Flat ₹50 OFF (Assuming shipping was roughly 50)

        let tempDiscount = 0;
        let isValid = false;

        if (code === 'NEW10OFF') {
            if (totalCost > 999) {
                tempDiscount = totalCost * 0.1;
                isValid = true;
            } else {
                couponMsg.innerText = "Order value must be above ₹999 for this coupon.";
            }
        } else if (code === 'SMART150') {
            if (totalCost > 1200) {
                tempDiscount = 150;
                isValid = true;
            } else {
                couponMsg.innerText = "Order value must be above ₹1200 for this coupon.";
            }
        } else if (code === 'FREESHIP') {
            tempDiscount = 50; // Mock shipping discount
            isValid = true;
        } else {
            couponMsg.innerText = "Invalid coupon code.";
        }

        if (isValid) {
            discount = tempDiscount;
            appliedCoupon = code;
            discountRow.style.display = 'flex';
            discountAmt.innerText = `-₹${discount.toFixed(2)}`;
            finalTotalEl.innerText = `₹${(totalCost - discount).toFixed(2)}`;
            couponMsg.innerText = `Coupon '${code}' applied successfully!`;
            couponMsg.style.color = "#27ae60";
            applyBtn.disabled = true;
            couponInput.disabled = true;
        } else {
            couponMsg.style.color = "#e74c3c";
        }
    });

    // Check auth status
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html?login=true';
        } else {
            currentUser = user;
            // Fetch selected address to include with the order
            try {
                const storedAddress = JSON.parse(localStorage.getItem('selectedAddress'));
                if (storedAddress) {
                    savedAddress = storedAddress;
                } else {
                    // No address found in storage, force them back
                    window.location.href = 'address.html';
                }
            } catch (err) {
                console.error("Error fetching address:", err);
                window.location.href = 'address.html';
            }
        }
    });

    // Handle Payment Submit
    const paymentForm = document.getElementById('paymentForm');
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser || !savedAddress) return;

        const submitBtn = document.getElementById('placeOrderBtn');
        const paymentError = document.getElementById('paymentError');
        paymentError.innerText = '';
        
        const methodSelection = document.querySelector('input[name="paymentOption"]:checked');
        if (!methodSelection) {
            paymentError.innerText = "Please select a payment method.";
            return;
        }

        const paymentMethod = methodSelection.value;

        // If 'online' selected, simulate mock gateway delay
        if (paymentMethod === 'online') {
            submitBtn.innerText = 'Processing Payment...';
            await new Promise(r => setTimeout(r, 2000));
        }

        submitBtn.innerText = 'Placing Order...';
        submitBtn.disabled = true;

        // Estimated delivery: 5-7 days from now. Let's use 6 days.
        const estDelivery = new Date();
        estDelivery.setDate(estDelivery.getDate() + 6);

        const orderData = {
            userId: currentUser.uid,
            products: cart,
            subtotal: totalCost,
            discount: discount,
            coupon: appliedCoupon,
            total: totalCost - discount,
            address: savedAddress,
            payment: paymentMethod,
            status: 'Placed',
            estimatedDeliveryDate: estDelivery,
            createdAt: serverTimestamp()
        };

        try {
            // Store Order in Firestore
            const docRef = await addDoc(collection(db, "orders"), orderData);
            
            // Clear cart
            localStorage.removeItem('cart');

            // Show Success Modal
            const successModal = document.getElementById('successModal');
            document.getElementById('placedOrderId').innerText = docRef.id;
            successModal.classList.add('active');

        } catch (error) {
            console.error("Order error:", error);
            paymentError.innerText = error.message;
            submitBtn.innerText = 'Place Order';
            submitBtn.disabled = false;
        }
    });

    const returnHomeBtn = document.getElementById('returnHomeBtn');
    if (returnHomeBtn) {
        returnHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

});
