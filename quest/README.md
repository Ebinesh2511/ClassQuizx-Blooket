# QuizQuest 🦊🪙

A playful, real-time classroom quiz game. It's the revamp of the ClassQuiz codebase in this repo.

- **Gold Quest** is the default mode. It follows Blooket's Gold Quest rules: answer a question correctly to pick one of three treasure chests. Chests hold gold, double or triple gold, *Take 10% / 25%*, *Swap*, a dragon that steals 10% or 25% into the Dragon's Treasure, the rare *Dragon's Treasure* payout, or nothing. Most gold wins.
- **Classic** mode is Kahoot-style. Everyone answers the same question at once, and faster correct answers earn more points, plus streak bonuses.
- Every player gets a **random funny animal avatar** (`Sneaky Llama`, `Disco Penguin`…) that they can reroll or customise with colours and hats.
- The host screen has a **live leaderboard** with animated rank changes, a live action feed, the Dragon's Treasure pot, a timer, +1 min and end-game controls.
- Every game gets a **6-digit Game ID and a QR code** that points at the host's LAN address, so phones on the same Wi-Fi can scan and join.
- Quizzes are uploaded as **CSV**, by dropping a file or clicking to browse.

## Run it

```bash
cd quest
npm install
npm run dev        # http://localhost:3000, with hot reload
```

For production:

```bash
npm run build && npm start
# or
docker build -t quizquest . && docker run -p 3000:3000 quizquest
```

Set `PUBLIC_URL=https://quiz.example.com` when the app sits behind a domain, so the QR code uses it.

## CSV format

One question per row. A header row is optional.

```csv
Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer,Time Limit
How many legs does a spider have?,6,8,10,12,2,15
Which of these are mammals?,Dolphin,Shark,Bat,Penguin,1;3,25
```

- Only 2 answers are required. Up to 6 are supported.
- **Correct Answer** can be a number (`2`), a letter (`B`), or the answer text (`8`). Use `1;3` for several correct answers.
- **Time Limit** is in seconds and is optional. The default is 20 seconds, and the host can override it in Classic mode.
- Comma, semicolon or tab delimited files all work. Blooket's own CSV import template is detected automatically.
- See `samples/animal-trivia.csv`, or click **CSV template** on the host page.

## Try it with bots

```bash
node scripts/bots.js <GAME_ID> 8
```

This fills a lobby with 8 bot players. In Gold Quest they play on their own and learn answers as they go.

## Project layout

```
server/index.js     Express + Socket.IO server; Vite middleware in dev
server/game.js      Game engine: lobby, Gold Quest chests, Classic rounds
src/views/          Home, HostSetup, Host (live), Play, GoldQuest, ClassicPlayer
src/lib/            Avatars, CSV parser, chest, leaderboard, podium, sounds
```

Games live in memory, so restarting the server ends any running games. `npm test` runs the unit tests plus end-to-end tests that start the real server and drive it with Socket.IO clients. They cover joining, resume, kick, late joins, the Gold Quest live action feed (newest first), take/swap hits, the timer and end, and Classic rounds.
