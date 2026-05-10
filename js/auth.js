// js/auth.js
import { auth, db } from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firestore imports — needed to save and check usernames
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

console.log('✅ auth.js loaded');
console.log('✅ auth object:', auth);

// ─── DOM REFERENCES ───────────────────────────────────────
const tabLogin         = document.getElementById('tab-login');
const tabSignup        = document.getElementById('tab-signup');
const loginForm        = document.getElementById('login-form');
const signupForm       = document.getElementById('signup-form');
const authError        = document.getElementById('auth-error');
const errorMessage     = document.getElementById('error-message');
const authSuccess      = document.getElementById('auth-success');
const successMessage   = document.getElementById('success-message');
const loginEmail       = document.getElementById('login-email');
const loginPass        = document.getElementById('login-password');
const loginBtn         = document.getElementById('login-btn');
const signupName       = document.getElementById('signup-name');
const signupUsername   = document.getElementById('signup-username');
const signupEmail      = document.getElementById('signup-email');
const signupPass       = document.getElementById('signup-password');
const signupConf       = document.getElementById('signup-confirm');
const signupBtn        = document.getElementById('signup-btn');
const usernameFeedback = document.getElementById('username-feedback');
const switchToSignup   = document.getElementById('switch-to-signup');
const switchToLogin    = document.getElementById('switch-to-login');

console.log('loginForm:',  loginForm);
console.log('signupForm:', signupForm);
console.log('loginBtn:',   loginBtn);
console.log('signupBtn:',  signupBtn);

// ─── AUTH STATE ───────────────────────────────────────────
onAuthStateChanged(auth, function(user) {
  console.log('🔥 onAuthStateChanged fired. User:', user);
  if (user) {
    console.log('✅ User logged in, redirecting...');
    window.location.href = 'app.html';
  }
});


// ══════════════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════════════
function showLogin() {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginForm.style.display  = 'flex';
  signupForm.style.display = 'none';
  clearMessages();
}

function showSignup() {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupForm.style.display = 'flex';
  loginForm.style.display  = 'none';
  clearMessages();
}

tabLogin.addEventListener('click', showLogin);
tabSignup.addEventListener('click', showSignup);
switchToSignup.addEventListener('click', showSignup);
switchToLogin.addEventListener('click', showLogin);


// ══════════════════════════════════════════════
//  SHOW / HIDE PASSWORD
// ══════════════════════════════════════════════
document.querySelectorAll('.toggle-password').forEach(function(btn) {
  btn.addEventListener('click', function() {
    const input = document.getElementById(btn.getAttribute('data-target'));
    if (input.type === 'password') {
      input.type      = 'text';
      btn.textContent = '🙈';
    } else {
      input.type      = 'password';
      btn.textContent = '👁';
    }
  });
});


// ══════════════════════════════════════════════
//  USERNAME — LIVE AVAILABILITY CHECK
// ══════════════════════════════════════════════

// Valid username: 3-20 chars, letters/numbers/underscores/hyphens only
function isValidFormat(username) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

let debounceTimer     = null;
let usernameAvailable = false;

signupUsername.addEventListener('input', function() {
  const value = this.value.trim().toLowerCase();
  this.value  = value;

  clearTimeout(debounceTimer);
  usernameAvailable = false;

  if (!value) {
    setFeedback('', '');
    return;
  }

  if (!isValidFormat(value)) {
    setFeedback('3–20 chars. Letters, numbers, _ and - only.', 'invalid');
    return;
  }

  // Format is valid — mark as available so submit isn't blocked
  // The real uniqueness check happens after auth in the submit handler
  usernameAvailable = true;
  setFeedback('✓ Looks good — availability confirmed on sign up', 'available');
});


async function checkUsername(username) {
  try {
    // Search users collection for any doc where username matches
    const q        = query(collection(db, 'users'), where('username', '==', username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // No match found — username is free
      usernameAvailable = true;
      setFeedback('✓ ' + username + ' is available', 'available');
    } else {
      // Match found — username is taken
      usernameAvailable = false;
      setFeedback('✗ ' + username + ' is already taken', 'taken');
    }
  } catch (err) {
    console.error('Username check error:', err);
    setFeedback('Could not check availability. Try again.', 'invalid');
  }
}

function setFeedback(message, type) {
  usernameFeedback.textContent = message;
  usernameFeedback.className   = 'username-feedback ' + type;
}


// ══════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════
loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  console.log('🔐 Login form submitted');
  clearMessages();
  setLoading(loginBtn, true);

  const email    = loginEmail.value.trim();
  const password = loginPass.value;

  console.log('Attempting login with email:', email);

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Login successful:', result.user.email);

  } catch (error) {
    console.error('❌ Login error:', error.code, error.message);
    showError(friendlyError(error.code));
    setLoading(loginBtn, false);
  }
});


// ══════════════════════════════════════════════
//  SIGN UP
// ══════════════════════════════════════════════
signupForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  clearMessages();

  const name     = signupName.value.trim();
  const username = signupUsername.value.trim().toLowerCase();
  const email    = signupEmail.value.trim();
  const password = signupPass.value;
  const confirm  = signupConf.value;

  // ── Client-side validation ──
  if (!name) {
    showError('Please enter your full name.');
    return;
  }

  if (!username || !isValidFormat(username)) {
    showError('Please enter a valid username (3–20 chars, letters/numbers/_ only).');
    signupUsername.classList.add('error');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }

  if (password !== confirm) {
    showError('Passwords do not match.');
    signupConf.classList.add('error');
    return;
  }

  setLoading(signupBtn, true);

  try {
    // ── Step 1: Create the Firebase Auth account FIRST ──
    // Now request.auth will be valid for the Firestore calls below
    const userCredential = await createUserWithEmailAndPassword(
      auth, email, password
    );
    const user = userCredential.user;
    console.log('✅ Auth account created:', user.email);

    // ── Step 2: NOW check username — user is authenticated ──
    const doubleCheck = await getDocs(
      query(collection(db, 'users'), where('username', '==', username))
    );

    if (!doubleCheck.empty) {
      // Username taken — delete the auth account we just made
      // so the user can try again cleanly
      await user.delete();
      showError('That username is already taken. Please choose another.');
      setFeedback('✗ ' + username + ' is already taken', 'taken');
      usernameAvailable = false;
      setLoading(signupBtn, false);
      return;
    }

    // ── Step 3: Save display name to Auth profile ──
    await updateProfile(user, { displayName: name });

    // ── Step 4: Save profile to Firestore ──
    await setDoc(doc(db, 'users', user.uid), {
      uid:         user.uid,
      username:    username,
      displayName: name,
      email:       email,
      createdAt:   serverTimestamp()
    });

    console.log('✅ Profile saved. Redirecting...');
    // onAuthStateChanged fires → redirects to app.html

  } catch (error) {
    console.error('❌ Signup error:', error.code, error.message);
    showError(friendlyError(error.code));
    setLoading(signupBtn, false);
  }
});


// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function setLoading(btn, isLoading) {
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled         = isLoading;
  text.style.display   = isLoading ? 'none' : 'inline';
  loader.style.display = isLoading ? 'flex'  : 'none';
}

function showError(msg) {
  errorMessage.textContent  = msg;
  authError.style.display   = 'flex';
  authSuccess.style.display = 'none';
}

function clearMessages() {
  authError.style.display   = 'none';
  authSuccess.style.display = 'none';
  document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'That email is already registered. Log in instead.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password. Try again.',
    'auth/invalid-credential':     'Email or password is incorrect.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed':  'Email sign-in is not enabled in Firebase Console.',
  };
  return map[code] || `Something went wrong (${code}). Try again.`;
}