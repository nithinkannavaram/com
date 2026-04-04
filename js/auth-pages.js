import { auth } from '../firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile,
    onAuthStateChanged,
    sendEmailVerification
} from "firebase/auth";


// ✅ GLOBAL AUTH CHECK (ONLY ON LOGIN/SIGNUP PAGE)
onAuthStateChanged(auth, (user) => {
        const isVerified = user.emailVerified || user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'phone');
        
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            verified: isVerified
        }));

        // 🔥 Redirect ONLY if already logged in
        if (window.location.pathname.includes("login") || window.location.pathname.includes("signup")) {
            window.location.href = 'index.html';
        }
    }
});


// ✅ WAIT FOR DOM
document.addEventListener('DOMContentLoaded', () => {

    // ================= LOGIN =================
    const loginForm = document.getElementById('loginPageForm');
    const loginError = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            loginSubmitBtn.innerText = 'Signing In...';
            loginSubmitBtn.disabled = true;
            loginError.style.display = 'none';

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                localStorage.setItem('user', JSON.stringify({
                    uid: user.uid,
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email
                }));

                window.location.href = 'index.html';

            } catch (error) {
                loginError.innerText = "Invalid email or password.";
                loginError.style.display = 'block';
                loginSubmitBtn.innerText = 'Sign In';
                loginSubmitBtn.disabled = false;
            }
        });
    }


    // ================= SIGNUP =================
    const signupForm = document.getElementById('signupPageForm');
    const signupError = document.getElementById('signupError');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            signupSubmitBtn.innerText = 'Creating Account...';
            signupSubmitBtn.disabled = true;
            signupError.style.display = 'none';

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await updateProfile(user, { displayName: name });
                
                // --- Email Verification ---
                await sendEmailVerification(user);
                alert("Account created! A verification email has been sent to " + email + ". Please verify your address.");

                localStorage.setItem('user', JSON.stringify({
                    uid: user.uid,
                    name: name,
                    email: email,
                    verified: false
                }));

                window.location.href = 'index.html';

            } catch (error) {
                signupError.innerText = error.message.replace('Firebase:', '');
                signupError.style.display = 'block';
                signupSubmitBtn.innerText = 'Sign Up Now';
                signupSubmitBtn.disabled = false;
            }
        });
    }

});