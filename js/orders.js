import { db, auth } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const ordersContainer = document.getElementById('ordersContainer');
    const loadingOrders = document.getElementById('loadingOrders');

    onAuthStateChanged(auth, async (user) => {
        console.log(user);
        if (!user) {
            if (loadingOrders) loadingOrders.style.display = 'none';
            ordersContainer.innerHTML = '<p class="text-center text-muted">Please login to view your orders.</p>';
        } else {
            try {
                const q = query(collection(db, "orders"), where("userId", "==", user.uid));
                const snapshot = await getDocs(q);
                console.log(snapshot);
                
                if (loadingOrders) loadingOrders.style.display = 'none';

                if (snapshot.empty) {
                    ordersContainer.innerHTML = '<div class="text-center" style="padding: 3rem; background: var(--surface-color); border-radius: var(--radius-lg);"><i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-muted); display: block;"></i><p class="text-muted" style="font-size: 1.1rem; margin: 0;">No orders yet.</p></div>';
                    return;
                }

                // Sort locally to bypass index requirement
                const docs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
                docs.sort((a, b) => {
                    const timeA = a.createdAt || a.timestamp;
                    const timeB = b.createdAt || b.timestamp;
                    const ta = timeA ? timeA.toMillis() : 0;
                    const tb = timeB ? timeB.toMillis() : 0;
                    return tb - ta;
                });

                docs.forEach(data => {
                    const docId = data.id;
                    const timeField = data.createdAt || data.timestamp;
                    const orderDate = timeField ? timeField.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';
                    
                    const delivField = data.estimatedDeliveryDate;
                    const deliveryDateObj = delivField ? (delivField.toDate ? delivField.toDate() : new Date(delivField)) : null;
                    const deliveryDate = deliveryDateObj ? deliveryDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pending';

                    const status = data.status || 'Placed';
                    
                    const el = document.createElement('div');
                    el.className = 'product-card';
                    el.style.marginBottom = '2rem';
                    el.style.padding = '2rem';
                    
                    let itemsHtml = data.products.map(p => `
                        <li style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px dashed rgba(255,255,255,0.1); display: flex; justify-content: space-between;">
                            <span><span style="color: var(--text-muted); margin-right: 0.5rem;">${p.quantity}x</span> ${p.name}</span>
                            <span style="font-weight: 500;">₹${(p.price * p.quantity).toFixed(2)}</span>
                        </li>`).join('');

                    // Determine badge color based on status
                    let badgeColor = 'var(--primary-color)';
                    if (status.toLowerCase() === 'shipped') badgeColor = '#3498db';
                    if (status.toLowerCase() === 'delivered') badgeColor = '#2ecc71';
                    if (status.toLowerCase() === 'cancelled') badgeColor = '#e74c3c';

                    let cancelButtonHtml = '';
                    if (status.toLowerCase() === 'placed' || status.toLowerCase() === 'processing') {
                        cancelButtonHtml = `<button class="btn secondary-btn cancel-btn" data-id="${docId}" style="margin-top: 1rem; padding: 0.5rem 1rem; border-color: #e74c3c; color: #e74c3c; transition: all 0.3s; width: 100%;">Cancel Order</button>`;
                    }

                    el.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                            <div>
                                <strong style="color: var(--primary-color); display: block; font-size: 1.1rem; margin-bottom: 0.25rem;">Order #${docId}</strong>
                                <span class="text-muted" style="font-size: 0.875rem;">Placed on: ${orderDate}</span>
                            </div>
                            <div style="text-align: right; min-width: 150px;">
                                <span class="badge" style="background: ${badgeColor}; color: white; padding: 0.4rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; text-transform: uppercase;">${status}</span>
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.75rem;"><i class="fa-solid fa-truck" style="margin-right: 0.4rem;"></i> Est. Delivery: <strong style="color: var(--text-color);">${deliveryDate}</strong></div>
                                ${cancelButtonHtml}
                            </div>
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <strong style="display: block; margin-bottom: 1rem; font-size: 1.05rem;">Items Ordered:</strong>
                            <ul style="list-style: none; padding: 0; margin: 0; color: var(--text-muted);">
                                ${itemsHtml}
                            </ul>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; background: rgba(0,0,0,0.1); padding: 1.5rem; border-radius: var(--radius-md); flex-wrap: wrap; gap: 1rem;">
                            <div style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.6;">
                                <strong style="color: var(--text-color); font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">Shipping Address:</strong>
                                ${data.address?.fullName || 'No Name'}<br>
                                ${data.address?.address || 'No Address'}, ${data.address?.city || 'No City'}${data.address?.state ? ', ' + data.address.state : ''}<br>
                                PIN: ${data.address?.pincode ? data.address.pincode : 'N/A'}
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.25rem;">Payment Method: ${(data.payment || data.paymentMethod) === 'online' ? 'Online' : 'Cash on Delivery'}</div>
                                <strong>Total Amount: <span style="font-size: 1.5rem; color: var(--primary-color); display: block; line-height: 1.2;">₹${(data.total || data.totalPrice || 0).toFixed(2)}</span></strong>
                            </div>
                        </div>
                    `;
                    ordersContainer.appendChild(el);

                    // Add Event Listener to Cancel Button
                    if (status.toLowerCase() === 'placed' || status.toLowerCase() === 'processing') {
                        const cancelBtn = el.querySelector('.cancel-btn');
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', async () => {
                                if (confirm('Are you sure you want to cancel this order?')) {
                                    try {
                                        cancelBtn.disabled = true;
                                        cancelBtn.innerText = 'Cancelling...';
                                        await updateDoc(doc(db, "orders", docId), {
                                            status: "Cancelled"
                                        });
                                        location.reload();
                                    } catch (err) {
                                        console.error('Error cancelling order:', err);
                                        alert('Failed to cancel order.');
                                        cancelBtn.disabled = false;
                                        cancelBtn.innerText = 'Cancel Order';
                                    }
                                }
                            });
                        }
                    }
                });
            } catch (err) {
                console.error("Error fetching orders:", err);
                if (loadingOrders) loadingOrders.innerHTML = '<p class="error-msg">Error loading orders. Ensure indices are built if Firebase requires them.</p>';
            }
        }
    });

    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme !== 'dark') document.body.classList.remove('dark-mode');
});
