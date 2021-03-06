var app = require("express")();
const express = require("express");
var server = require("http").Server(app);
var io = require("socket.io")(server);
var path = require("path");
const width = 9;
const height = 16;
const COUNTDOWN = 10;
const blocks = [
  [
    [0, 1, 0],
    [0, 0, 0],
    [1, 1, 1]
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [1, 1, 0]
  ],
  [
    [1, 1, 1],
    [0, 0, 0],
    [1, 0, 1]
  ],
  [
    [1, 1, 1],
    [0, 0, 0],
    [1, 1, 1]
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0]
  ],
  [
    [1, 0, 1],
    [0, 0, 0],
    [1, 0, 1]
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]
];

var map = generateMap();

let players = {};
let leaderboard = [];
let displayWinner = false;

const PORT = process.env.PORT || 80;
server.listen(PORT);

console.log("What are ya doin here? - Kyle");

const public = path.join(__dirname, "..", "public");

app.use(express.static(public));
app.get("/", mainMenu);
app.get("/play", playGame);

function mainMenu(req, res, next) {
  res.status(200).sendFile("./menu.html", { root: public });
}

function playGame(req, res, next) {
  res.status(200).sendFile("./game.html", { root: public });
}

const State = {
  Playing: "Playing",
  Spectating: "Spectating",
  Starting: "Starting",
  Waiting: "Waiting"
};

let state = State.Waiting;
let countdown = COUNTDOWN;
// let buffer = 0;

setInterval(() => {
  if (state === State.Playing && Object.keys(players).length > 0) {
    for (const id in players) {
      if (Date.now() - players[id].lastReq > 10000) {
        if (!players[id].dead) {
          io.emit("dead", id);
          io.sockets.connected[id].disconnect();
          delete players[id];
          leaderboard = leaderboard.filter((player) => id !== player.id);
        }
      }
    }

    checkState();
    io.emit("gameData", players);
  }
}, 3000);

io.on("connection", function(socket) {
  socket.emit("map", map);

  players[socket.id] = {
    x: 0,
    y: 0,
    username: "",
    colour: { r: 0, g: 0, b: 255 },
    dx: 0,
    dy: 0,
    shot: { x1: 0, x2: 100, y1: 0, y2: 100, alpha: 0 },
    id: socket.id,
    dead: true,
    lastReq: Date.now()
  };

  console.log(
    `New connection: ${Object.keys(players).length} players now connected.`
  );

  io.emit("leaderboard", leaderboard);

  switch (state) {
    case State.Waiting:
      if (Object.keys(players).length > 1) {
        startGameCountdown();
      }
      socket.emit("state", State.Waiting);
      break;
    case State.Starting:
      socket.emit("state", State.Starting, countdown);
      break;
    case State.Playing:
      socket.emit("state", State.Spectating);
      break;
  }

  socket.on("move", data => {
    if (state !== State.Playing) return;

    const { x, y, dx, dy } = data;
    const player = players[socket.id];

    if (!player) return;
    if (!(dx === 0 && dy === 0)) {
      player.lastReq = Date.now();
    }

    player.dx = dx;
    player.dy = dy;
    player.x = x;
    player.y = y;

    io.emit("gameData", players);
    checkState();
  });

  socket.on("fire", ({ shot, oldHeight, oldWidth }) => {
    if (state !== State.Playing) return;

    const player = players[socket.id];
    player.shot = shot;
    player.lastReq = Date.now();
    socket.broadcast.emit("fire", {
      player: player,
      oldHeight: oldHeight,
      oldWidth: oldWidth
    });
  });

  socket.on("kill", id => {
    if (state !== State.Playing) return;
    if (players[socket.id].dead) return;

    io.emit("dead", id);
    const player = players[id];
    let leaderPlayer = leaderboard.find(player => player.id === socket.id);
    leaderPlayer.score++;
    io.emit("leaderboard", leaderboard);
    if (player) {
      player.dead = true;
    }
  });

  socket.on("join", ({ username, colour}) => {
    const player = players[socket.id];
    player.username = username;
    player.colour = colour;
    leaderboard.push({
      username,
      id: socket.id,
      score: 0,
    });
    io.emit("leaderboard", leaderboard);
    io.emit("gameData", players);
  });

  socket.on("disconnect", data => {
    delete players[socket.id];
    console.log(
      `Disconnection: ${Object.keys(players).length} players now connected.`
    );

    checkState();
    leaderboard = leaderboard.filter(player => player.id !== socket.id);
    io.emit("leaderboard", leaderboard);
  });
});

function onStart(id) {
  let x, y;

  while (!x || map[x][y] === 1) {
    x = Math.floor(Math.random() * height);
    y = Math.floor(Math.random() * width);
  }

  x = x + 0.5;
  y = y + 0.5;

  players[id].x = x;
  players[id].y = y;
  players[id].lastReq = Date.now();
  players[id].shot = { x1: 0, x2: 100, y1: 0, y2: 100, alpha: 0 };

  io.to(`${id}`).emit("startingPos", { x, y });
}

function startGameCountdown() {
  if (state === State.Starting) {
    return;
  }

  for (const id in players) {
    players[id].dead = false;
  }

  io.emit("gameData", players);
  map = generateMap();
  io.emit("map", map);

  countdown = COUNTDOWN;
  state = State.Starting;
  gameCountdown();
}

function gameCountdown() {
  if (countdown > 0) {
    countdown--;
    io.emit("state", State.Starting, countdown);

    setTimeout(gameCountdown, 1000);
    return;
  }

  state = State.Playing;

  for (const id in players) {
    onStart(id);
  }

  io.emit("gameData", players);
}

function checkState() {
  if (displayWinner) return;
  let live = 0;
  for (const [_, player] of Object.entries(players)) {
    if (!player.dead) live++;
  }

  if (live <= 1) {
    state = State.Waiting;
    if (live === 1) {
      displayWinner = true;
      const winner = players[Object.keys(players).find(key => players[key].dead === false)];

      let leaderPlayer = leaderboard.find(({id}) => id === winner.id);
      leaderPlayer.score += Object.keys(players).length;
      io.emit("leaderboard", leaderboard);
      io.emit(
        "winner",
        winner
      );
    }

    setTimeout(() => {
      if (Object.keys(players).length > 1) {
        startGameCountdown();
      }
      displayWinner = false;
      io.emit("state", state);
    }, 4000);
  }
}

// < ----- Map Generation ----- >

function generateMap() {
  let map = new Array();

  // populate
  for (let j = 0; j < height; j++) {
    map.push([]);
    for (let i = 0; i < width; i++) {
      map[j].push(0);
    }
  }

  // add blocks
  for (let j = 0; j < height; j += 4) {
    let i = 0;
    while (i < width) {
      if (map[j][i] === 0) {
        let block = blocks[Math.floor(Math.random() * blocks.length)];
        let rotations = Math.floor(Math.random() * 3);
        for (let r = 0; r < rotations; r++) block = rotateBlock(block);
        insertBlock(map, i, j, block);
      }
      i += 4;
    }
  }
  return map;
}

function insertBlock(map, x, y, block) {
  for (let j = 0; j < block.length; j++) {
    for (let i = 0; i < block[0].length; i++) {
      map[y + j][x + i] = block[j][i];
    }
  }
  return true;
}

function rotateBlock(block) {
  rotated = [];
  for (let j = 0; j < block.length; j++) {
    rotated.push([]);
    for (let i = 0; i < block[0].length; i++) {
      rotated[j].push(block[block.length - i - 1][j]);
    }
  }
  return rotated;
}
