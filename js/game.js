import { db, auth } from "./firebase.js";

import {
    ref,
    get,
    set,
    update,
    push,
    onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =========================
   ELEMENTLAR
   ========================= */

const wheel =
    document.getElementById("wheel");

const joinPanel =
    document.getElementById("joinPanel");

const readyPanel =
    document.getElementById("readyPanel");

const betInput =
    document.getElementById("betInput");

const joinBtn =
    document.getElementById("joinBtn");

const readyBtn =
    document.getElementById("readyBtn");

const myBet =
    document.getElementById("myBet");

const totalPot =
    document.getElementById("totalPot");

const gameStatus =
    document.getElementById("gameStatus");

const countdown =
    document.getElementById("countdown");

const result =
    document.getElementById("result");


let currentUser = null;

let profile = null;

let gameId = null;

let game = null;

let spinning = false;

let rotation = 0;


/* =========================
   LOGOUT
   ========================= */

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async () => {

            await signOut(auth);

            location.href =
                "./login.html";

        }
    );


/* =========================
   AUTH
   ========================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            location.href =
                "./login.html";

            return;

        }

        currentUser = user;


        const snapshot =
            await get(
                ref(
                    db,
                    `users/${user.uid}`
                )
            );


        if (!snapshot.exists()) {

            gameStatus.textContent =
                "Profil topilmadi.";

            return;

        }


        profile =
            snapshot.val();


        await findGame();

    }
);


/* =========================
   O‘YIN TOPISH
   ========================= */

async function findGame() {

    const snapshot =
        await get(
            ref(db, "games")
        );


    const games =
        snapshot.val() || {};


    let availableGame =
        null;


    for (
        const [id, data]
        of Object.entries(games)
    ) {

        const players =
            Object.keys(
                data.players || {}
            );


        if (
            data.status === "waiting" &&
            players.length < 3
        ) {

            availableGame = id;

            break;

        }

    }


    /*
       MAVJUD O‘YIN BO‘LSA
    */

    if (availableGame) {

        gameId =
            availableGame;

    }


    /*
       AKS HOLDA YANGI O‘YIN
    */

    else {

        gameId =
            push(
                ref(db, "games")
            ).key;


        await set(
            ref(
                db,
                `games/${gameId}`
            ),
            {

                status:
                    "waiting",

                players: {},

                totalPot:
                    0,

                createdAt:
                    Date.now()

            }
        );

    }


    watchGame();

}


/* =========================
   FIREBASE WATCH
   ========================= */

function watchGame() {

    onValue(
        ref(
            db,
            `games/${gameId}`
        ),
        snapshot => {

            game =
                snapshot.val();


            if (!game)
                return;


            renderGame();

        }
    );

}


/* =========================
   RENDER
   ========================= */

function renderGame() {

    const players =
        Object.entries(
            game.players || {}
        );


    /*
       BANK
    */

    const pot =
        players.reduce(
            (sum, [, player]) =>
                sum +
                Number(
                    player.bet || 0
                ),
            0
        );


    totalPot.textContent =
        pot.toLocaleString(
            "uz-UZ"
        ) +
        " UZS";


    /*
       3 ISHTIROKCHI
    */

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const nameEl =
            document.getElementById(
                `player${i + 1}Name`
            );

        const betEl =
            document.getElementById(
                `player${i + 1}Bet`
            );

        const readyEl =
            document.getElementById(
                `player${i + 1}Ready`
            );


        const wheelName =
            document.getElementById(
                `wheelName${i + 1}`
            );


        if (!players[i]) {

            nameEl.textContent =
                "Kutilmoqda...";

            betEl.textContent =
                "—";

            readyEl.textContent =
                "Kutilmoqda";

            readyEl.className =
                "player-ready";

            wheelName.textContent =
                "Kutilmoqda";

            continue;

        }


        const player =
            players[i][1];


        nameEl.textContent =
            player.username;


        betEl.textContent =
            Number(
                player.bet
            ).toLocaleString(
                "uz-UZ"
            ) +
            " UZS";


        wheelName.textContent =
            player.username;


        if (player.ready) {

            readyEl.textContent =
                "✓ Tayyor";

            readyEl.className =
                "player-ready ready";

        }

        else {

            readyEl.textContent =
                "Kutilmoqda";

            readyEl.className =
                "player-ready";

        }

    }


    /*
       MENING HOLATIM
    */

    const mine =
        game.players?.[
            currentUser.uid
        ];


    if (
        !mine &&
        players.length < 3 &&
        game.status === "waiting"
    ) {

        joinPanel.classList.remove(
            "hidden"
        );

        readyPanel.classList.add(
            "hidden"
        );

    }

    else if (
        mine &&
        !mine.ready &&
        game.status === "waiting"
    ) {

        joinPanel.classList.add(
            "hidden"
        );

        readyPanel.classList.remove(
            "hidden"
        );


        myBet.textContent =
            "Sizning stavkangiz: " +
            Number(
                mine.bet
            ).toLocaleString(
                "uz-UZ"
            ) +
            " UZS";

    }

    else {

        joinPanel.classList.add(
            "hidden"
        );

        readyPanel.classList.add(
            "hidden"
        );

    }


    /*
       TAYYORLAR SONI
    */

    const readyPlayers =
        players.filter(
            ([, player]) =>
                player.ready === true
        ).length;


    if (
        players.length < 3
    ) {

        gameStatus.textContent =
            `${players.length} / 3 ishtirokchi.`;

    }

    else {

        gameStatus.textContent =
            `${readyPlayers} / 3 ishtirokchi tayyor.`;

    }


    /*
       3/3 TAYYOR
    */

    if (
        players.length === 3 &&
        readyPlayers === 3 &&
        game.status === "waiting" &&
        !spinning
    ) {

        startRound();

    }


    /*
       TAYYOR NATIJA
    */

    if (
        game.status === "finished" &&
        game.winnerUsername
    ) {

        result.textContent =
            `🏆 ${game.winnerUsername} G‘OLIB!`;

    }

}


/* =========================
   STAVKA QO‘YISH
   ========================= */

joinBtn.addEventListener(
    "click",
    async () => {

        const bet =
            Number(
                betInput.value
            );


        if (
            !Number.isFinite(bet) ||
            bet < 1000
        ) {

            gameStatus.textContent =
                "Minimal stavka 1 000 UZS.";

            return;

        }


        const balance =
            Number(
                profile.balance || 0
            );


        if (
            bet > balance
        ) {

            gameStatus.textContent =
                "Balans yetarli emas.";

            return;

        }


        const players =
            Object.keys(
                game.players || {}
            );


        if (
            players.length >= 3
        ) {

            gameStatus.textContent =
                "Bu o‘yin to‘ldi.";

            return;

        }


        joinBtn.disabled =
            true;


        try {

            /*
               BALANSDAN YECHISH
            */

            await update(
                ref(
                    db,
                    `users/${currentUser.uid}`
                ),
                {
                    balance:
                        balance - bet
                }
            );


            /*
               O‘YINGA QO‘SHISH
            */

            await set(
                ref(
                    db,
                    `games/${gameId}/players/${currentUser.uid}`
                ),
                {

                    username:
                        profile.username,

                    bet:
                        bet,

                    ready:
                        false,

                    joinedAt:
                        Date.now()

                }
            );


            profile.balance =
                balance - bet;


        }

        catch (error) {

            console.error(
                "JOIN ERROR:",
                error
            );


            gameStatus.textContent =
                "Stavka qo‘yishda xatolik.";


            joinBtn.disabled =
                false;

        }

    }
);


/* =========================
   TAYYOR
   ========================= */

readyBtn.addEventListener(
    "click",
    async () => {

        const mine =
            game.players?.[
                currentUser.uid
            ];


        if (!mine)
            return;


        readyBtn.disabled =
            true;


        try {

            await update(
                ref(
                    db,
                    `games/${gameId}/players/${currentUser.uid}`
                ),
                {
                    ready:
                        true
                }
            );

        }

        catch (error) {

            console.error(
                "READY ERROR:",
                error
            );

            readyBtn.disabled =
                false;

        }

    }
);


/* =========================
   O‘YINNI BOSHLASH
   ========================= */

async function startRound() {

    if (spinning)
        return;


    spinning = true;


    const players =
        Object.entries(
            game.players || {}
        );


    if (
        players.length !== 3
    ) {

        spinning = false;

        return;

    }


    /*
       JAMI BANK
    */

    const pot =
        players.reduce(
            (sum, [, player]) =>
                sum +
                Number(player.bet),
            0
        );


    /*
       COUNTDOWN
    */

    await update(
        ref(
            db,
            `games/${gameId}`
        ),
        {

            status:
                "countdown",

            totalPot:
                pot

        }
    );


    for (
        let i = 3;
        i >= 1;
        i--
    ) {

        countdown.textContent =
            i;

        await wait(1000);

    }


    countdown.textContent =
        "";


    /*
       G‘OLIBNI TANLASH
    */

    const winnerIndex =
        Math.floor(
            Math.random() * 3
        );


    const winner =
        players[winnerIndex];


    const winnerUid =
        winner[0];


    const winnerUsername =
        winner[1].username;


    /*
       G‘OLIB SEKTORINI
       YASHIL QILAMIZ
    */

    wheel.classList.remove(
        "winner-1",
        "winner-2",
        "winner-3"
    );


    wheel.classList.add(
        `winner-${winnerIndex + 1}`
    );


    /*
       SPINNER

       3 sektor:

       1 = 0° - 120°
       2 = 120° - 240°
       3 = 240° - 360°
    */

    const sectorCenter =
        winnerIndex * 120 + 60;


    const turns =
        6 * 360;


    const target =
        rotation +
        turns +
        (360 - sectorCenter);


    rotation =
        target;


    await update(
        ref(
            db,
            `games/${gameId}`
        ),
        {

            status:
                "spinning",

            winnerUid:
                winnerUid,

            winnerUsername:
                winnerUsername

        }
    );


    /*
       BARABAN
    */

    wheel.style.transform =
        `rotate(${target}deg)`;


    await wait(6000);


    /*
       G‘OLIB BALANSI
    */

    const winnerSnapshot =
        await get(
            ref(
                db,
                `users/${winnerUid}`
            )
        );


    const winnerProfile =
        winnerSnapshot.val();


    const winnerBalance =
        Number(
            winnerProfile.balance || 0
        );


    await update(
        ref(
            db,
            `users/${winnerUid}`
        ),
        {

            balance:
                winnerBalance + pot

        }
    );


    /*
       O‘YIN TUGADI
    */

    await update(
        ref(
            db,
            `games/${gameId}`
        ),
        {

            status:
                "finished",

            winnerUid:
                winnerUid,

            winnerUsername:
                winnerUsername,

            totalPot:
                pot,

            finishedAt:
                Date.now()

        }
    );


    result.textContent =
        `🏆 ${winnerUsername} G‘OLIB!`;


    gameStatus.textContent =
        "O‘yin yakunlandi.";


    spinning = false;

}


/* =========================
   WAIT
   ========================= */

function wait(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}
