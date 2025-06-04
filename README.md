link:https://ghost-com-3bmj-vigneshwars-projects-e04a18a1.vercel.app/

# 🕵️‍♂️ GhostCom – Anonymous & Secure Group Communication

GhostCom is an **anonymous, encrypted, and private group chat system** designed for those who need to communicate without fear of being tracked, watched, or identified. No emails. No phone numbers. No usernames. Just a **secret code**, encrypted messages, and trustless communication.

---

## 🚨 Why We Built GhostCom

In many places, people are afraid to speak up — about corruption, injustice, or even everyday issues — because systems aren't built to protect their identity. Apps collect too much data, governments track online activity, and privacy is often an illusion.

We built GhostCom because **privacy shouldn't be a privilege — it should be a right**.

GhostCom aims to:

* Let people **speak freely** without revealing their identity.
* Provide a **safe space for groups** (activists, whistleblowers, close teams) to communicate.
* Ensure messages are **end-to-end encrypted** and **invisible to outsiders**.
* Enforce **VPN usage** for extra protection.
* Keep **no logs, no accounts, no metadata**.

---

## 🛡️ Key Features

- **Anonymous login** using strong, random secret codes
- **End-to-end encrypted group messaging** using AES-GCM (Web Crypto API)
- **Per-room random salt** for strong key derivation (PBKDF2)
- **Key fingerprinting** for users to verify secure conversations
- **No personal data, no profiles, no tracking**
- **Web Crypto API support check** for strong browser security
- **Real-time WebSocket chat** with zero-knowledge backend (server can't decrypt)
- **VPN-awareness** for safer connections
- **Auto-logout after inactivity** for privacy
- **Extensible codebase**: ready for more features (forward secrecy, push notifications, etc.)

---

## 🚀 What’s Built So Far

- **Frontend**: React app with strong cryptography, modern UI, and anonymous room joining
- **Backend**: FastAPI server with per-room salt management, strong secrets, and secure WebSocket message relay
- **Security**: 
    - Random salt per room for strong PBKDF2 key derivation
    - AES-GCM encryption with versioning and message authentication
    - Key fingerprint display for user confirmation
    - Unique message IDs for replay protection
    - Zero-knowledge server: only relays encrypted blobs
- **User Experience**: 
    - VPN check reminder
    - Auto-logout for inactivity
    - No logins, no tracking, no metadata

---

## 📦 Tech Stack

- **Frontend**: React, Web Crypto API, modern CSS
- **Backend**: FastAPI (Python), WebSockets
- **Security**: PBKDF2, AES-GCM, per-room random salt

---

## 🤝 Want to Contribute?

GhostCom is open to developers, privacy advocates, and creatives who want to build something **that truly protects people**.

We're looking for help with:

- Frontend UI/UX
- Backend encryption and message routing
- VPN integration
- Push notification systems
- Security audits & testing
- Design and branding

Whether you're a student, hobbyist, or professional — if you care about **digital freedom**, we’d love to have you onboard.

### 👉 To contribute:

1. Fork this repo
2. Create a feature branch
3. Submit a pull request
4. Let’s make communication safer for everyone

---

## ⚠️ Disclaimer

GhostCom is a tool for **privacy**, not crime. Use responsibly and ethically.

---

## 🌍 Join the Mission

We’re not building just another app — we’re building **digital invisibility** for those who need it the most.
**Star** this repo, **share** the idea, and help us make the world a little safer to speak in.

