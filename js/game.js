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


const playersEl =
  document.getElementById("players");

const potEl =
  document.getElementById("pot");

const statusEl =
  document.getElementById("status");

const countdownEl =
  document.getElementById("countdown");

const resultEl =
  document.getElementById("result");

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


let currentUser = null;

let profile = null;

let gameId = null;

let game = null;

let spinning = false;

let wheelRotation = 0;


/* LOGOUT */

document
  .getElementById("logoutBtn")
  .addEventListener("click", async () => {

    await signOut(auth);

    location.href = "./login.html";

  });


/* AUTH */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      location.href = "./login.html";

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

      statusEl.textContent =
        "Foydalanuvchi topilmadi.";

      return;

    }

    profile =
      snapshot.val();

    await findGame();

  }
);


/* GAME TOPISH */

async function findGame() {

  const snapshot =
    await get(
      ref(db, "games")
    );

  const games =
    snapshot.val() || {};

  let found = null;

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

      found = id;

      break;

    }

  }


  if (found) {

    gameId = found;

  } else {

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
        status: "waiting",

        players: {},

        totalPot: 0,

        createdAt:
          Date.now()
      }
    );

  }


  watchGame();

}


/* FIREBASE REALTIME */

function watchGame() {

  onValue(
    ref(
      db,
      `games/${gameId}`
    ),
    snapshot => {

      game =
        snapshot.val();

      if (!game) return;

      renderGame();

    }
  );

}


/* RENDER */

function renderGame() {

  const players =
    Object.entries(
      game.players || {}
    );

  const totalPot =
    players.reduce(
      (sum, [, player]) =>
        sum + Number(player.bet || 0),
      0
    );


  potEl.textContent =
    totalPot.toLocaleString(
      "uz-UZ"
    ) + " UZS";


  /*
     PLAYER CARDS
  */

  playersEl
    .querySelectorAll(
      ".player-card"
    )
    .forEach(
      (card, index) => {

        const entry =
          players[index];

        const name =
          card.querySelector(
            ".player-name"
          );

        const bet =
          card.querySelector(
            ".player-bet"
          );

        const status =
          card.querySelector(
            ".player-status"
          );


        if (!entry) {

          name.textContent =
            "Kutilmoqda...";

          bet.textContent =
            "—";

          status.textContent =
            "Bo‘sh";

          status.className =
            "player-status";

          return;

        }


        const player =
          entry[1];


        name.textContent =
          player.username;


        bet.textContent =
          Number(
            player.bet
          ).toLocaleString(
            "uz-UZ"
          ) + " UZS";


        if (player.ready) {

          status.textContent =
            "✓ Tayyor";

          status.className =
            "player-status ready";

        } else {

          status.textContent =
            "⏳ Kutilmoqda";

          status.className =
            "player-status";

        }

      }
    );


  /*
     SPINNER NOMLARI
  */

  const names =
    players.map(
      ([, player]) =>
        player.username
    );


  document.getElementById("name1")
    .textContent =
      names[0] || "Kutilmoqda";

  document.getElementById("name2")
    .textContent =
      names[1] || "Kutilmoqda";

  document.getElementById("name3")
    .textContent =
      names[2] || "Kutilmoqda";


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
      `Sizning stavkangiz: ${
        Number(mine.bet)
          .toLocaleString("uz-UZ")
      } UZS`;

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
     READY TEKSHIRISH
  */

  if (
    players.length === 3
  ) {

    const allReady =
      players.every(
        ([, player]) =>
          player.ready === true
      );


    if (allReady) {

      statusEl.textContent =
        "3 / 3 ishtirokchi tayyor.";

      if (
        game.status === "waiting" &&
        !spinning
      ) {

        startRound();

      }

    } else {

      const readyCount =
        players.filter(
          ([, player]) =>
            player.ready
        ).length;

      statusEl.textContent =
        `${readyCount} / 3 ishtirokchi tayyor.`;

    }

  }

  else {

    statusEl.textContent =
      `${players.length} / 3 ishtirokchi.`;

  }


  /*
     NATIJA
  */

  if (
    game.status === "finished" &&
    game.winnerUsername
  ) {

    resultEl.textContent =
      `🏆 ${game.winnerUsername} G‘OLIB!`;

  }

}


/* JOIN */

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

      statusEl.textContent =
        "Minimal stavka 1 000 UZS.";

      return;

    }


    const balance =
      Number(
        profile.balance || 0
      );


    if (bet > balance) {

      statusEl.textContent =
        "Balans yetarli emas.";

      return;

    }


    if (
      Object.keys(
        game.players || {}
      ).length >= 3
    ) {

      statusEl.textContent =
        "Bu o‘yin to‘ldi.";

      return;

    }


    /*
       PULNI BALANSDAN YECHAMIZ
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
       ISHTIROKCHINI YOZAMIZ
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
);


/* READY */

readyBtn.addEventListener(
  "click",
  async () => {

    const mine =
      game.players?.[
        currentUser.uid
      ];


    if (!mine) return;


    readyBtn.disabled =
      true;


    await update(
      ref(
        db,
        `games/${gameId}/players/${currentUser.uid}`
      ),
      {
        ready: true
      }
    );

  }
);


/* START ROUND */

async function startRound() {

  if (spinning) return;

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
     BANK
  */

  const totalPot =
    players.reduce(
      (sum, [, player]) =>
        sum + Number(player.bet),
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
        totalPot
    }
  );


  for (
    let i = 3;
    i >= 1;
    i--
  ) {

    countdownEl.textContent =
      i;

    await wait(1000);

  }


  countdownEl.textContent =
    "";


  /*
     TASODIFIY G‘OLIB
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
     3 SEKTOR:
     
     0°   = 1-o‘yinchi
     120° = 2-o‘yinchi
     240° = 3-o‘yinchi
  */

  const sectorCenter =
    winnerIndex * 120 + 60;


  const fullTurns =
    6 * 360;


  const finalRotation =
    wheelRotation +
    fullTurns +
    (360 - sectorCenter);


  wheelRotation =
    finalRotation;


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
     SPINNER
  */

  wheel.style.transform =
    `rotate(${finalRotation}deg)`;


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


  const newBalance =
    Number(
      winnerProfile.balance || 0
    ) + totalPot;


  await update(
    ref(
      db,
      `users/${winnerUid}`
    ),
    {
      balance:
        newBalance
    }
  );


  /*
     O‘YINNI YAKUNLASH
  */

  await update(
    ref(
      db,
      `games/${gameId}`
    ),
    {

      status:
        "finished",

      finishedAt:
        Date.now(),

      winnerUid:
        winnerUid,

      winnerUsername:
        winnerUsername

    }
  );


  resultEl.textContent =
    `🏆 ${winnerUsername} G‘OLIB!`;


  spinning = false;

}


function wait(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );

}
