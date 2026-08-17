import { db } from "./firebase.js";
import {
    ref,
    update,
    push,
    set
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import { requireAuth, logout } from "./auth.js";

let user = null;
let balanceValue = 0;
let running = false;
let rotation = 0;

const multipliers = [10, 0, 2, 0, 5, 0];

const wheel = document.getElementById("wheel");
const betInput = document.getElementById("bet");
const startButton = document.getElementById("start");
const balanceElement = document.getElementById("balance");
const resultElement = document.getElementById("result");
const statusElement = document.getElementById("gameStatus");
const logoutButton = document.getElementById("logoutBtn");

logoutButton.addEventListener("click", logout);

requireAuth((currentUser, profile) => {
    user = currentUser;
    balanceValue = Number(profile.balance || 0);
    renderBalance();
});

startButton.addEventListener("click", async () => {

    if (running || !user) {
        return;
    }

    const bet = Number(betInput.value);

    if (!Number.isFinite(bet) || bet < 1000) {
        statusElement.textContent =
            "Minimal stavka 1 000 UZS.";
        return;
    }

    if (bet > balanceValue) {
        statusElement.textContent =
            "Balans yetarli emas.";
        return;
    }

    running = true;
    startButton.disabled = true;

    resultElement.textContent = "";
    statusElement.textContent = "";

    const balanceBefore = balanceValue;

    // Stavkani yechish
    balanceValue -= bet;
    renderBalance();

    try {

        await update(
            ref(db, `users/${user.uid}`),
            {
                balance: balanceValue
            }
        );

        // Tasodifiy sektor
        const sectorIndex =
            Math.floor(Math.random() * multipliers.length);

        const multiplier =
            multipliers[sectorIndex];

        const prize =
            bet * multiplier;

        // G‘ildirakni aylantirish
        rotation +=
            5 * 360 +
            (360 - (sectorIndex * 60 + 30));

        wheel.style.transform =
            `rotate(${rotation}deg)`;

        // Animatsiyani kutish
        await new Promise(resolve => {
            setTimeout(resolve, 5000);
        });

        // Yutuqni qo‘shish
        balanceValue += prize;

        renderBalance();

        await update(
            ref(db, `users/${user.uid}`),
            {
                balance: balanceValue
            }
        );

        // O‘yin tarixini saqlash
        await set(
            push(ref(db, "games")),
            {
                userId: user.uid,
                bet: bet,
                multiplier: multiplier,
                prize: prize,
                balanceBefore: balanceBefore,
                balanceAfter: balanceValue,
                createdAt: Date.now()
            }
        );

        if (multiplier > 0) {

            resultElement.textContent =
                `🎉 Yutuq: ${prize.toLocaleString("uz-UZ")} UZS (${multiplier}x)`;

        } else {

            resultElement.textContent =
                `😔 Yutqazdingiz: ${bet.toLocaleString("uz-UZ")} UZS`;

        }

    } catch (error) {

        console.error("GAME ERROR:", error);

        // Xatolik bo‘lsa stavkani qaytarish
        balanceValue = balanceBefore;

        renderBalance();

        await update(
            ref(db, `users/${user.uid}`),
            {
                balance: balanceBefore
            }
        );

        statusElement.textContent =
            "O‘yinda xatolik yuz berdi.";

    } finally {

        running = false;
        startButton.disabled = false;
    }
});

function renderBalance() {

    balanceElement.textContent =
        balanceValue.toLocaleString("uz-UZ");
}
