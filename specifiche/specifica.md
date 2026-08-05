# Specifiche Progetto: Gioco di Carte Multiplayer Online

## 1. Obiettivo dell'Applicazione

### Cosa serve
Una piattaforma web per giocare a un gioco di carte in tempo reale.

### Che problema risolve
- Permette di giocare online senza necessità di una stanza fisica
- Automatizza la gestione della partita
- Consente a giocatori distanti di competere insieme

### A chi è rivolta
- Appassionati di giochi di carte

---

## 2. Cosa Può Fare l'Utente

### Azioni Principali

**Autenticazione:**
- Registrare un account
- Accedere al sistema
- Gestire il profilo personale

**Gestione Tavoli:**
- Creare un nuovo tavolo con parametri configurabili
- Visualizzare tavoli disponibili
- Cercare/filtrare tavoli
- Entrare in un tavolo
- Abbandonare un tavolo

**Gameplay:**
- Partecipare a partite in tempo reale
- Dichiarare prese
- Giocare carte
- Visualizzare stato di gioco e avversari
- Ricevere feedback su risultati

**Social:**
- Visualizzare profilo personale e di altri giocatori
- Consultare statistiche e cronologia partite

---

## 3. Struttura del Frontend

### Pagine Principali

**Home**
- Presentazione dell'app
- Informazioni sulle regole del gioco
- Accesso a autenticazione

**Autenticazione**
- Accesso
- Registrazione
- Verifica email
- Recupero password

**Tavoli**
- Ricerca e filtro tavoli
- Creazione nuovo tavolo
- Lista tavoli disponibili
- Gestione del tavolo per il creatore

**Partita**
- Visualizzazione del tavolo e dei giocatori
- Mano di carte
- Azioni di gioco
- Chat

**Profilo**
- Dati personali
- Statistiche
- Cronologia partite

---

## 4. Layout e Interfaccia

### Home
- Intestazione con titolo e navigazione
- Sezione principale con descrizione e regole
- Pulsante per autenticarsi/giocare

### Tavoli
- Area ricerca/filtri
- Area creazione tavolo
- Lista tavoli disponibili (griglia o tabella)

### Partita
- Area tavolo centrale (visualizzazione giocatori e carte)
- Area mia mano in basso
- Pannello laterale con chat
- Barra superiore con controlli

---

## 5. Scenari di Test

### Scenario 1: Registrazione e Accesso
- Creare un account
- Verificare email
- Accedere con credenziali corrette
- Verificare che accesso non funziona con dati sbagliati

### Scenario 2: Creazione Tavolo
- Creare un tavolo con parametri personali
- Tavolo appare in lista
- Modificare i parametri
- Cancellare il tavolo

### Scenario 3: Partecipazione a Tavolo
- Entrare in un tavolo disponibile
- Partecipare alla partita
- Vedere gli altri giocatori
- Abbandonare il tavolo

### Scenario 4: Gameplay
- Giocare una mano completa (dichiarazioni + gioco)
- Visualizzare risultati turno
- Continuare a turni successivi

### Scenario 5: Fine Partita
- Giocare fino al vincitore
- Visualizzare risultati finali
- Consultare profilo aggiornato

### Scenario 6: Profilo
- Visualizzare statistiche personali
- Consultare cronologia partite
- Modificare dati profilo

---

## 6. Note di Sviluppo

- Frontend: HTML, CSS, JavaScript (fetch, async/await)
- Backend: Node.js + Express
- Comunicazione tempo reale: Socket.io
- Database: Supabase
- Autenticazione: Email e sessioni
- Design: Responsive per mobile e desktop

## 7. Possibili Estensioni Future

- Sistema di ranking
- Chat in gioco
- Profili utente con statistiche
- App installabile su mobile
- Deploy online o self hosting
