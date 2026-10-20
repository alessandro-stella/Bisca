# BISCA – Flussi dei dati

Ogni flusso descrive il comportamento **attuale** del codice.

## Convenzioni

- Percorsi backend: `src/routes/*` (REST), `src/sockets/*` (Socket.io), `src/game/*` (logica di gioco), `src/email/*`, `src/db.js`.
- Percorsi frontend: `public/scripts/*.js`, pagine in `public/*.html`.
- **Stato in memoria** (si perde al riavvio): `lobbies` (`lobbyManager.js`), `games` (`gameManager.js`), timer di riconnessione (`connectionHandlers.js`).
- **Stato su DB** (PostgreSQL): `users`, `sessions`, `games`, `elo_history`.
- La sessione è un UUID in `sessions` collegato al cookie `sessionId` (httpOnly, `sameSite=lax`, `secure` solo con `NODE_ENV=production`, durata 7 giorni). Non si usa JWT.
- `games.id` coincide con `lobby.id`.

---

# PARTE A – REST

## A1. Verifica disponibilità username/email

**Cosa deve avvenire:** durante la registrazione, l'utente è avvisato subito se username o email sono già usati.

**Percorso dei dati**

1. `register.js` → evento `blur` su username/email → `checkAvailability()`. Parte solo se username ≥ 3 caratteri e email con formato valido.
2. `POST /api/auth/checkUser` `{ username, email }`.
3. `authRouter.js`: `trim()` su username, `trim().toLowerCase()` su email.
4. `SELECT EXISTS(...)` su `users.username` e `users.email`.

**Effetto:** nessuna scrittura. Con 409 il client evidenzia i campi (`addErrors`); l'errore sparisce al successivo `input`.

**Errori**

| Condizione                  | Risposta                                | Gestione                                       |
| --------------------------- | --------------------------------------- | ---------------------------------------------- |
| Campo mancante              | 400 `{ error: "Missing fields" }`       | Il client controlla solo il 409, quindi ignora |
| Username/email già presenti | 409 `{ errors: { username?, email? } }` | `addErrors`                                    |
| Errore DB                   | 500 `{ error }`                         | Ignorato dal client                            |
| Errore di rete              | –                                       | `console.log`                                  |

Il controllo reale resta il vincolo `UNIQUE` al momento dell'`INSERT` (vedi A2).

---

## A2. Registrazione

**Cosa deve avvenire:** creare un account non verificato e inviare il link di verifica (valido 5 minuti).

**Percorso dei dati**

1. `register.js` (submit) validazione client: campi obbligatori, regex email, password ≥ 8, conferma password uguale.
2. `POST /api/auth/register` `{ username, email, password }`.
3. `authRouter.js` valida in ordine e restituisce il **primo** errore trovato: campi mancanti → lunghezza username 3-30 → spazi nello username → `isProfane(username)` → regex email → password ≥ 8.
4. `db.connect()` → `BEGIN`.
5. `bcrypt.hash(password, 10)` e `generateVerificationToken()` (32 byte, esadecimale).
6. `INSERT INTO users(... email_verification_token, email_verification_expires_at = NOW() + 5 min)` con `email_verified = FALSE` di default.
7. `COMMIT`.
8. `sendEmail(..., "verify_email", { username, verificationLink, expirationMinutes: 5 })` in modo non bloccante. Il link è `CLIENT_URL/verify-email.html?token=…`.
9. Risposta `201 { message, user: { id, username, email } }`.
10. Il client mostra `message`, nasconde il pulsante e svuota il form.

**Effetto:** riga in `users` non verificata. `cleanupExpiredUnverifiedAccounts()` (ogni 60 s) la cancella se il token scade senza verifica.

**Errori**

| Condizione                           | Risposta                                                        | Gestione client                           |
| ------------------------------------ | --------------------------------------------------------------- | ----------------------------------------- |
| Validazione fallita                  | 400 `{ errors: { missingData / username / email / password } }` | `addErrors` mostra il messaggio sul campo |
| `users_username_key` violato (23505) | 409 `errors.username`                                           | `addErrors`                               |
| `users_email_key` violato (23505)    | 409 `errors.email`                                              | `addErrors`                               |
| Altro errore DB                      | `ROLLBACK`, 500 `errors.general`                                | Messaggio generale                        |
| Invio email fallito                  | Solo log; la risposta resta 201                                 | –                                         |
| Body con campi non stringa           | `.trim()` lancia prima del `try`; Express 5 risponde 500        | –                                         |

---

## A3. Verifica email

**Cosa deve avvenire:** attivare l'account e autenticare l'utente.

**Percorso dei dati**

1. Click sul link `verify-email.html?token=…`. `verify-email.js` legge `token` dall'URL: se manca o ha meno di 20 caratteri mostra lo stato "token non valido" senza chiamare il server.
2. `POST /api/auth/verify-email` `{ token }` (con `credentials: "include"`).
3. `authRouter.js`: se `token` manca → 400.
4. `verifyEmailToken(token)` (`verificationUtils.js`): `SELECT` con token uguale, non scaduto e `email_verified = FALSE`; poi `UPDATE` (`email_verified = TRUE`, token e scadenza `NULL`).
5. `handleSession(user.id)` → `INSERT INTO sessions` (UUID, scadenza +7 giorni).
6. `Set-Cookie: sessionId`.
7. `sendEmail(..., "welcome", { username })` non bloccante.
8. Risposta `200 { authenticated: true, user, message }`.
9. Client: se `response.ok && data.authenticated` → stato "successo" e, dopo 3 s, `location.replace("/lobbies.html")`.

**Effetto:** account verificato e utente loggato.

**Errori**

| Condizione                            | Risposta server                                                       | Gestione client                                                                          |
| ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Token assente o < 20 caratteri        | nessuna chiamata                                                      | Stato "token non valido"                                                                 |
| Token mancante nel body               | 400 `{ error: "Missing token" }`                                      | Stato "errore" con il messaggio                                                          |
| Token non valido, scaduto o già usato | 400 `{ error: "Token non valido, scaduto o account già verificato" }` | Cerca "non valido", "scaduto" o "verificato" nel testo → stato "token non valido" |
| Errore DB in `verifyEmailToken`       | Catturato internamente, 400 `"Errore durante la verifica"`            | Stato "errore"                                                                           |
| Errore in `handleSession`             | 500 (l'account risulta già verificato: l'utente può fare login)       | Stato "errore"                                                                           |
| Rete o risposta non JSON              | –                                                                     | Stato "errore": "Errore di connessione"                                                  |

---

## A4. Login

**Percorso dei dati**

1. `login.js` (submit): `trim()` sull'email, `POST /api/auth/login` `{ email, password }`.
2. `authRouter.js`: email in minuscolo; campo mancante → 400.
3. `SELECT id, username, email, password_hash, email_verified FROM users WHERE email = $1`.
4. Utente assente → 401.
5. Non verificato → 403.
6. `bcrypt.compare` fallito → 401.
7. `handleSession(user.id)` → nuova riga in `sessions` → cookie `sessionId`.
8. Risposta `200 { authenticated: true, user }` → il client fa `location.replace("lobbies.html")`.

**Effetto:** nuova sessione. Le sessioni precedenti restano valide fino alla scadenza.

**Errori**

| Condizione                          | Risposta                            | Gestione client                              |
| ----------------------------------- | ----------------------------------- | -------------------------------------------- |
| Campi mancanti                      | 400                                 | Mostra `error` (nessuna evidenziazione)      |
| Email inesistente o password errata | 401 `"Email o password non valida"` | Mostra errore ed evidenzia il campo password |
| Account non verificato              | 403                                 | Mostra il messaggio senza evidenziazione     |
| Errore DB                           | 500                                 | Mostra il messaggio                          |
| Rete                                | –                                   | "Errore di connessione"                      |

---

## A5. Ripristino sessione e guard delle pagine

**Percorso dei dati**

1. Pagine `lobbies.js`, `profile.js`, `leaderboard.js` → `GET /api/session/me` (cookie inviato automaticamente).
2. `cookieParser` → `getUserFromSession(sessionId, db, true)`:
    - `SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()`;
    - query `ranked_users` con `RANK() OVER (ORDER BY elo DESC, partite DESC, created_at ASC)`;
    - se `email_verified = FALSE` → `null`.
3. Risposta `200 { authenticated: true, user: { id, username, email, elo, placement } }`.

**Errori**

| Condizione                                        | Risposta                                                                                     | Gestione client                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sessione assente, scaduta o utente non verificato | 401 senza body. Se il cookie c'era, la riga `sessions` viene cancellata e il cookie azzerato | `lobbies.js` → `/login.html`. `profile.js` → `/login.html` solo per il proprio profilo. `leaderboard.js` → utente anonimo |
| Errore DB                                         | 500 `{ error }`                                                                              | –                                                                                                                         |

---

## A6. Logout

**Percorso dei dati**

1. `profile.js` click "Esci" → `POST /api/session/logout`.
2. Cookie assente → 204.
3. Altrimenti `DELETE FROM sessions WHERE id = $1`, `clearCookie("sessionId")`, 204.
4. Client: se `response.ok` → `location.replace("login.html")`.

---

## A7. Recupero password

**A7a. Richiesta** (`forgot-password.html` + `forgot-password.js`; la stessa chiamata parte anche da `profile.js`, pulsante "Aggiorna la tua password", con l'email letta da `#emailInfo`)

1. Il client normalizza l'email (`trim`, minuscolo) e controlla il formato; errore → messaggio sotto il campo, nessuna chiamata. Altrimenti stato "caricamento".
2. `POST /api/auth/forgot-password` `{ email }`. Server: email mancante o con formato errato → 400.
3. `createPasswordResetToken(email, 5)`: `UPDATE users SET password_reset_token, password_reset_expires_at WHERE email = $3 RETURNING`.
4. Utente trovato → `sendEmail(..., "reset_password", { username, resetLink, expirationMinutes: 5 })` con link `CLIENT_URL/reset-password.html?token=…` (non bloccante).
5. Risposta sempre `200 { success: true, message: "Se l'email è registrata…" }`, anche se l'utente non esiste o il DB fallisce (evita l'enumerazione).
6. Client: `response.ok && data.success` → stato "successo"; altrimenti stato "errore" con `data.error`. Il pulsante "Riprova" ripristina il form con l'email già inserita.

**A7b. Verifica token** (`reset-password.html` + `reset-password.js`)

1. Il client legge `token` dall'URL: se manca o ha meno di 20 caratteri → stato "token non valido".
2. `POST /api/auth/verify-password-reset-token` `{ token }` → 400 se manca o non è valido → 200 `{ success, user }`.
3. Client: successo → mostra il form. Errore: se il messaggio contiene "non valido" o "scaduto" → stato "token non valido"; altrimenti stato "errore" con il messaggio. Rete → stato "errore".

**A7c. Reset**

1. Client: password < 8 caratteri → errore sul campo; password e conferma diverse (conferma vuota inclusa) → errore sul campo. Altrimenti il pulsante diventa "Aggiornamento in corso..." e viene disabilitato.
2. `POST /api/auth/reset-password` `{ token, password }`: manca uno dei due → 400; password < 8 → 400.
3. `verifyPasswordResetToken` → 400 se non valido o scaduto.
4. `bcrypt.hash` → `UPDATE users` (nuovo hash, token e scadenza `NULL`).
5. `DELETE FROM sessions WHERE user_id = $1` (logout ovunque).
6. 200 `{ success, message }`. Errore interno → 500.
7. Client: `response.ok && data.success` → stato "successo" (lo script non fa redirect automatici: le sessioni sono state revocate e serve un nuovo login); altrimenti stato "errore" con `data.error`.

**Effetto:** password cambiata e tutte le sessioni revocate.

---

## A8. Modifica username

**Percorso dei dati**

1. `profile.js` (Salva) → `PUT /api/user/update` `{ username }`.
2. `userRouter.js`: `getUserFromSession` → 401 se assente.
3. Controlli in ordine: vuoto → spazi → lunghezza 3-30 → `isProfane` → unicità (`SELECT 1 … WHERE username = $1 AND id != $2`).
4. `UPDATE users SET username`.
5. 200 `{ message, username }`. Il client aggiorna `#usernameInfo` e chiude il modale.

**Errori**

| Condizione                      | Risposta                           |
| ------------------------------- | ---------------------------------- |
| Sessione assente                | 401 `{ error: "Non autorizzato" }` |
| Validazione                     | 400 `{ error }`                    |
| Username già usato              | 409                                |
| Violazione `UNIQUE` concorrente | 500                                |

---

## A9. Eliminazione account – richiesta codice

**Percorso dei dati**

1. `profile.js`: modale con due checkbox → "Procedi" → `POST /api/auth/request-account-deletion`.
2. `getUserFromSession` → 401 se assente.
3. `createAccountDeletionCode(user.id, 5)`: codice da 8 caratteri `[A-Z0-9]` e scadenza salvati in `users`.
4. `sendEmail(..., "account_deletion_code", { code, expirationMinutes: 5 })`
5. 200 `{ success, message }` → il client mostra gli 8 campi del codice.

**Errori:** 401; 500 se la creazione del codice o l'invio email falliscono (`emailResult.success === false`); il client mostra `data.error`.

## A10. Eliminazione account – conferma

**Percorso dei dati**

1. `profile.js` unisce gli 8 caratteri → `POST /api/auth/confirm-account-deletion` `{ code }`.
2. `authRouter.js`: codice mancante → 400. Poi `db.connect()`, `getUserFromSession` → 401.
3. `verifyAccountDeletionCode(user.id, code)` → 400 se non valido o scaduto.
4. `BEGIN` → `DELETE sessions` → `DELETE elo_history` → `DELETE users` → `COMMIT`.
5. `clearCookie("sessionId")`, email `account_deleted` (non bloccante).
6. 200 → il client fa `location.replace("/login.html")`.

**Effetto:** account e storico del giocatore eliminati. Le righe di `games` e le righe `elo_history` degli altri giocatori restano; nel dettaglio partita compare "User not found". Errore → `ROLLBACK`, 500.

---

## A11. Visualizzazione profilo

**Percorso dei dati** (`profile.js`, `profile.html`)

1. `GET /api/session/me`.
2. Profilo proprio se manca `?id=` o coincide con l'utente loggato. Altrimenti `GET /api/user/:userId`.
3. `/api/user/:userId`: regex UUID → 400; ranking `RANK()` → 404 se assente → 200 `{ id, username, elo, placement }`.
4. `GET /api/user/:userId/games`: 400 / 404 / 200 con `[{ id, duration, created_at, placement, left_early, old_elo, elo_change, new_elo, opponents_count }]` da `elo_history JOIN games`.
5. Il client calcola da solo: partite totali (`length`) e percentuale di vittorie (`placement === 1`). La colonna "Turni" mostra `duration`.
6. Click su una riga → A13.

## A12. Classifica

1. `leaderboard.js` → `GET /api/session/me` (solo per evidenziare "Tu") e `GET /api/user/leaderboard/global`.
2. `userRouter.js`: `users LEFT JOIN elo_history`, `COUNT(eh.game_id)`, `RANK()`, ordinamento per elo, partite e anzianità.
3. 200 con l'array completo; il client filtra per nome in locale. Errore → `null` → mostra "nessun risultato", senza distinguere l'errore dal vuoto.

## A13. Dettaglio giocatori di una partita

1. `profile.js` click riga → `GET /api/user/game/:gameId/players`.
2. 400 se UUID errato; 404 se la partita non esiste; 200 `[{ id, username, placement, elo_change, new_elo }]` ordinato per `placement`.
3. `renderPlayers` crea `totalPlayers` righe (da `opponents_count + 1`) e inserisce ogni giocatore alla posizione `placement - 1`. Le righe rimaste vuote restano "User not found" (account eliminati)

---

# PARTE B – SOCKET.IO

## B1. Connessione e autenticazione

**Percorso dei dati**

1. Il client crea `io({ auth: { deviceId } })`. `deviceId` è in `localStorage.bisca_device_id` (UUID).
2. `io.use(authenticateSocket)` (`sockets/auth.js`): legge il cookie dall'handshake → `getUserFromSession` → `socket.user`; `socket.join("user:<id>")`; `socket.deviceId`.
3. Evento `connection` (`sockets/index.js`): `handleReconnect` (B15), poi `sendLobbies(socket)`.

## B2. Lista dei tavoli

1. `sendLobbies(socket)` → `getLobbies()` (da memoria) → aggiunge `isMember`, `isOwner`, `isConnected` → filtra `players > 0 && !closed` → emette `lobbies:update`.
2. `broadcastLobbies(io)` ripete l'invio **a ogni socket connesso** dopo ogni modifica (create, join, leave, update, delete, disconnect, reconnect).
3. `lobbies.js`: `renderLobbies` filtra in locale (nome, proprietario, pubblico/privato, accessibile). I tavoli propri sono sempre in cima.

## B3. Creazione tavolo

1. `lobbies.js`: `parseInt` su giocatori/vite/carte → `emit("lobby:create", name, maxPlayers, lives, cards, password)`.
2. `sockets/index.js`: `validators.validateLobbyParams`: nome 3-30 e `isProfane`, giocatori intero 2-6, vite intero ≥ 1, carte intero 1…⌊40/maxPlayers⌋. Errori → `lobby:create:error { errors: [{ field, message }] }`.
3. `handleCreateLobby`: `bcrypt.hash` della password (se non vuota) → oggetto lobby (`id: uuid`, `players: Map`, `ownerId`, `started: false`, `closed: false`) → `createLobby` (imposta `createdAt`, avvia il timer di pulizia se assente) → `socket.join("lobby:<id>")` → `broadcastLobbies` → `lobbies:update:sync` a `user:<id>`.
4. Eccezione → `lobby:create:error { message }`. Il client si aspetta `errors` e va in errore.

## B4. Ingresso in un tavolo

1. Click sul tavolo (con password: popup) → `emit("lobby:join", lobbyId, password)`.
2. `validateLobbyId` (UUID) → `joinLobby`.
3. Errori emessi su `lobby:join:error { message }`: tavolo inesistente, password mancante o errata (`bcrypt.compare`), tavolo al completo.
4. `addPlayer`: ulteriori controlli (tavolo non iniziato, non pieno, utente non già in un tavolo).
5. `socket.join`, `broadcastLobbies`, `lobbies:update:sync`.

## B5. Modifica impostazioni (vite, carte)

`emit("lobby:update", lives, cards)` → `requireLobbyOwner` e `requireLobbyNotStarted` → `validateLobbyUpdateParams` → `updateLobbySettings` → `broadcastLobbies`.

Errori: `lobby:update:error` (con `errors` o con `message`) e `error { message }` dai middleware.

## B6. Eliminazione tavolo

`emit("lobby:delete")` → `requireLobbyOwner` + `requireLobbyNotStarted` → `handleDeleteLobby`: azzera i timer di riconnessione dei giocatori, emette `lobby:deleted` agli altri, `socketsLeave`, `deleteLobby`, `deleteGame`, `broadcastLobbies`, `lobbies:update:sync`.

Errori: `lobby:delete:error { message }` (`alert`). Gli altri client mostrano `alert` ("Il tavolo in cui eri è stato eliminato").

## B7. Uscita dal tavolo

1. `emit("lobby:leave")` → `leaveLobby`: `clearReconnectTimer`, `removePlayer`, `socket.leave`.
2. Se esiste una partita: `removePlayerFromGame` (B15).
    - Risultato `finished` → `emitGameResult` (B13).
    - Altrimenti → `broadcastGameState`.
3. Tavolo vuoto → `lobby:deleted` a tutti, `socketsLeave`, `deleteLobby`, `deleteGame`.
4. `broadcastLobbies` + `lobbies:update:sync`.

## B8. Avvio partita

1. `emit("game:start")` → `startGame` (nessun middleware; i controlli sono interni).
2. Controlli (`game:start:error { message }`): utente in un tavolo; è il proprietario; nessuna partita esistente; almeno 2 giocatori.
3. `initGameState(lobby.id, lobby.players, startingLives, initialCards)`: giocatori con `bid: -1`, `lives`, `won: 0`, `placement: null`; `turnStarter` = primo giocatore; `lastPlayer` = precedente vivo; `showdown = (initialCards === 1)`; mani distribuite da un mazzo di 40 carte mescolato.
4. `createGame` (in memoria) e `setLobbyStarted(true)`.
5. DB, in transazione:
    - `INSERT INTO games (id = lobby.id, player_count, duration = 0)`;
    - per ogni giocatore `INSERT INTO elo_history (game_id, user_id, placement = ordine d'ingresso, left_early = FALSE, old_elo = elo attuale)`, con `new_elo` ed `elo_change` a `NULL`.
6. `COMMIT` → `io.to("lobby:<id>").emit("game:started")` → `lobbies.js` fa `location.href = "/game.html"`.

## B9. Recupero dello stato

1. `game.js` emette `game:get-state` alla connessione, al `game:reconnect`, a `lobbies:update:sync` e quando la pagina torna visibile.
2. `sockets/index.js`: nessun tavolo o nessuna partita → `game:not-found` → il client reindirizza a `/lobbies.html`.
3. `sendGameState`: `setPlayerConnected(true)` → `broadcastGameState` a **tutti** i socket nella room.
4. `getPlayerGameState` costruisce una vista per giocatore: `me`, `opponents` ruotati, mano (ordinata per valore), `playedCards`, `isMyTurn`, `lastPlayer` (booleano), `highestPlay`. In `showdown` la propria mano è vuota e si vedono le carte degli avversari.
5. Il client chiama `renderGameState`.

## B10. Puntata

1. Client: bottoni 0…N carte (con il valore vietato disabilitato per l'ultimo giocatore) oppure "Vincerò/Perderò" in showdown (1/0) → `emit("game:place-bid", bid)` → `resetBottomActions()` (i bottoni spariscono in attesa dello stato).
2. `sockets/index.js`: `requireActiveGame` + `requireIsYourTurn` → fase `bidding` (altrimenti `error "Wrong turn phase"`) → `validateBid` (intero 0…N).
3. `handlePlaceBid` → `placeBid`: giocatore vivo, fase, nessuna puntata già fatta, intervallo, regola dell'ultimo giocatore (`handSize - totalBids`, esclusa in showdown). Accettata → `bid` e `totalBids` aggiornati.
4. Non tutte le puntate fatte → `nextPlayer` → `broadcastGameState`.
5. Tutte fatte → fase `play`, turno a `turnStarter`.
    - Normale: `broadcastGameState`.
    - Showdown: `resolveShowdown` gioca automaticamente `hand[0]` di ogni giocatore vivo (B12) → `emitGameResult`.

**Errori:** middleware → `error { message }` (inglese, non gestito dal client), l'azione viene ignorata in quanto considerata non valida.

## B11. Giocata di una carta

1. Client: click su una carta → "Gioca carta" → `emit("game:play-card", card)`. Per `denari1` il client chiede "Alto/Basso" ed emette `asso-prende` (valore 10000) o `asso-lascia` (−10000).
2. `sockets/index.js`: `validateCard` (whitelist di 42 valori) → `requireIsYourTurn` (`error "Not your turn"` altrimenti).
3. `handlePlayCard`: fase `play` e non showdown (altrimenti ignora silenziosamente); è il turno del giocatore (`game:not-your-turn`); carta presente in mano (`game:invalid-card`; gli assi richiedono `denari1`).
4. `playCard`: rimuove la carta (`denari1` fisica per gli assi), registra `playedCards` e aggiorna `highestPlay`. In modalità normale `denari1` letterale è rifiutata; in showdown gli assi sono rifiutati.
5. Non tutti hanno giocato → `nextPlayer`. Tutti i vivi hanno giocato → `updateScore` (B12).
6. `emitGameResult` → `broadcastGameState` (anche per mosse rifiutate: il client si riallinea).

I valori delle carte sono corrispondenti al loro numero e incrementato in base al seme: denari +400, coppe +300, spade +200, bastoni +100. In questo modo l'ordinamento delle carte è affidato a dei semplici controlli sui valori numerici.

## B12. Risoluzione mano, fine turno e showdown

**Fine mano (`updateScore`)**

1. Vince la carta con valore più alto. Fase `resolving` → `onResolving()` → broadcast che mostra tutte le carte.
2. Attesa di 3 s (`TURN_DELAY_MS`). Se la fase è cambiata nel frattempo (giocatore uscito), esce senza altro.
3. Fase `play`, tavolo svuotato, `currentPlayer = vincitore`, `won++`, `playedHands++`.
4. Se `playedHands >= cardsThisTurn` (`initialCards - ((turn-1) % initialCards)`) → `endTurn`.

**Fine turno (`endTurn`)**

1. Ogni vivo perde `/bid − won/` vite (minimo 0). `game.turn++`.
2. Nessun sopravvissuto = **pareggio**: le vite non cambiano; `game:draw` e si rigioca.
3. Altrimenti i giocatori a 0 vite ricevono il placement
4. Un solo sopravvissuto → `status = "finished"`, `winnerId`, placement 1 → ritorna `{ finished: true, winnerId }`.
5. Altrimenti si azzerano `bid` e `won` dei vivi, si cambia `turnStarter`, si ricalcolano `lastPlayer`, `showdown` e le mani (N, N−1, …, 1, poi di nuovo N).

**Showdown:** quando ogni giocatore ha puntato su una sola carta, `resolveShowdown` la gioca automaticamente per tutti e subito dopo viene risolta la mano come sopra.

## B13. Fine partita, salvataggio e calcolo ELO

1. `emitGameResult(io, lobbyId, game, result)`:
    - se non è finita: `game:draw` (se pareggio) e `broadcastGameState`;
    - se è finita: `turnPhase = "finished"`, broadcast (il client mostra la classifica con `showScoreboard`), `setLobbyStarted(false)`, `setLobbyClosed(true)`.
2. Una sola volta (`game.saved`): `saveGameData({ id, duration: game.turn, players: [{ userId, placement, leftEarly }], winner })`.
3. `saveGameData`: transazione 1 (`UPDATE games SET duration`) → `COMMIT` → `calculateAndUpdateElo` (transazione 2).
4. `calculateAndUpdateElo`:
    - verifica placement unici;
    - `getPlayersEloData`: `elo` attuale e `matches_played = COUNT(elo_history)`;
    - per ogni giocatore: punteggio atteso = media di `1/(1+10^((ELOavv−ELO)/400))`; punteggio reale = `(N − placement)/(N − 1)`; `K = round(Kbase(partite, ELO) × fattoreTavolo(N))`; `Δ = round(K × (reale − atteso))`; nuovo ELO = max(100, ELO + Δ);
    - `UPDATE users SET elo`;
    - `UPDATE elo_history SET old_elo, elo_change, new_elo, placement, left_early`.
5. `COMMIT`.

| Parametro      | Valori                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| `Kbase`        | < 15 partite: 40; < 30: 30; < 50: 20; altrimenti 15 se ELO > 1700, 20 negli altri casi |
| Fattore tavolo | 2 giocatori: 0,75; 3: 0,9; 4: 1,0; 5: 1,15; 6: 1,3                                     |

## B14. Chat

1. `game.js`: `emit("game:chat-message", text)` (testo con `trim()`, Invio o pulsante).
2. `requireActiveGame` (solo partita in corso) → `handleChatMessage`: non in lobby → `error`; testo vuoto o non stringa → ignorato; `trim()` e `slice(0, 250)`.
3. Emissione `game:chat-message { senderId, senderUsername, text, timestamp, isMe }` agli altri nella room (`isMe: false`) e al mittente (`isMe: true`).
4. Il client inserisce il messaggio nell'apposito elemento.

## B15. Disconnessione, riconnessione e cambio pagina

**Cambio pagina:** `beforeunload` esegue `socket.disconnect()`. Ogni cambio pagina è quindi una disconnessione seguita da una riconnessione con lo stesso `deviceId`.

**Disconnessione (`handleDisconnect`)**

1. L'utente non è in un tavolo → fine.
2. Partita già finita: se non è online altrove (`isUserOnline`) → `removePlayer`; tavolo vuoto → `lobby:deleted`, `deleteLobby`, `deleteGame`. `broadcastLobbies`.
3. Altrimenti, se non online altrove → `setPlayerConnected(false)` (su lobby e partita) → `broadcastLobbies` → `broadcastGameState`.
4. Si avvia un timer di 60 s con chiave `userId_deviceId`.

**Allo scadere del timer** (se l'utente non è tornato e non è online altrove): `removePlayerFromGame` (`leftEarly = true`, `lives = 0`, placement assegnato). Se resta un solo giocatore → partita `finished` e `emitGameResult`; altrimenti `restartCurrentTurn` (nuove carte, stesso turno) e broadcast. Poi `removePlayer` ed eventuale eliminazione del tavolo vuoto.

**Riconnessione (`handleReconnect`)**

1. `clearReconnectTimer`; `socket.join("lobby:<id>")`; `setPlayerConnected(true)`.
2. Partita iniziata → `game:reconnect`. In `lobbies.js` compare `confirm("Hai una partita in corso!…")`: "Annulla" provoca `lobby:leave`. In `game.js` ritorna `game:get-state`.
3. `broadcastLobbies`.

## B16. Pulizia automatica dei tavoli

`setInterval` ogni 60 s (attivo solo se esistono tavoli):

- nessun giocatore connesso da ≥ 10 minuti → `deleteLobby`;
- un solo giocatore e `createdAt` ≥ 10 minuti → `deleteLobby`.

## B17. Heartbeat

`game.js` emette `ping` ogni 20 s; il server risponde `pong`. Oltre a questo, Socket.io usa `pingInterval: 25000` e `pingTimeout: 60000`.

---

# PARTE C – INFRASTRUTTURA

## C1. Avvio del server (`server.js`)

1. `dotenv` → Express → `express.json`, `cookieParser`, `cors` (origine `CLIENT_URL`, credenziali).
2. Router `/api/auth`, `/api/user`, `/api/session`; `/sw.js` (sostituisce `{{SERVER_VERSION}}` con l'ora di avvio); file statici da `../public` con `Cache-Control` specifico per `lobbies`, `profile`, `game`.
3. `setupSockets(io)`; 404 → `404.html`; gestore errori globale.
4. `startApp`: `profanityFilter.setThreshold(85)` → `transporter.verify()` → `SELECT NOW()` → `listen`. Ogni errore → `process.exit(1)`.

## C2. Service worker (`sw.js`)

- Versione cache = ora di avvio del server: ogni riavvio invalida la cache per gestire l'aggiornamento della versione PWA.
- `install`: scarica i 20 URL di `urlsToCache` (esistono tutti in `public/`; se uno mancasse l'installazione fallirebbe). `skipWaiting`.
- `activate`: cancella le cache vecchie, `clients.claim`.
- `fetch`: ignora ogni URL che contiene `/api/`, `socket.io`, `forgot-password`, `reset-password` o `verify-email`. Questo esclude anche pagine, script e CSS di quelle tre pagine, sempre servite dalla rete. Per il resto strategia **cache-first** con salvataggio dinamico delle risposte `basic`.
- Non vengono messe in cache le risorse di altri domini (FontAwesome, Google Fonts).

## C3. Email (`mailService.js` + `src/email/templates/*.html`)

`sendEmail(to, subject, template, variables)`:

1. legge `templates/<nome>.html` e sostituisce `{{chiave}}`;
2. `transporter.sendMail` (SMTP da variabili d'ambiente);

| Template                | Variabili richieste                                 |
| ----------------------- | --------------------------------------------------- |
| `verify_email`          | `username`, `verificationLink`, `expirationMinutes` |
| `welcome`               | `username`, `appUrl`                                |
| `reset_password`        | `username`, `resetLink`, `expirationMinutes`        |
| `account_deletion_code` | `username`, `code`, `expirationMinutes`             |
| `account_deleted`       | `username`                                          |

## C4. Dati su DB: chi scrive e chi legge

| Tabella       | Scritta da                                                                                                       | Letta da                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `users`       | `register`, `verify-email`, reset password, `update`, eliminazione account, `calculateAndUpdateElo` (`elo`)      | login, ranking (sessione, profilo, classifica), `eloManager`       |
| `sessions`    | `handleSession` (login, verify-email), logout, reset password, eliminazione account, `/session/me` (se invalida) | `getUserFromSession`                                               |
| `games`       | `startGame` (INSERT), `saveGameData` (`duration`)                                                                | `/user/:id/games`, `/user/game/:id/players`                        |
| `elo_history` | `startGame` (INSERT provvisorio), `calculateAndUpdateElo` (UPDATE), eliminazione account                         | ranking, `eloManager`, `/user/:id/games`, `/user/game/:id/players` |

