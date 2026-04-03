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
            total: totalCost,
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
