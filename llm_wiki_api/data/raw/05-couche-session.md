# Couche 5 – Session

## Rôle

La couche session gère le **dialogue** entre deux applications : elle ouvre, maintient, synchronise et ferme des **sessions** de communication. Là où la couche transport fournit un canal de bout en bout, la couche session organise **l'échange structuré** qui se déroule sur ce canal, éventuellement sur plusieurs connexions de transport successives.

Fonctions décrites par le modèle OSI :

1. **Établissement, maintien et libération** d'une session.
2. **Gestion du dialogue** : qui a le droit de parler (communication full-duplex ou half-duplex alternée, gestion d'un « jeton »).
3. **Synchronisation et points de reprise (checkpoints)** : en cas de panne, reprendre l'échange au dernier point validé au lieu de tout recommencer.
4. **Regroupement d'opérations** en unités logiques (activités).

## Place réelle dans les réseaux modernes

Dans le modèle **TCP/IP**, il n'existe **pas de couche session distincte** : ses fonctions sont réparties entre la couche transport (TCP ouvre et ferme des connexions) et les applications elles-mêmes. Il est donc normal de trouver peu de protocoles « purement » couche 5. Classer un protocole en couche 5 est souvent une question d'interprétation.

## Exemples de mécanismes de session

### Reprise de transfert
Un téléchargement de 4 Go est interrompu à 3,2 Go. Avec un mécanisme de point de reprise, le client redemande seulement la suite. En HTTP, cela se fait avec l'en-tête `Range: bytes=3200000000-` ; en FTP, avec la commande `REST`. C'est exactement l'idée de **checkpoint** décrite par OSI, même si elle est implémentée dans la couche application.

### Sessions TLS
TLS conserve un état de session (clés négociées). La **reprise de session** (session tickets, PSK en TLS 1.3) permet de rétablir une connexion chiffrée sans refaire toute la négociation : c'est une fonction de type session.

### Sessions applicatives web
HTTP est **sans état** : chaque requête est indépendante. Pour qu'un site « se souvienne » qu'un utilisateur est connecté, on crée une session :
- le serveur génère un **identifiant de session** et l'envoie dans un **cookie** ;
- le navigateur renvoie ce cookie à chaque requête ;
- alternative : un **jeton** (ex. JWT) envoyé dans l'en-tête `Authorization`.

Cela correspond à l'idée de session au sens OSI (maintenir un contexte de dialogue), bien que techniquement géré au niveau applicatif.

### Gestion du dialogue (half-duplex)
Dans un protocole où les deux parties ne doivent pas émettre en même temps, la couche session peut gérer un **jeton** : seul le détenteur du jeton peut envoyer. Exemple d'image : un talkie-walkie où l'on dit « à toi ».

## Protocoles souvent associés à la couche 5

- **NetBIOS** : sessions entre machines dans les anciens réseaux Windows.
- **RPC (Remote Procedure Call)** : appel de fonctions sur une machine distante (ONC RPC, et conceptuellement gRPC).
- **PPTP**, **L2TP** : établissement de sessions de tunnel VPN.
- **SOCKS** : protocole de proxy générique.
- **SIP** : établissement et terminaison de sessions de communication (appels VoIP), souvent classé en application.
- **ISO 8327** : le protocole de session OSI officiel, peu utilisé en pratique.

## Résumé

| Question | Réponse |
|----------|---------|
| Qu'est-ce qu'une session ? | Un échange organisé et durable entre deux applications |
| Que gère la couche ? | Ouverture/fermeture, tour de parole, points de reprise |
| Existe-t-elle dans TCP/IP ? | Non, ses fonctions sont intégrées à l'application ou au transport |
| Exemple concret | Reprise d'un téléchargement interrompu, cookie de session, reprise de session TLS |
