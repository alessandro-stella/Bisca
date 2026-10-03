# BISCA - Gioco di Carte Multiplayer Online

## Descrizione dell'Applicazione

**BISCA** è una piattaforma web per sfidare all'omonimo gioco di carte altri utenti. L'applicazione consente a più utenti di creare o unirsi a tavoli di gioco, partecipare a partite multiplayer con meccaniche di scommesse e vite, e competere in una classifica globale basata sul rating ELO.

## Installazione

### Prerequisiti
- Node.js (versione 16 o superiore)
- npm
- Un database PostgreSQL
- Credenziali SMTP per il servizio email

### Passi di installazione

1. **Clona la repository**
   ```bash
   git clone <url-repository> <directory>
   cd <directory>
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Popola le variabili d'ambiente**
   
   Crea un file `.env` nella root del progetto prendendo, come riferimento il file `.env.example`.

4. **Inserisci le parole vietate**
   
   Crea un file `profane-list.json` nella root del progetto, prendendo come riferimento il file `profane-list.json.example`.
   
5. **Inizializza il database**
   ```bash
   npm run initDb
   ```

## Avvio dell'Applicazione

### Avvio del Backend
```bash
npm start
```

### Accesso Frontend
Il frontend è servito come file statici dal backend. Per accedervi basta aprire un browser all'URL inserito dentro `.env`.

## Funzionalità Implementate

### Autenticazione e Gestione Utenti
- Registrazione utente con validazione email
- Login/Logout con gestione sessioni
- Verifica email (doppio fattore)
- Reset password con link via email
- Profilo utente con statistiche personali
- Eliminazione account

### Sistema di Gioco
- Creazione e gestione tavoli di gioco
- Partite multiplayer in tempo reale (2-6 giocatori)
- Meccanica di scommesse con turni di asta
- Sistema di vite per i giocatori
- Calcolo punti e determinazione vincitore della partita

### Ranking e Competizione
- Sistema di rating ELO dinamico
- Classifica globale dei giocatori
- Calcolo automatico ELO dopo ogni partita
- Statistiche personali (partite giocate, vittorie, sconfitte)

### Sicurezza e Moderazione
- Filtro anti-profanità nei nomi dei profili e dei tavoli
- Validazione lato server di tutti gli input
- CORS configurato per origine specifica
- Cookie parser per gestione sessioni sicure
- Gestione errori globale

### Interfaccia Utente
- Design responsive (mobile-friendly)
- Layout con Flexbox e Grid CSS
- Gestione visibile degli stati (caricamento, errore, successo)
- Animazioni e feedback visuale
- Progressive Web App (Service Worker per offline)

## Funzionalità Extra Implementate

- **WebSocket in tempo reale**: Comunicazione istantanea via Socket.io tra giocatori
- **Servizio email**: Invio automatico di email per verifiche e recupero password
- **Indicizzazione su Google**: `sitemap.xml` e `robots.txt` per crawling + configurazione su Google Search Console
- **Progressive Web App**: Installabile come app mobile con service worker
- **Rating ELO**: Sistema competitivo con calcolo dinamico del rating
- **Filtro anti-profanità**: Moderazione automatica dei contenuti
- **Persistenza dati**: Database PostgreSQL per tutti i dati
- **Gestione sessioni**: Token JWT e cookie per autenticazione persistente

## Self-hosting

Attualmente sia il sito che i servizi da esso utilizzati sono hostati su un home lab, rendendo completamente indipendente il progetto:
- **Hosting**: tramite un tunnel Cloudflare i file sono associati al dominio pubblico `bisca.alessandrostella.org`, attualmente indicizzato anche nelle ricerche di Google
- **Database**: un'installazione locale di `PostgreSQL` permette a host e utenti specifici l'accesso al database
Era stato configurato anche un servizio SMTP autonomo, usando `postfix` in un container, slegando il progetto da piani gratuiti limitanti. Purtroppo il cambio di IP domestico rende instabile il sistema, necessitando il passaggio ad altri servizi. Ciò potrebbe essere risolto tramite l'uso di una VPS, opzione scartata per motivi economici.
Nonostante l'attuale uso di servizi personali, il progetto è stato strutturato in modo tale da poter usare qualsiasi combinazione di hosting, database basato su SQL e Relay SMTP senza che ciò alteri il suo funzionamento.

## REST API Endpoints

### Autenticazione (/api/auth/...)

| Endpoint | Metodo | Body | Cookies | Validazione | Response | Status | 
 | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| /auth/checkUser | POST | username, email | \- | formato email, campi richiesti | Nessun body su 200, json con `errors` su 409 | 200 / 400 / 409 / 500 | 
| /auth/register | POST | username, email, password | \- | username: 3-30, no spazi, no profanita; email: regex; password: 8+ | `{ message, user: { id, username, email } }` + invio email verifica | 201 / 400 / 409 / 500 | 
| /auth/verify-email | POST | token | imposta sessionId (7d) | token presente e valido (5m) | `{ authenticated: true, user, message }` + invio welcome email | 200 / 400 / 500 | 
| /auth/login | POST | email, password | imposta sessionId (7d) | email verificata, password match (bcrypt) | `{ authenticated: true, user: { id, username, email } }` | 200 / 400 / 401 / 403 / 500 | 
| /auth/forgot-password | POST | email | \- | formato email | `{ success: true, message }` + invio link reset (se valida) | 200 / 400 / 500 | 
| /auth/verify-password-reset-token | POST | token | \- | token presente e valido | `{ success: true, user: { id, username, email } }` | 200 / 400 | 
| /auth/reset-password | POST | token, password | \- | password 8+, token valido | `{ success: true, message }` (invalida tutte le sessioni) | 200 / 400 / 500 | 
| /auth/request-account-deletion | POST | \- | richiede sessionId | sessione valida e utente esistente | `{ success: true, message }` + codice via email (scadenza 15m) | 200 / 401 / 500 | 
| /auth/confirm-account-deletion | POST | code | richiede e cancella sessionId | codice valido | `{ success: true, message }` (elimina user + dati a cascata) | 200 / 400 / 401 / 500 | 

### Sessione (/api/session/...)

| Endpoint | Metodo | Body / Parametri | Cookies | Validazione | Risposta | Status | 
 | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| /session/me | GET | \- | richiede sessionId | token sessione valido e non scaduto | `{ authenticated: true, user: { id, username, email, elo, placement } }` | 200 / 401 / 500 | 
| /session/logout | POST | \- | elimina sessionId | \- | Nessun contenuto (204 No Content) | 204 / 500 | 

### Profilo Utente & Classifica (/api/user/...)

| Endpoint | Metodo | Parametri / Body | Cookies | Validazione | Risposta | Status | 
 | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| /user/update | PUT | Body: username | richiede sessionId | 3-30 char, no spazi, no profanita, unico | `{ message, username }` | 200 / 400 / 401 / 409 / 500 | 
| /user/:userId | GET | Param: userId (UUID) | \- | formato UUID, utente esistente | `{ id, username, elo, placement }` | 200 / 400 / 404 / 500 | 
| /user/:userId/games | GET | Param: userId (UUID) | \- | formato UUID, utente esistente | `[{ id, duration, created_at, placement, left_early, old_elo, elo_change, new_elo, opponents_count }]` | 200 / 400 / 404 / 500 | 
| /user/game/:gameId/players | GET | Param: gameId (UUID) | \- | formato UUID, gioco esistente | `[{ id, username, placement, elo_change, new_elo }]` | 200 / 400 / 404 / 500 | 
| /user/leaderboard/global | GET | \- | \- | \- | `[{ id, username, elo, total_games, created_at, placement }]` (ordinati per ELO DESC) | 200 / 500 | 

**WebSocket (Socket.io)** per comunicazione real-time:
- `lobby:create` - Crea nuovo tavolo
- `lobby:join` - Unirsi a un tavolo
- `lobby:leave` - Abbandonare il tavolo
- `game:bid` - Effettua un bid (puntata) durante l'asta
- `game:play` - Gioca una carta durante la partita
- `game:start` - Inizia la partita quando tutti pronti

### Frontend - Vanilla JavaScript
- **Fetch API con async/await** per comunicazione REST
- **Socket.io client** per comunicazione in tempo reale
- **DOM manipulation** per aggiornamento interfaccia
- **Validazione client** dei dati inseriti
- **Service Worker** per funzionamento offline

### Database - PostgreSQL
- Schema relazionale con tabelle: users, sessions, games, stats
- Indici su campi frequentemente consultati
- Relazioni integrità referenziale

## Uso dell'IA
L'intelligenza artificiale è stata usata per scrivere situazioni d'esempio durante i test di sviluppo, per creare i template delle mail da inviare agli utenti (`src/email/templates/*.html`) e per generare liste di parole vietate. Inoltre è stata usata per refactoring generico, ottimizzazione per SEO e traduzione del codice, ad esempio il cambio del testo di messaggi d'errore o la traduzione di testo inizialmente scritto in inglese.
