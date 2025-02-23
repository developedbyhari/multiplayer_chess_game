import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Chess } from 'chess.js';
import './Chessboard.css';

const socket = io('https://192.168.31.190:3001',{
    rejectUnauthorized: false, 
});

const Chessboard = () => {
  const [board, setBoard] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [game] = useState(new Chess());
  const [userColor, setUserColor] = useState('white'); // Assume User 1 is White
  const [activeTurn, setActiveTurn] = useState('white'); // White starts
  const [muted, setMuted] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [users, setUsers] = useState({});

  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    // Initialize board state
    socket.on('gameState', (fen) => {
      game.load(fen);
      setBoard(generateBoard(game));
      setActiveTurn(game.turn() === 'w' ? 'white' : 'black');
    });

    socket.on('playerColor', (color) => {
        setUserColor(color); // Save the assigned color
        console.log('Your color:', color);
      });
    socket.on('players', (color) => {
        setUsers(color)
      });

    // Listen for invalid move
    socket.on('invalidMove', (message) => {
      alert(message);
    });

    // Listen for check and game over
    socket.on('gameCheck', (message) => {
      alert(message);
    });

    socket.on('gameOver', (message) => {
      alert(message);
    });



    return () => {
      socket.off('gameState');
      socket.off('invalidMove');
      socket.off('gameCheck');
      socket.off('gameOver');
    };
  }, [game]);


  useEffect(() => {

  
  

      // audio call
      socket.on('offer', async ({ offer, from }) => {
        await createPeerConnection(from);
        console.log(from,'lksflkjasdsadasdsfsldkf')
        await peerConnectionRef.current.setRemoteDescription(offer);
        console.log("offer triggered")
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit('answer', { answer, to: from });
      });

      socket.on('answer', async ({ answer }) => {
        console.log("answer triggered", answer)
        await peerConnectionRef.current.setRemoteDescription(answer);
      });

      socket.on('ice-candidate', ({ candidate }) => {
        if (candidate) {
          console.log('Received ICE candidate:', candidate, peerConnectionRef);
          peerConnectionRef?.current?.addIceCandidate(candidate).catch((err) => {
            console.error('Error adding received ICE candidate:', err);
          });
        }
      });

    

  }, []);

  const generateBoard = (game) => {
    return game.board().map((row, rowIndex) =>
      row.map((cell, colIndex) => ({
        square: `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}`,
        piece: cell ? (cell.color === 'w' ? cell.type.toUpperCase() : cell.type) : '',
      }))
    );
  };

  const handleSquareClick = (square) => {
    if (activeTurn !== userColor) {
      alert(`It is ${activeTurn}'s turn!`);
      return;
    }
  
    if (selectedSquare) {
      const move = { from: selectedSquare, to: square }; // No color here
      socket.emit('makeMove', move);
      setSelectedSquare(null); // Deselect after move attempt
    } else {
      const piece = game.get(square);
      if (piece && piece.color === (userColor === 'white' ? 'w' : 'b')) {
        setSelectedSquare(square); // Select the square
      }
    }
  };

  const createPeerConnection = async (to) => {
    try {
      // Get user's audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      // Create a new RTCPeerConnection
      // const pc = new RTCPeerConnection({
      //   iceServers: [
      //     { urls: 'stun:stun.l.google.com:19302' }, // Valid STUN server
      //   ],
      // });
      const pc = new RTCPeerConnection();

      console.log('PeerConnection created:', pc);
      // Attach the local audio stream to the UI and add tracks to the PeerConnection
      localAudioRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      peerConnectionRef.current = pc

      // Handle ICE candidates
      // pc.onicecandidate = (event) => {
      //   if (event.candidate) {
      //     console.log('Sending ICE candidate:', event.candidate);
      //     socket.emit('ice-candidate', { candidate: event.candidate, to });
      //   }
      // };

      // Handle receiving remote stream
      pc.ontrack = (event) => {
        const [stream] = event.streams; // Extract the remote stream
        if (stream) {
          console.log('Receiving remote stream:', stream);
          remoteAudioRef.current.srcObject = stream;
        }
      };

      return pc; // Return the created RTCPeerConnection
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error; // Rethrow the error so the caller knows something went wrong
    }
  };


  const startCall = async () => {
 try{
  await createPeerConnection(sendTo);
  console.log(peerConnectionRef, peerConnectionRef)
  const offer = await peerConnectionRef.current.createOffer();
  await peerConnectionRef.current.setLocalDescription(offer);
  socket.emit('offer', { offer, to: sendTo });
 }catch(e){
   console.log(e)
 }
  };
  

  return (
    <div>
      <h1>{sendTo}-{JSON.stringify(users)}</h1>
      <div>
      {
            Object.keys(users).map((u) => {
              // if (socket.id === u) {
              //   return null
              // }
              return (
                <div onClick={() => {
                  setSendTo(u);             
                }} key={u} sx={{ maxWidth: 345, mb: 2, background: u === sendTo ? 'gray' : '' }}>
                  {u}
                </div>
              )
            })
          }
      </div>
     <video ref={localAudioRef} autoPlay controls volume={1.0} muted={true} />sss
     <video ref={remoteAudioRef} autoPlay controls volume={1.0} />
     <button onClick={startCall} variant='outlined' >call</button>
        <div>yours:- {userColor}- {socket.id}</div>
    <div className="chessboard">
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isSelected = selectedSquare === cell.square;
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`cell ${(rowIndex + colIndex) % 2 === 0 ? 'white' : 'black'} ${
                isSelected ? 'selected' : ''
              }`}
              onClick={() => handleSquareClick(cell.square)}
            >
              {renderPiece(cell.piece)}
            </div>
          );
        })
      )}
    </div>
    </div>
  );
};

const renderPiece = (piece) => {
  const pieceMap = {
    r: '♜',
    n: '♞',
    b: '♝',
    q: '♛',
    k: '♚',
    p: '♟︎',
    R: '♖',
    N: '♘',
    B: '♗',
    Q: '♕',
    K: '♔',
    P: '♙',
  };
  return pieceMap[piece] || '';
};

export default Chessboard;
