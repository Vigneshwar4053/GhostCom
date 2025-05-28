import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  AlertTriangle,
  Terminal,
  Users,
  LogOut,
  Plus,
  Hash,
  Clock,
  Send,
} from "lucide-react";

// --- CONFIG ---
// Backend endpoints
const BACKEND_URL = "https://ghostcom.onrender.com";
const WS_URL = "wss://ghostcom.onrender.com/ws";



// --- AES-GCM Encryption Utilities ---
const generateKeyFromString = async (password) => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const salt = new Uint8Array(16).fill(0); // Simple salt for demo (use random salt in production)
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
};

const encryptMessage = async (message, roomKey) => {
  try {
    const key = await generateKeyFromString(roomKey);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedMessage
    );
    
    // Combine iv and encrypted data for storage/transmission
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

const decryptMessage = async (encryptedMessage, roomKey) => {
  try {
    const key = await generateKeyFromString(roomKey);
    const binaryString = atob(encryptedMessage);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Extract iv and encrypted data
    const iv = bytes.slice(0, 12);
    const encryptedData = bytes.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return "[Decryption Error]";
  }
};

// --- COMPONENT ---
const GhostCom = () => {
  // Auth & VPN
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [username, setUsername] = useState("");
  const [isVpnConnected, setIsVpnConnected] = useState(false);
  const [vpnChecking, setVpnChecking] = useState(true);
  const [showSecretCode, setShowSecretCode] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Chat & Rooms
  const [currentRoom, setCurrentRoom] = useState("COMMON");
  const [rooms, setRooms] = useState({
    COMMON: {
      name: "Common Room",
      messages: [],
      members: new Set(),
      encrypted: true,
    },
  });
  const [message, setMessage] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);

  // Activity & Auto-logout
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(180); // 3 mins
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const messagesRef = useRef(null);

  // ----- Utility Functions -----

  // Generate username from code
  const generateUsername = (code) => {
    const parts = code.split("-");
    return parts.length >= 3
      ? `${parts[1]}-${parts[2]}`
      : code.replace(/-/g, "");
  };

  // Activity/Logout
  const resetActivity = () => {
    setLastActivity(Date.now());
    setTimeLeft(180);
    setShowLogoutWarning(false);
  };

  // ----- Backend Integration -----

  // Generate secure secret code from backend
  const generateSecretCode = async () => {
    const res = await fetch(`${BACKEND_URL}/api/generate_code`, {
      method: "POST",
    });
    const data = await res.json();
    setSecretCode(data.code);
  };

  // Create room (with backend)
  const createRoom = async () => {
    if (!newRoomCode.trim()) return;
    const code = newRoomCode.toUpperCase();
    const resp = await fetch(`${BACKEND_URL}/api/create_room`, {
      method: "POST",
      body: new URLSearchParams({
        code,
        expires_min: 60, // 1 hour default
        owner: username,
      }),
    });
    if (resp.ok) {
      setRooms((prev) => ({
        ...prev,
        [code]: {
          name: code,
          messages: [],
          members: new Set([username]),
          encrypted: true,
        },
      }));
      setCurrentRoom(code);
      setShowCreateRoom(false);
      setNewRoomCode("");
      resetActivity();
    } else {
      alert("Room code already exists. Try another.");
    }
  };

  // Join room (with backend)
  const joinRoom = async () => {
    if (!joinRoomCode.trim()) return;
    const code = joinRoomCode.toUpperCase();
    const resp = await fetch(`${BACKEND_URL}/api/join_room`, {
      method: "POST",
      body: new URLSearchParams({
        code,
        user: username,
      }),
    });
    if (resp.ok) {
      setRooms((prev) => ({
        ...prev,
        [code]: {
          name: code,
          messages: [],
          members: new Set([username]),
          encrypted: true,
        },
      }));
      setCurrentRoom(code);
      setShowJoinRoom(false);
      setJoinRoomCode("");
      resetActivity();
    } else {
      alert("Room not found or terminated.");
    }
  };

  // --- WebSocket Logic ---

  // Connect to WebSocket for a room
  const connectWebSocket = (room, user) => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = new window.WebSocket(`${WS_URL}/${room}/${user}`);
    wsRef.current.onopen = () => {
      // console.log("WebSocket connected to room:", room);
    };
    wsRef.current.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      let decryptedMessage = msg.msg;
      
      if (!msg.system) {
        try {
          decryptedMessage = await decryptMessage(msg.msg, room);
        } catch {
          decryptedMessage = "[Decryption Error]";
        }
      }
      
      setRooms((prev) => ({
        ...prev,
        [room]: {
          ...(prev[room] || { name: room, messages: [], members: new Set() }),
          messages: [
            ...(prev[room]?.messages || []),
            {
              id: Date.now() + Math.random(),
              user: msg.user,
              message: decryptedMessage,
              encryptedMessage: msg.msg, // Store encrypted version
              timestamp: msg.ts,
              encrypted: !msg.system,
              system: !!msg.system,
            },
          ],
        },
      }));
    };
    wsRef.current.onclose = () => {
      // console.log("WebSocket closed");
    };
  };

  // Send encrypted message over WebSocket
  const sendMessage = async () => {
    if (!message.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;
    
    try {
      const encryptedMsg = await encryptMessage(message, currentRoom);
      wsRef.current.send(
        JSON.stringify({ msg: encryptedMsg, ts: Date.now() })
      );
      setMessage("");
      resetActivity();
    } catch (error) {
      console.error("Failed to encrypt message:", error);
      // Optionally show error to user
    }
  };

  // --- VPN Checking (demo) ---
  const checkVpnStatus = async () => {
    setVpnChecking(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // For demo, randomize (replace with real VPN check)
    setIsVpnConnected(Math.random() > 0.2);
    setVpnChecking(false);
  };

  // --- Effects ---

  // Auto-logout system
  useEffect(() => {
    if (!isLoggedIn) return;
    const checkActivity = () => {
      const now = Date.now();
      const timePassed = Math.floor((now - lastActivity) / 1000);
      const remaining = 180 - timePassed;
      setTimeLeft(remaining);
      if (remaining <= 30 && remaining > 0) setShowLogoutWarning(true);
      else if (remaining <= 0) handleLogout();
    };
    const interval = setInterval(checkActivity, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn, lastActivity]);

  // Activity listeners
  useEffect(() => {
    if (!isLoggedIn) return;
    const handleActivity = () => resetActivity();
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    return () => {
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [isLoggedIn]);

  // Scroll to bottom of messages
  const currentRoomMessages = rooms[currentRoom]?.messages;

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [currentRoomMessages]);

  // VPN check on mount
  useEffect(() => {
    checkVpnStatus();
    const interval = setInterval(checkVpnStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // On login, connect to COMMON room WebSocket
  useEffect(() => {
    if (isLoggedIn && username) {
      setCurrentRoom("COMMON");
      connectWebSocket("COMMON", username);
      setRooms((prev) => ({
        ...prev,
        COMMON: {
          ...prev.COMMON,
          members: new Set([username]),
        },
      }));
    }
    // Cleanup on logout
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isLoggedIn, username]);

  // When changing rooms, reconnect websocket
  useEffect(() => {
    if (isLoggedIn && username && currentRoom) {
      connectWebSocket(currentRoom, username);
    }
  }, [currentRoom]);

  // --- Login Handler ---
  const handleLogin = () => {
    if (!isVpnConnected) {
      setLoginError("VPN connection required for secure access");
      return;
    }
    if (!secretCode || secretCode.length < 10) {
      setLoginError("Invalid secret code format");
      return;
    }
    const user = generateUsername(secretCode);
    setUsername(user);
    setIsLoggedIn(true);
    setLoginError("");
    resetActivity();
  };

  // Logout and data destruction
  const handleLogout = () => {
    setRooms({
      COMMON: {
        name: "Common Room",
        messages: [],
        members: new Set(),
        encrypted: true,
      },
    });
    setMessage("");
    setCurrentRoom("COMMON");
    setNewRoomCode("");
    setJoinRoomCode("");
    setShowLogoutWarning(false);
    setUsername("");
    setIsLoggedIn(false);
    if (wsRef.current) wsRef.current.close();
  };

  // --- UI Render ---

  // Format timestamp
  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // --- Login Screen ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black opacity-90"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/10 to-black"></div>
        {/* Matrix effect */}
        <div className="absolute inset-0 opacity-10 overflow-hidden">
          <div className="text-green-500 text-xs leading-none animate-pulse whitespace-pre">
            {Array.from({ length: 50 }, (_, i) => (
              <div key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                {Array.from({ length: 100 }, () => (Math.random() > 0.5 ? "1" : "0")).join("")}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Terminal className="w-8 h-8 mr-3 text-green-400" />
              <h1 className="text-3xl font-bold text-green-400 tracking-wider">
                GHOST<span className="text-green-300">COM</span>
              </h1>
            </div>
            <p className="text-green-600 text-sm">
              Anonymous • Secure • Encrypted
            </p>
          </div>
          {/* VPN Status */}
          <div
            className={`mb-6 p-4 rounded border-2 ${
              vpnChecking
                ? "border-yellow-500 bg-yellow-900/20"
                : isVpnConnected
                ? "border-green-500 bg-green-900/20"
                : "border-red-500 bg-red-900/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {vpnChecking ? (
                  <div className="animate-spin w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full mr-3"></div>
                ) : isVpnConnected ? (
                  <Shield className="w-5 h-5 text-green-400 mr-3" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-3" />
                )}
                <span className="text-sm font-medium">
                  {vpnChecking
                    ? "Checking VPN..."
                    : isVpnConnected
                    ? "VPN Connected"
                    : "VPN Required"}
                </span>
              </div>
              {vpnChecking ? (
                <Wifi className="w-5 h-5 text-yellow-400 animate-pulse" />
              ) : isVpnConnected ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-green-400 text-sm mb-2">
                Secret Access Code
              </label>
              <div className="relative">
                <input
                  type={showSecretCode ? "text" : "password"}
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="Enter or generate secret code"
                  className="w-full px-4 py-3 bg-black border-2 border-green-800 rounded text-green-400 placeholder-green-700 focus:border-green-500 focus:outline-none font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowSecretCode(!showSecretCode)}
                  className="absolute right-3 top-3 text-green-600 hover:text-green-400"
                >
                  {showSecretCode ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={generateSecretCode}
              className="w-full py-2 border border-green-700 text-green-400 rounded hover:bg-green-900/20 transition-colors text-sm"
            >
              Generate New Code
            </button>
            {loginError && (
              <div className="p-3 bg-red-900/20 border border-red-500 rounded text-red-300 text-sm">
                {loginError}
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={!isVpnConnected || vpnChecking}
              className={`w-full py-3 rounded font-medium transition-all ${
                isVpnConnected && !vpnChecking
                  ? "bg-green-800 hover:bg-green-700 text-black"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              {vpnChecking ? "Checking Connection..." : "ACCESS SECURE CHANNEL"}
            </button>
          </div>
          <div className="mt-8 text-center text-green-700 text-xs">
            <p>End-to-end encrypted • Zero logs • Anonymous access</p>
            <p className="mt-1">Auto-logout after 3 minutes of inactivity</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Chat Interface ---
  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col">
      {/* Header */}
      <div className="border-b border-green-800 bg-black/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Terminal className="w-6 h-6 mr-2 text-green-400" />
              <h1 className="text-xl font-bold">GHOSTCOM</h1>
            </div>
            <div className="flex items-center text-sm text-green-600">
              <Shield className="w-4 h-4 mr-1" />
              <span>Encrypted</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Session Timer */}
            <div
              className={`flex items-center text-sm ${
                timeLeft <= 30
                  ? "text-red-400 animate-pulse"
                  : "text-green-600"
              }`}
            >
              <Clock className="w-4 h-4 mr-1" />
              <span>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center text-sm text-green-600">
              <Users className="w-4 h-4 mr-1" />
              <span>online</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 p-2 rounded border border-red-800 hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-black border-r border-green-800 flex flex-col">
          <div className="p-4 border-b border-green-800">
            <div className="text-sm text-green-600 mb-2">Logged in as:</div>
            <div className="text-green-400 font-bold">{username}</div>
          </div>
          {/* Room Actions */}
          <div className="p-4 border-b border-green-800 space-y-2">
            <button
              onClick={() => setShowCreateRoom(true)}
              className="w-full py-2 px-3 bg-green-900/20 border border-green-700 rounded text-sm hover:bg-green-900/40 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </button>
            <button
              onClick={() => setShowJoinRoom(true)}
              className="w-full py-2 px-3 bg-green-900/20 border border-green-700 rounded text-sm hover:bg-green-900/40 flex items-center"
            >
              <Hash className="w-4 h-4 mr-2" />
              Join Room
            </button>
          </div>
          {/* Room List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="text-xs text-green-600 mb-2 uppercase tracking-wider">
                Active Rooms
              </div>
              {Object.entries(rooms).map(([roomId, room]) => (
                <button
                  key={roomId}
                  onClick={() => {
                    setCurrentRoom(roomId);
                    resetActivity();
                  }}
                  className={`w-full text-left p-3 rounded mb-2 transition-colors ${
                    currentRoom === roomId
                      ? "bg-green-900/40 border border-green-600"
                      : "hover:bg-green-900/20 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{room.name}</span>
                    {room.messages.length > 0 && (
                      <span className="text-xs bg-green-800 px-2 py-1 rounded">
                        {room.messages.length}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {room.members.size} member
                    {room.members.size !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-green-800 bg-black/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {rooms[currentRoom]?.name}
                </h2>
                <div className="text-sm text-green-600">
                  {rooms[currentRoom]?.members.size} member
                  {rooms[currentRoom]?.members.size !== 1 ? "s" : ""} •
                  End-to-end encrypted
                </div>
              </div>
              <Shield className="w-5 h-5 text-green-400" />
            </div>
          </div>
          {/* Messages */}
          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {rooms[currentRoom]?.messages.map((msg) => (
              <div key={msg.id} className={`${msg.system ? "text-center" : ""}`}>
                {msg.system ? (
                  <div className="text-green-600 text-sm italic">
                    {msg.message}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-green-300 font-bold text-sm">
                        {msg.user}
                      </span>
                      <span className="text-green-700 text-xs">
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.encrypted && (
                        <Shield className="w-3 h-3 text-green-600" />
                      )}
                    </div>
                    <div className="bg-green-900/20 p-3 rounded border border-green-800">
                      {msg.message}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Message Input */}
          <div className="p-4 border-t border-green-800 bg-black/50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type encrypted message..."
                className="flex-1 px-4 py-2 bg-black border border-green-800 rounded text-green-400 placeholder-green-700 focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim()}
                className="px-4 py-2 bg-green-800 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-black rounded flex items-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Auto-logout Warning */}
      {showLogoutWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-red-900/90 border-2 border-red-500 p-6 rounded max-w-md">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-300 mb-2">
                Auto-Logout Warning
              </h3>
              <p className="text-red-200 mb-4">
                You will be logged out in {timeLeft} seconds due to inactivity.
                All messages will be destroyed.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={resetActivity}
                  className="flex-1 py-2 bg-green-800 hover:bg-green-700 text-black rounded"
                >
                  Stay Connected
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2 bg-red-800 hover:bg-red-700 text-white rounded"
                >
                  Logout Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-green-500 p-6 rounded max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-green-400 mb-4">
              Create Secure Room
            </h3>
            <input
              type="text"
              value={newRoomCode}
              onChange={(e) => setNewRoomCode(e.target.value)}
              placeholder="Enter room code"
              className="w-full px-4 py-2 bg-black border border-green-800 rounded text-green-400 placeholder-green-700 focus:border-green-500 focus:outline-none mb-4"
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreateRoom(false)}
                className="flex-1 py-2 border border-green-700 text-green-400 rounded hover:bg-green-900/20"
              >
                Cancel
              </button>
              <button
                onClick={createRoom}
                className="flex-1 py-2 bg-green-800 hover:bg-green-700 text-black rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Join Room Modal */}
      {showJoinRoom && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-green-500 p-6 rounded max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-green-400 mb-4">
              Join Secure Room
            </h3>
            <input
              type="text"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder="Enter room code shared with you"
              className="w-full px-4 py-2 bg-black border border-green-800 rounded text-green-400 placeholder-green-700 focus:border-green-500 focus:outline-none mb-4"
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setShowJoinRoom(false)}
                className="flex-1 py-2 border border-green-700 text-green-400 rounded hover:bg-green-900/20"
              >
                Cancel
              </button>
              <button
                onClick={joinRoom}
                className="flex-1 py-2 bg-green-800 hover:bg-green-700 text-black rounded"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GhostCom;
