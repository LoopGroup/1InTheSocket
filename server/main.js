var app = require("express")();
const express = require("express");
var server = require("http").Server(app);
var io = require("socket.io")(server);
var path = require("path");
const width = 20;
const height = 20;
const blocks = [
  [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 1]
  ],
  [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0]
  ],
  [
    [1, 1, 1],
    [1, 0, 0],
    [1, 0, 1]
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
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0]
  ],
  [
    [1, 1, 0],
    [0, 0, 0],
    [0, 1, 0]
  ],
  [
    [1, 0, 1],
    [0, 0, 0],
    [0, 1, 0]
  ],
  [
    [1, 1, 1],
    [0, 0, 0],
    [0, 0, 0]
  ],
  [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0]
  ],
  [
    [0, 0, 0],
    [1, 1, 0],
    [0, 0, 0]
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0]
  ],
  [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]
];
var map = generateMap();

server.listen(80);
// WARNING: app.listen(80) will NOT work here!

console.log("GO to http://localhost:80");

const public = path.join(__dirname, "..", "public");

app.use(express.static(public));

io.on("connection", function(socket) {
  socket.emit("news", { hello: "world" });

  socket.on("new user", function(data) {
    let x = 0;
    let y = 0;
    getSpawn(map, x, y);
    socket.emit("map", map, x, y);
  });
});

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
  for (let j = 1; j < height - 1; j += 5) {
    let i = 1;
    while (i < width - 1) {
      if (map[j][i] == 0) {
        let block = blocks[Math.floor(Math.random() * blocks.length)];
        let rotations = Math.floor(Math.random() * 3);
        for (let r = 0; r < rotations; r++) block = rotateBlock(block);
        insertBlock(map, i, j, block);
      }
      i += 5;
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

function getSpawn(map, x, y) {
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (map[j][i] === 0) {
        y = j;
        x = i;
        return true;
      }
    }
  }
  return false;
}