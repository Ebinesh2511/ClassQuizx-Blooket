<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

# ClassQuiz × Blooket: QuizQuest 🦊🪙

> **This is a fork of [mawoka-myblock/ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz).**
> It adds **QuizQuest**, a revamped, playful quiz app in the [`quest/`](quest/README.md) folder. It brings Blooket's
> **[Gold Quest](https://help.blooket.com/hc/en-us/articles/42100784373655-Game-Overview-Gold-Quest)** game mode as the **default**,
> and keeps a Kahoot-style **Classic** mode.

## What's new in this fork

- **Gold Quest is the default mode.** Answer correctly, then pick one of 3 treasure chests: gold, double or triple gold, take 10% or 25% from a player, swap gold, lose gold to the dragon, or win the Dragon's Treasure. Most gold wins.
- **Classic mode** is host-paced. Faster correct answers score more, with streak bonuses.
- **Revamped UI.** It's bright and playful, with bouncy 3D buttons, chest-opening animations, confetti, a podium reveal and sound effects. It works on phones and on projectors.
- **Random funny animal avatars** ("Sneaky Llama", "Disco Penguin") that players can reroll or customise with colours and hats.
- **CSV quiz upload** by drag and drop. Blooket's CSV template is supported too.
- **Host screen** with a live action feed (newest on top) and a live leaderboard on the right.
- **A QR code and 6-digit Game ID for every game**, so players can scan and join from their phones.
- No database or login needed. QuizQuest runs as a single Node.js server.

## Self-hosting QuizQuest

### Option 1: Node.js (v20 or newer)

```bash
git clone https://github.com/Ebinesh2511/ClassQuizx-Blooket.git
cd ClassQuizx-Blooket/quest
npm install
npm run build
npm start                 # serves on http://localhost:3000
```

Use `PORT=8080 npm start` to change the port. For development with hot reload, use `npm run dev`.

### Option 2: Docker

```bash
cd ClassQuizx-Blooket/quest
docker build -t quizquest .
docker run -d --name quizquest -p 3000:3000 --restart unless-stopped quizquest
```

### Letting players join

- **Same Wi-Fi (classroom):** open `http://localhost:3000` on the host computer and click **Host a game**. The QR code automatically uses your computer's network address, such as `http://192.168.1.7:3000`, so phones on the same Wi-Fi can scan it. Allow port 3000 through your firewall if phones can't connect.
- **Public domain:** put QuizQuest behind a reverse proxy with HTTPS and set `PUBLIC_URL` so the QR code points to your domain:

  ```bash
  docker run -d -p 3000:3000 -e PUBLIC_URL=https://quiz.example.com quizquest
  ```

  The proxy must forward WebSockets. Caddy does this out of the box:

  ```
  quiz.example.com {
      reverse_proxy localhost:3000
  }
  ```

  With nginx, add `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";` to the location block.

### Hosting a game

1. Click **Host a game**, then drop in a CSV file. You can also try the sample quiz or download the CSV template.
2. Pick **Gold Quest** (the default) or **Classic**, and choose the settings: a time limit or gold goal, or the time per question.
3. Click **Host now**. Players scan the QR code or enter the Game ID, then pick a nickname and animal.
4. Click **Start**. The host screen shows live action and the leaderboard, and a podium appears at the end.

CSV format:

```csv
Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer,Time Limit
How many legs does a spider have?,6,8,10,12,2,15
```

The correct answer can be a number, a letter or the answer text. Use `1;3` for multiple correct answers. See [`quest/README.md`](quest/README.md) for full details, the bot script and tests.

> Games are kept in memory, so restarting the server ends running games.

---

## Original ClassQuiz README

The upstream ClassQuiz app (with accounts, editor and database) is still in this repo, unchanged. Its original documentation follows.


<a href="https://github.com/mawoka-myblock/ClassQuiz/stargazers"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/mawoka-myblock/classquiz?style=for-the-badge"></a>
<a href="https://github.com/mawoka-myblock/ClassQuiz/graphs/contributors"><img alt="GitHub contributors" src="https://img.shields.io/github/contributors/mawoka-myblock/classquiz?color=green&style=for-the-badge"></a>
<a href="https://github.com/mawoka-myblock/ClassQuiz/network/members"><img alt="GitHub forks" src="https://img.shields.io/github/forks/mawoka-myblock/classquiz?style=for-the-badge"></a>
<a href="https://github.com/mawoka-myblock/ClassQuiz/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc"><img alt="GitHub issues" src="https://img.shields.io/github/issues/mawoka-myblock/classquiz?style=for-the-badge"></a>
<a href="https://github.com/mawoka-myblock/ClassQuiz/blob/master/LICENSE"><img alt="GitHub" src="https://img.shields.io/github/license/mawoka-myblock/classquiz?style=for-the-badge"></a>
<img alt="GitHub code size in bytes" src="https://img.shields.io/github/languages/code-size/mawoka-myblock/classquiz?style=for-the-badge">
[![DeepSource](https://deepsource.io/gh/mawoka-myblock/ClassQuiz.svg/?label=active+issues&show_trend=true&token=5-2Na9HN-2CXcGkHjah_Rk09&style=for-the-badge)](https://deepsource.io/gh/mawoka-myblock/ClassQuiz/)
<img alt="Snky badge" src="https://img.shields.io/badge/Snyk-Check-success?style=for-the-badge">
[![codecov](https://codecov.io/gh/mawoka-myblock/ClassQuiz/branch/master/graph/badge.svg?token=7CHK2A0AMO)](https://codecov.io/gh/mawoka-myblock/ClassQuiz)

<div align='center'>
    <h2 align='center'>ClassQuiz</h2>
    <img src='logo.png' alt='ClassQuiz Logo' height='100px' width='100px'>
    <p align='center'>
        The open-source quiz-platform!
        <br/>
        <a href='https://classquiz.de/'><strong>Visit the website »</strong></a>
        <br />
        <br />
        <a href='https://classquiz.de/docs'>Docs</a>
        ·
        <a href='https://classquiz.de/account/register'>Register</a>
        ·
        <a href='https://classquiz.de/docs/self-host'>Self-Hosting</a>
        ·
        <a href='https://matrix.to/#/#classquiz:matrix.org'>Matrix Space</a>
    </p>
</div>


## About ClassQuiz

ClassQuiz is a quiz app to learn interactively for students,
but open-source which is very important if it is a product for educational
purposes.
You can create quizzes and play them remotely with other people.
It is mainly made for teachers who create a
quiz, so students can compete with their knowledge against each other.

## Try it

There is a hosted version at [classquiz.de](https://classquiz.de?utm_medium=Github&utm_source=Readme). The server is
located in Karlsruhe, Germany and hosted by [netcup](https://mawoka.eu/redir?token=2), so expect some latency depending
on your location.

## Help/Community

Join our [Matrix Space](https://matrix.to/#/#classquiz:matrix.org) using [element](https://app.element.io)!

## Donating

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/K3K3CK3ES)

<a href="https://liberapay.com/Mawoka/donate"><img src="https://img.shields.io/liberapay/goal/Mawoka.svg?logo=liberapay"></a>

## Self-Host

Please see https://classquiz.de/docs/self-host

## Development

See https://classquiz.de/docs/develop

## Translation

ClassQuiz uses [hosted Weblate](https://hosted.weblate.org/engage/classquiz/)


<a href="https://hosted.weblate.org/engage/classquiz/">
<img src="https://hosted.weblate.org/widgets/classquiz/-/frontend/multi-auto.svg" alt="Übersetzungsstatus" />
</a>

## Docs

The docs are online at https://classquiz.de/docs

### Things to know about the structure

Since this repo is a monorepo, the frontend is located in
the [`frontend/`](https://github.com/mawoka-myblock/ClassQuiz/tree/master/frontend)-directory.
The backend-project (Pipfile) is in the root, but all the code is located in
the [`classquiz/`](https://github.com/mawoka-myblock/ClassQuiz/tree/master/frontend)-folder.

#### Tech-Stack

##### Backend

The backend is made with [FastAPI](https://fastapi.tiangolo.com/) (web-framework)
, [ormar](https://github.com/collerek/ormar/) (ORM)
, [python-socketio](https://python-socketio.readthedocs.io/en/latest/) (realtime-communication between server and
client)

##### Frontend

The frontend is made with [SvelteKit](https://kit.svelte.dev/) (web-framework)
and [TailwindCSS](https://tailwindcss.com/) (Css-Framework).

##### External Dependencies

Selfhostable:

- [Meilisearch](https://www.meilisearch.com/) (Search-Server)
- [Caddy](https://caddyserver.com/) (Reverse Proxy)
- [Postgres](https://www.postgresql.org/) (Database)
- [Redis](https://redis.io/) (Cache)

Closed-Source 3rd parties:

- [Mapbox](https://www.mapbox.com/) (maps)
- [hCaptcha](https://www.hcaptcha.com/) (captcha)

---

## License Note

This repository is licensed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/);

please review the license to understand your rights and obligations.[^1]

[^1]: I added this note, since people are stealing my software and changing it without providing the source-code.
