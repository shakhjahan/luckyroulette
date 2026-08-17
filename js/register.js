import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { get, ref, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const form = document.getElementById("registerForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    error.textContent = "";

    const username = document.getElementById("username").value.trim();
    const usernameLower = username.toLowerCase();
    const password = document.getElementById("password").value;

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
        error.textContent =
            "Login 3–30 belgidan iborat bo‘lsin: harf, raqam, _, -, .";
        return;
    }

    if (password.length < 6) {
        error.textContent = "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.";
        return;
    }

    try {
        // Avval login bandligini tekshiramiz
        const snapshot = await get(ref(db, "users"));
        const users = snapshot.val() || {};

        const exists = Object.values(users).some(
            (u) => u.usernameLower === usernameLower
        );

        if (exists) {
            error.textContent = "Bu login allaqachon band.";
            return;
        }

        // Firebase uchun ichki texnik email
        const internalEmail =
            `${usernameLower.replace(/[^a-z0-9_.-]/g, "_")}@luckyroulette.invalid`;

        console.log("Firebase account yaratilmoqda...");

        const credential = await createUserWithEmailAndPassword(
            auth,
            internalEmail,
            password
        );

        console.log("Firebase Auth OK:", credential.user.uid);

        await set(ref(db, `users/${credential.user.uid}`), {
            username: username,
            usernameLower: usernameLower,
            email: internalEmail,
            role: "user",
            balance: 100000,
            active: true,
            createdAt: Date.now()
        });

        console.log("Realtime Database OK");

        location.href = "./dashboard.html";

    } catch (err) {
        console.error("REGISTER ERROR:", err);

        error.textContent =
            "Xatolik: " + (err.code || err.message || "Noma'lum xato");
    }
});
