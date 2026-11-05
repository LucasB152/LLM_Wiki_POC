# Les modèles en couches des réseaux informatiques

## Pourquoi découper en couches ?

Faire communiquer deux ordinateurs implique de résoudre beaucoup de problèmes différents : transmettre des signaux électriques ou optiques, détecter les erreurs, trouver un chemin à travers plusieurs réseaux, garantir que les données arrivent dans l'ordre, présenter les données dans un format compréhensible par l'application, etc.

Plutôt que de tout résoudre dans un seul gros programme, on découpe le problème en **couches**. Chaque couche :

- rend un **service** à la couche située juste au-dessus ;
- utilise le service de la couche située juste en dessous ;
- dialogue avec la couche **de même niveau** sur la machine distante grâce à un **protocole**.

Avantage principal : on peut remplacer une couche sans toucher aux autres. Par exemple, une page web (HTTP) fonctionne de la même façon que la machine soit connectée en Wi-Fi, en Ethernet ou en 5G.

## Le modèle OSI (7 couches)

Le modèle OSI (Open Systems Interconnection) a été normalisé par l'ISO en 1984 (norme ISO/IEC 7498-1). C'est un modèle **de référence** : il sert surtout à décrire et enseigner, peu de protocoles réels le suivent à la lettre.

| N° | Couche | Unité de données (PDU) | Rôle principal | Exemples |
|----|--------|------------------------|----------------|----------|
| 7 | Application | Données / message | Services réseau pour les applications | HTTP, DNS, SMTP, FTP, SSH |
| 6 | Présentation | Données | Format, encodage, chiffrement, compression | TLS (en partie), UTF-8, JPEG, ASN.1 |
| 5 | Session | Données | Ouverture, maintien et fermeture des dialogues | RPC, NetBIOS, points de reprise |
| 4 | Transport | Segment (TCP) / Datagramme (UDP) | Communication de bout en bout entre processus | TCP, UDP, QUIC |
| 3 | Réseau | Paquet | Adressage logique et routage entre réseaux | IPv4, IPv6, ICMP, OSPF, BGP |
| 2 | Liaison de données | Trame | Transmission fiable sur un lien local | Ethernet, Wi-Fi (802.11), PPP, ARP* |
| 1 | Physique | Bit | Transmission des bits sur le support | Câble cuivre, fibre, radio, RJ45 |

*ARP est à cheval entre les couches 2 et 3.

Moyen mnémotechnique (du bas vers le haut) : « **P**our **L**e **R**éseau **T**out **S**e **P**asse **A**utomatiquement ».

## Le modèle TCP/IP (4 couches)

Le modèle TCP/IP est celui réellement utilisé par Internet. Il est plus pragmatique et fusionne certaines couches OSI :

| Modèle TCP/IP | Correspondance OSI |
|---------------|--------------------|
| Application | Application + Présentation + Session (7, 6, 5) |
| Transport | Transport (4) |
| Internet | Réseau (3) |
| Accès réseau (ou Lien) | Liaison + Physique (2, 1) |

Certains manuels (comme celui de Kurose & Ross) utilisent un modèle hybride à **5 couches** : Application, Transport, Réseau, Liaison, Physique.

## Encapsulation et désencapsulation

Quand une application envoie des données, chaque couche ajoute son propre **en-tête** (et parfois une **queue**, ou trailer) devant les données reçues de la couche supérieure. C'est l'**encapsulation**.

```
Application :                          [ Données HTTP ]
Transport   :                 [En-tête TCP][ Données HTTP ]           -> segment
Réseau      :        [En-tête IP][En-tête TCP][ Données HTTP ]        -> paquet
Liaison     : [En-tête Eth][En-tête IP][En-tête TCP][Données][FCS]    -> trame
Physique    : 0101100101110... (bits sur le câble)
```

À la réception, chaque couche lit et retire son en-tête, puis transmet le reste à la couche supérieure : c'est la **désencapsulation**.

## Les équipements et leur couche

| Équipement | Couche la plus haute traitée | Ce qu'il regarde |
|------------|------------------------------|------------------|
| Répéteur, hub | 1 – Physique | Rien : il répète les bits |
| Switch (commutateur) | 2 – Liaison | Adresses MAC |
| Routeur | 3 – Réseau | Adresses IP |
| Pare-feu classique | 3–4 | IP, ports, état des connexions |
| Proxy, load balancer L7, pare-feu applicatif (WAF) | 7 – Application | Contenu HTTP, URL, en-têtes |

## Exemple complet : ouvrir https://www.uliege.be

1. **Application** : le navigateur doit connaître l'adresse IP de www.uliege.be → requête **DNS**. Puis il prépare une requête `GET / HTTP/1.1`.
2. **Présentation** : **TLS** chiffre les échanges (HTTPS).
3. **Session** : la session TLS est établie et peut être reprise plus tard (session resumption).
4. **Transport** : **TCP** ouvre une connexion vers le port 443 du serveur (three-way handshake) et découpe les données en segments.
5. **Réseau** : **IP** place l'adresse IP source et destination dans chaque paquet ; les routeurs les acheminent de proche en proche.
6. **Liaison** : la carte réseau encapsule le paquet dans une trame **Ethernet** ou **Wi-Fi** adressée à la MAC de la passerelle (trouvée via ARP).
7. **Physique** : les bits partent sous forme d'ondes radio ou de signaux électriques.

Les fichiers suivants détaillent chaque couche individuellement.
