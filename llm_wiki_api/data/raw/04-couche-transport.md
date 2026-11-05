# Couche 4 – Transport

## Rôle

La couche réseau achemine les paquets d'une **machine** à une autre. La couche transport fournit une communication **de bout en bout entre processus** (applications) tournant sur ces machines.

Fonctions principales :

1. **Multiplexage / démultiplexage** via les **numéros de port** : plusieurs applications partagent la même connexion réseau.
2. **Segmentation et réassemblage** des données de l'application.
3. Selon le protocole : **fiabilité**, **ordre**, **contrôle de flux** et **contrôle de congestion**.

Unité de données : le **segment** (TCP) ou le **datagramme** (UDP).

C'est la première couche **de bout en bout** : les routeurs intermédiaires ne la regardent normalement pas (sauf pare-feu et NAT).

## Les ports

- Numéro sur **16 bits** (0 à 65 535).
- Une communication est identifiée par un quintuplet : **(IP source, port source, IP destination, port destination, protocole)**. La paire IP + port est appelée un **socket**.
- Plages :
  - **0–1023** : ports bien connus (well-known), réservés aux services standards ;
  - **1024–49151** : ports enregistrés ;
  - **49152–65535** : ports dynamiques/éphémères, choisis par le client.

| Port | Service |
|------|---------|
| 20/21 | FTP |
| 22 | SSH |
| 25 | SMTP |
| 53 | DNS (UDP et TCP) |
| 67/68 | DHCP |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |

Exemple : un navigateur ouvre deux onglets sur le même site. Les deux connexions ont la même IP et le même port de destination (443), mais des ports source différents (ex. 51234 et 51235). C'est ainsi que les réponses reviennent au bon onglet.

## UDP (User Datagram Protocol)

Protocole **minimaliste** :
- **sans connexion** : pas d'établissement préalable ;
- **non fiable** : pas d'accusé de réception, pas de retransmission, pas de garantie d'ordre ;
- pas de contrôle de flux ni de congestion ;
- en-tête de seulement **8 octets** : port source, port destination, longueur, checksum.

Utilisations : quand la rapidité compte plus que la fiabilité, ou quand l'application gère elle-même la fiabilité.
- DNS (requêtes courtes) ;
- streaming audio/vidéo en direct, visioconférence, jeux en ligne (une donnée en retard est inutile) ;
- DHCP, SNMP, NTP ;
- base de QUIC.

## TCP (Transmission Control Protocol)

Protocole **orienté connexion** et **fiable**. Il présente à l'application un **flux d'octets** ordonné et sans perte.

### En-tête TCP (20 octets minimum)
| Champ | Rôle |
|-------|------|
| Port source / destination | Identification des processus |
| **Numéro de séquence** | Position du premier octet du segment dans le flux |
| **Numéro d'acquittement** | Prochain octet attendu par le récepteur |
| Longueur d'en-tête | |
| **Flags** | SYN, ACK, FIN, RST, PSH, URG (et ECE, CWR) |
| **Fenêtre** (window) | Nombre d'octets que le récepteur peut encore accepter |
| Checksum | Contrôle d'erreur |
| Pointeur urgent, Options | Options : MSS, window scaling, SACK, timestamps |

### Établissement de connexion : three-way handshake
```
Client                         Serveur
  | --- SYN, seq=x -----------------> |
  | <-- SYN+ACK, seq=y, ack=x+1 ----- |
  | --- ACK, seq=x+1, ack=y+1 ------> |
         connexion établie
```
Chaque côté choisit un numéro de séquence initial aléatoire (pour la sécurité et pour éviter les confusions avec d'anciennes connexions).

### Fermeture de connexion
Fermeture en 4 étapes (chaque sens est fermé indépendamment) : FIN → ACK, puis FIN → ACK. Le côté qui ferme en premier passe par l'état **TIME_WAIT** (2 × MSL) pour s'assurer que le dernier ACK est bien arrivé. Un **RST** permet une fermeture brutale.

### Fiabilité
- Chaque octet est numéroté ; le récepteur renvoie des **ACK cumulatifs** (« j'ai tout reçu jusqu'à l'octet N−1, j'attends N »).
- Si l'ACK n'arrive pas avant l'expiration d'un **timer de retransmission** (RTO, calculé à partir du RTT mesuré), le segment est renvoyé.
- **Fast retransmit** : 3 ACK dupliqués indiquent une perte → retransmission immédiate sans attendre le timer.
- **SACK** (Selective ACK) : le récepteur indique précisément les blocs reçus.
- Les segments arrivés dans le désordre sont remis en ordre avant d'être livrés à l'application.

### Contrôle de flux
Objectif : ne pas **saturer le récepteur**. Le récepteur annonce dans le champ **fenêtre** la place libre dans son buffer. L'émetteur ne peut pas avoir plus de données non acquittées que cette fenêtre. Si la fenêtre tombe à 0, l'émetteur s'arrête.

### Contrôle de congestion
Objectif : ne pas **saturer le réseau**. L'émetteur maintient une **fenêtre de congestion (cwnd)** ; il envoie au plus min(cwnd, fenêtre du récepteur).
- **Slow start** : cwnd commence petit (ex. 10 MSS) et **double à chaque RTT** (croissance exponentielle) jusqu'au seuil *ssthresh*.
- **Congestion avoidance** : au-delà du seuil, cwnd augmente de 1 MSS par RTT (croissance linéaire).
- **En cas de perte** : on considère que le réseau est congestionné. Avec 3 ACK dupliqués, cwnd est divisé par 2 (**fast recovery**) ; avec un timeout, cwnd retombe à sa valeur minimale.
- Ce comportement « augmentation additive, diminution multiplicative » s'appelle **AIMD**.
- Algorithmes modernes : **CUBIC** (par défaut sous Linux), **BBR** (Google, basé sur l'estimation du débit et du RTT plutôt que sur les pertes).

### Exemple concret
Tu télécharges un fichier de 10 Mo. TCP le découpe en segments de ~1460 octets (MSS = MTU 1500 − 20 IP − 20 TCP). Si le segment n° 50 est perdu, le client continue d'acquitter « j'attends le 50 » à chaque segment suivant reçu. Après 3 ACK dupliqués, le serveur renvoie le segment 50 et réduit son débit.

## TCP vs UDP

| Critère | TCP | UDP |
|---------|-----|-----|
| Connexion | Oui (handshake) | Non |
| Fiabilité | Oui | Non |
| Ordre | Garanti | Non garanti |
| Contrôle de flux/congestion | Oui | Non |
| Taille d'en-tête | 20–60 octets | 8 octets |
| Latence | Plus élevée | Faible |
| Modèle | Flux d'octets | Messages indépendants |
| Exemples | HTTP/1.1, HTTP/2, SSH, SMTP, bases de données | DNS, VoIP, jeux, streaming live, QUIC |

## QUIC

Protocole moderne (Google, normalisé par l'IETF en 2021 – RFC 9000), base de **HTTP/3**.
- Construit **au-dessus d'UDP**, mais réimplémente fiabilité et contrôle de congestion dans l'espace utilisateur.
- Chiffrement **TLS 1.3 intégré** : établissement de connexion en 1 RTT (voire 0 RTT pour une reconnexion), contre 2–3 RTT pour TCP + TLS.
- **Plusieurs flux indépendants** dans une connexion : une perte sur un flux ne bloque pas les autres (résout le **head-of-line blocking** de TCP).
- **Migration de connexion** : la connexion survit à un changement d'IP (passage du Wi-Fi à la 4G).

## Autres protocoles de transport
- **SCTP** : multi-flux et multi-domiciliation, utilisé en télécommunications.
