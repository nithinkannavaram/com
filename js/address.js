import { db, auth } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, query, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let addresses = [];
    let selectedAddressId = null;

    const addressListContainer = document.getElementById('addressListContainer');
    const addAddressContainer = document.getElementById('addAddressContainer');
    const addressCardsDiv = document.getElementById('addressCards');
    const showAddAddressBtn = document.getElementById('showAddAddressBtn');
    const cancelAddAddressBtn = document.getElementById('cancelAddAddressBtn');
    const proceedToPaymentBtn = document.getElementById('proceedToPaymentBtn');
    const maxAddressLimitMsg = document.getElementById('maxAddressLimitMsg');
    const addressForm = document.getElementById('addressForm');
    const addressError = document.getElementById('addressError');

    // Check auth status
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
            await loadAddresses();
        }
    });

    async function loadAddresses() {
        if (!currentUser) return;
        try {
            const q = query(collection(db, 'users', currentUser.uid, 'addresses'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            renderAddresses();
        } catch (err) {
            console.error("Error fetching addresses:", err);
            // Fallback if index missing
            if(err.message.includes('index')) {
                const snapshot = await getDocs(collection(db, 'users', currentUser.uid, 'addresses'));
                addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                addresses.sort((a,b) => {
                    const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return tb - ta;
                });
                renderAddresses();
            }
        }
    }

    function renderAddresses() {
        if (addresses.length === 0) {
            addressListContainer.style.display = 'none';
            addAddressContainer.style.display = 'block';
            cancelAddAddressBtn.style.display = 'none'; // Cannot cancel if they must add one
        } else {
            addressListContainer.style.display = 'block';
            addAddressContainer.style.display = 'none';
            cancelAddAddressBtn.style.display = 'block';
            
            addressCardsDiv.innerHTML = '';
            
            // Auto-select the first one by default if none selected or if selected one is deleted
            if (!selectedAddressId || !addresses.find(a => a.id === selectedAddressId)) {
                selectedAddressId = addresses[0].id;
            }

            addresses.forEach(addr => {
                const isSelected = addr.id === selectedAddressId;
                const card = document.createElement('div');
                card.className = `product-card ${isSelected ? 'selected-address' : ''}`;
                card.style.padding = '1.5rem';
                card.style.cursor = 'pointer';
                card.style.border = isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)';
                card.style.position = 'relative';
                card.style.transition = 'all 0.3s ease';

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                <input type="radio" name="addressSelect" value="${addr.id}" ${isSelected ? 'checked' : ''} style="cursor:pointer; width:18px; height:18px; accent-color: var(--primary-color);">
                                <strong style="font-size: 1.1rem; color: var(--text-color);">${addr.fullName}</strong>
                            </div>
                            <p style="color: var(--text-muted); margin-bottom: 0.25rem; padding-left: 1.8rem;">${addr.address}</p>
                            <p style="color: var(--text-muted); margin-bottom: 0.25rem; padding-left: 1.8rem;">${addr.city}, ${addr.state} - ${addr.pincode}</p>
                            <p style="color: var(--text-muted); padding-left: 1.8rem;"><i class="fa-solid fa-phone" style="margin-right:0.4rem;"></i>${addr.phone}</p>
                        </div>
                        <button class="icon-btn delete-address-btn" data-id="${addr.id}" style="color: #ef4444; padding:0.5rem;" title="Delete Address">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;

                // Handle clicking anywhere on card to select
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.delete-address-btn')) return; // Ignore if clicking delete
                    selectedAddressId = addr.id;
                    renderAddresses(); // re-render to update the border and checked radio
                });

                // Handle delete
                const delBtn = card.querySelector('.delete-address-btn');
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if(confirm("Are you sure you want to delete this address?")) {
                        try {
                            delBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                            await deleteDoc(doc(db, 'users', currentUser.uid, 'addresses', addr.id));
                            addresses = addresses.filter(a => a.id !== addr.id);
                            
                            // Clear localStorage if we deleted the selected address
                            const storedAddress = JSON.parse(localStorage.getItem('selectedAddress'));
                            if (storedAddress && storedAddress.id === addr.id) {
                                localStorage.removeItem('selectedAddress');
                            }
                            
                            renderAddresses();
                        } catch (err) {
                            console.error("Error deleting address:", err);
                            alert("Failed to delete address.");
                        }
                    }
                });

                addressCardsDiv.appendChild(card);
            });

            // Update add button constraints
            if (addresses.length >= 3) {
                showAddAddressBtn.style.display = 'none';
                maxAddressLimitMsg.style.display = 'block';
            } else {
                showAddAddressBtn.style.display = 'inline-block';
                maxAddressLimitMsg.style.display = 'none';
            }

            proceedToPaymentBtn.disabled = false;
        }
    }

    showAddAddressBtn.addEventListener('click', () => {
        addressListContainer.style.display = 'none';
        addAddressContainer.style.display = 'block';
        addressForm.reset();
        addressError.innerText = '';
    });

    cancelAddAddressBtn.addEventListener('click', () => {
        addressListContainer.style.display = 'block';
        addAddressContainer.style.display = 'none';
    });

    addressForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addressError.innerText = '';
        
        if (!currentUser) return;

        const fullName = document.getElementById('fullName').value;
        const phone = document.getElementById('phone').value;
        const addressText = document.getElementById('address').value;
        const city = document.getElementById('city').value;
        const state = document.getElementById('state').value;
        const pincode = document.getElementById('pincode').value;

        const addressData = {
            fullName,
            phone,
            address: addressText,
            city,
            state,
            pincode,
            timestamp: serverTimestamp()
        };

        try {
            const submitBtn = document.getElementById('saveAddressBtn');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;

            const newDocRef = await addDoc(collection(db, 'users', currentUser.uid, 'addresses'), addressData);
            
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;

            // Optional: simulate server timestamp for local rendering
            addressData.id = newDocRef.id;
            addressData.timestamp = { toMillis: () => Date.now() }; 
            addresses.unshift(addressData); // add to top
            selectedAddressId = newDocRef.id;
            
            renderAddresses();

        } catch (error) {
            console.error("Error saving address:", error);
            addressError.innerText = error.message;
            document.getElementById('saveAddressBtn').innerText = 'Save Address';
            document.getElementById('saveAddressBtn').disabled = false;
        }
    });

    proceedToPaymentBtn.addEventListener('click', () => {
        if (!selectedAddressId) return;
        const selectedData = addresses.find(a => a.id === selectedAddressId);
        if (selectedData) {
            localStorage.setItem('selectedAddress', JSON.stringify(selectedData));
            window.location.href = 'payment.html';
        }
    });
    
    // Theme initialization
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme !== 'dark') document.body.classList.remove('dark-mode');
});
