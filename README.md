# OBP Project – StackOverflow Database Optimization

Ovaj projekat je razvijen kao dio kursa **Optimizacija Baza Podataka**.  
Glavni cilj je kreiranje okruženja u kojem se radi sa velikom bazom podataka (**StackOverflow2013**) i omogućiti testiranje različitih upita i optimizacija.

---

## 📂 Struktura projekta

- **client/** – frontend aplikacija (Vite + React, zavisi od implementacije).  
- **server/** – backend servis (Node.js + Express, povezan na SQL Server).  
- **db/** – direktorij sa Docker podešavanjima za bazu.  
- **init-db/** – sadrži skripte za inicijalizaciju baze (restore sa `.bak` fajla).  
- **docker-compose.yml** – definicija servisa (baza, backend, frontend).  

---

## 🛠️ Pokretanje projekta

### 1. Kloniranje repozitorija
```bash
git clone https://github.com/belilovi02/obp-project.git
cd obp-project
```

### 2. Postavljanje `.bak` fajla
Pošto je fajl veoma velik, nije postavljen na GitHub.  
Skinuti ga možete ovdje:  
👉 [StackOverflow2013.bak – Download Link]neodstupan trenutno

Fajl je potrebno staviti u folder:
```
backup/StackOverflow2013.bak
```

---

### 3. Pokretanje sa Docker Compose
```bash
docker-compose up --build
```

Ovim se pokreću tri servisa:
- **db** – SQL Server 2022 + restore skripta (`restore.sh`)  
- **server** – backend (Node.js, API)  
- **client** – frontend (Vite)  

---

## 🔗 Konekcija na bazu
- **Server**: `localhost,1433`  
- **User**: `SA`  
- **Password**: `Passw0rd!`  
- **Database**: `StackOverflow2013`

---

## 📝 Napomena
- Ako `.bak` fajl nije dostupan, baza se neće automatski obnoviti – ali kontejneri će se pokrenuti.  
ž
