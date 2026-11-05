# Couche 7 – Application

## Rôle

La couche application est la plus proche de l'utilisateur. Elle fournit les **protocoles utilisés directement par les applications** pour échanger des informations : afficher une page web, envoyer un e-mail, résoudre un nom de domaine, transférer un fichier.

Attention : la couche application ne désigne pas le logiciel lui-même (le navigateur Chrome), mais le **protocole** qu'il utilise (HTTP).

## Modèles d'architecture

- **Client-serveur** : un serveur toujours disponible, avec une adresse connue, répond aux requêtes des clients (web, e-mail).
- **Pair-à-pair (P2P)** : chaque participant est à la fois client et serveur (BitTorrent, certaines blockchains).
- **Publish/subscribe** : des producteurs publient des messages sur des sujets, des abonnés les reçoivent via un intermédiaire (MQTT pour l'IoT).

## HTTP (HyperText Transfer Protocol)

Protocole du web, fonctionnant par **requêtes et réponses**, et **sans état**.

### Requête
```
GET /index.html HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0
Accept: text/html
```

### Réponse
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1256

<html>...</html>
```

### Méthodes principales
| Méthode | Usage | Idempotente |
|---------|-------|-------------|
| GET | Lire une ressource | Oui |
| POST | Créer / envoyer des données | Non |
| PUT | Remplacer une ressource | Oui |
| PATCH | Modifier partiellement | Non (en général) |
| DELETE | Supprimer | Oui |
| HEAD, OPTIONS | En-têtes seuls, capacités (CORS) | Oui |

### Codes de statut
- **1xx** information (101 Switching Protocols pour WebSocket)
- **2xx** succès : 200 OK, 201 Created, 204 No Content
- **3xx** redirection : 301 Moved Permanently, 302 Found, 304 Not Modified
- **4xx** erreur client : 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests
- **5xx** erreur serveur : 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable

### Versions
- **HTTP/1.1** (1997) : texte, connexions persistantes (keep-alive), mais une requête à la fois par connexion.
- **HTTP/2** (2015) : binaire, **multiplexage** de plusieurs requêtes sur une seule connexion TCP, compression des en-têtes (HPACK).
- **HTTP/3** (2022) : sur **QUIC** (UDP), supprime le blocage en tête de ligne lié à TCP.

### REST et API
Une API **REST** expose des ressources via des URL et utilise les méthodes HTTP de manière cohérente : `GET /users/42`, `POST /users`, `DELETE /users/42`. Les données sont généralement en JSON.

### WebSocket
Après une requête HTTP de mise à niveau (`Upgrade: websocket`), la connexion devient un canal **bidirectionnel permanent** : utile pour les chats, notifications en temps réel, réponses en streaming.

## DNS (Domain Name System)

Traduit les **noms de domaine** en **adresses IP** (www.uliege.be → 139.165.x.x). C'est un annuaire **distribué et hiérarchique**.

### Hiérarchie
- **Serveurs racine** (13 identités logiques, a.root-servers.net à m.root-servers.net, répliquées dans le monde entier).
- **Serveurs TLD** (Top-Level Domain) : `.be`, `.com`, `.org`.
- **Serveurs faisant autorité** pour un domaine (ex. ceux d'uliege.be).
- **Résolveur récursif** : le serveur (du FAI, ou 1.1.1.1, 8.8.8.8) qui fait le travail pour le client et met les réponses en **cache**.

### Résolution de www.uliege.be (cache vide)
1. Le PC demande au résolveur récursif.
2. Le résolveur demande à un serveur racine → « voyez les serveurs de .be ».
3. Il demande au serveur de .be → « voyez les serveurs d'uliege.be ».
4. Il demande au serveur faisant autorité d'uliege.be → il obtient l'adresse IP.
5. Il renvoie la réponse au PC et la garde en cache pendant la durée du **TTL** de l'enregistrement.

### Types d'enregistrements
| Type | Contenu |
|------|---------|
| A | Adresse IPv4 |
| AAAA | Adresse IPv6 |
| CNAME | Alias vers un autre nom |
| MX | Serveur de messagerie du domaine |
| NS | Serveurs faisant autorité |
| TXT | Texte libre (SPF, vérification de domaine) |
| PTR | Résolution inverse (IP → nom) |

DNS utilise principalement **UDP port 53** (TCP pour les grosses réponses et les transferts de zone). Versions sécurisées : DNSSEC (authenticité), DoH et DoT (chiffrement).

## Messagerie électronique

- **SMTP** (port 25, 587 pour la soumission) : **envoi** de mails et transfert entre serveurs.
- **IMAP** (port 143, 993 en TLS) : consultation des mails restant **sur le serveur**, synchronisés entre appareils.
- **POP3** (port 110, 995) : téléchargement des mails sur un appareil, généralement supprimés du serveur.
- Parcours : client de l'expéditeur → (SMTP) → serveur de l'expéditeur → (SMTP, après requête DNS MX) → serveur du destinataire → (IMAP) → client du destinataire.
- Sécurité anti-usurpation : SPF, DKIM, DMARC.

## Autres protocoles applicatifs

- **FTP** (ports 20/21) : transfert de fichiers, non chiffré ; remplacé par **SFTP** (sur SSH) ou FTPS.
- **SSH** (port 22) : accès distant sécurisé à une machine, tunnels.
- **DHCP** (UDP 67/68) : configuration automatique des machines.
- **NTP** (UDP 123) : synchronisation de l'heure.
- **SNMP** (UDP 161) : supervision des équipements réseau.
- **LDAP** : annuaires (comptes utilisateurs d'une organisation).
- **MQTT** : messagerie légère pour l'Internet des objets.
- **gRPC** : appels de procédures distantes sur HTTP/2 avec Protocol Buffers.

## Interface avec la couche transport : les sockets

Une application accède au réseau via l'**API sockets** fournie par le système d'exploitation :
- côté serveur : `socket()` → `bind()` (choisir un port) → `listen()` → `accept()` ;
- côté client : `socket()` → `connect()` vers IP:port ;
- puis `send()`/`recv()` et `close()`.

Chaque protocole applicatif choisit son transport : HTTP/1.1 et HTTP/2 sur TCP, DNS surtout sur UDP, HTTP/3 sur QUIC.

## Résumé

| Besoin | Protocole | Transport / Port |
|--------|-----------|------------------|
| Naviguer sur le web | HTTP / HTTPS | TCP 80 / 443 (QUIC pour HTTP/3) |
| Trouver une adresse IP | DNS | UDP 53 |
| Envoyer un mail | SMTP | TCP 25 / 587 |
| Lire ses mails | IMAP | TCP 993 |
| Se connecter à un serveur | SSH | TCP 22 |
| Obtenir une adresse IP | DHCP | UDP 67/68 |
