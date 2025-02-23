const express = require('express');
const https = require("https");
const socketIo = require('socket.io');
const { Chess } = require('chess.js');
const cors = require('cors')
const app = express();
const fs = require('fs');

const options = {
    key: fs.readFileSync('key.pem'), // Path to private key
    cert: fs.readFileSync('cert.pem'), // Path to certificate
};
const server = https.createServer(options, app);
let game = new Chess();



const users = {}
const messages = {}
let board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
]

let activeuser = 'white'

let selectedSquare = null

function genChat(u1, u2) {
    return [u1, u2].sort().join('-')
}

app.use(cors({
    origin: ["https://192.168.31.190:3000", "https://localhost:3000"]
}))
const io = socketIo(server, {
    cors: {
        origin: ["https://192.168.31.190:3000", "https://localhost:3000"],
        methods: ['GET', 'POST']
    }
});

const players = {};

app.get('/', (req, res) => {
    console.log("server is up running")
    res.send("server is up running")
})

io.on('connection', (socket) => {

    socket.emit('id', socket.id)

    // Assign players their colors on connection
    if (Object.keys(players).length === 0) {
        players[socket.id] = 'white';
        socket.emit('playerColor', 'white'); // Inform the player of their color
    } else if (Object.keys(players).length === 1) {
        players[socket.id] = 'black';
        socket.emit('playerColor', 'black');
    } else {
        socket.emit('gameFull', 'The game is full!');
        socket.disconnect();
        return;
    }

    io.emit('players', players);


    // Send initial game state

    socket.emit('gameState', game.fen());


    // Handle moves
    socket.on('makeMove', (move) => {
        try {
            console.log(`Move received from ${socket.id}:`, move);

            const currentTurn = game.turn() === 'w' ? 'white' : 'black';
            const playerColor = players[socket.id]; // Get the player's assigned color

            // Check if it's the player's turn
            if (playerColor !== currentTurn) {
                socket.emit('invalidMove', `It is ${currentTurn}'s turn!`);
                return;
            }

            // Validate and process the move
            const result = game.move({ from: move.from, to: move.to });

            if (result) {
                console.log('Valid move:', result);
                io.emit('gameState', game.fen()); // Broadcast new state to all players
                if (game.isCheck()) {
                    io.emit('gameCheck', `${game.turn() === 'w' ? 'White' : 'Black'} is in check!`);
                }
                if (game.isCheckmate()) {
                    io.emit('gameOver', `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate!`);
                }
                if (game.isStalemate()) {
                    io.emit('gameOver', 'Game ends in stalemate!');
                }
            } else {
                socket.emit('invalidMove', `Invalid move from ${move.from} to ${move.to}`);
            }
        } catch (error) {
            console.log('Error:', error);
        }
    });

    socket.on('register', (name) => {
        users[socket.id] = name
        socket.emit('boardupdate', board)
        io.emit('user_joined', Object.entries(users).map(([id, name]) => ({ id, name })))
    })

    socket.on('boardupdate', (bd) => {
        board = bd
        socket.emit('boardupdate', board)
        io.emit('boardupdate', board)
    })
    socket.on('selectedSquare', (bd) => {
        selectedSquare = bd
        socket.emit('selectedSquare', selectedSquare)
        io.emit('selectedSquare', selectedSquare)
    })
    socket.on('activeuser', (dd) => {
        activeuser = dd
        socket.emit('activeuser', activeuser)
        io.emit('activeuser', activeuser)
    })

    socket.on('get_messages', (msg) => {
        const chatId = genChat(socket.id, msg.to)
        if (!messages[chatId]) {
            messages[chatId] = []
        }
        socket.emit('message', messages[chatId])
    })

    socket.on('send_messages', (msg) => {
        const chatId = genChat(socket.id, msg.to)
        if (messages[chatId]) {
            messages[chatId].push(msg)
            socket.emit('message', messages[chatId]);
            io.to(msg.to).emit('message', messages[chatId]);
        }
    })


    // audio call

    // Handle offer
    socket.on('offer', (data) => {
        const { offer, to } = data;
        io.to(to).emit('offer', { offer, from: socket.id });
    });

    // Handle answer
    socket.on('answer', (data) => {
        const { answer, to } = data;
        io.to(to).emit('answer', { answer, from: socket.id });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
        const { candidate, to } = data;
        io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
    });

    // socket.on('disconnect', () => {
    //     if (!users[socket.id]) {
    //         return null
    //     }
    //     delete users[socket.id]

    //     io.emit('user_joined', Object.entries(users).map(([id, name]) => ({ id, name })))
    // })
})

server.listen(3001)



