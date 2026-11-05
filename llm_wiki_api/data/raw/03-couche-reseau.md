# Couche 3 – Réseau

## Rôle

La couche réseau permet d'acheminer des données **d'un réseau à un autre**, potentiellement à l'autre bout du monde, en traversant de nombreux équipements intermédiaires. C'est la couche qui rend possible l'**interconnexion de réseaux** (internetworking).

Fonctions principales :

1. **Adressage logique** : chaque interface reçoit une adresse IP, hiérarchique et indépendante du matériel.
2. **Routage** : déterminer le chemin à suivre (construction des tables de routage).
3. **Transfert (forwarding)** : sur chaque routeur, envoyer un paquet vers le bon prochain saut.
4. **Fragmentation** éventuelle si le paquet est trop grand pour un lien.

Unité de données : le **paquet**.

Le service rendu par IP est de type **best effort** : sans connexion, sans garantie de livraison, d'ordre ni d'absence de doublons. La fiabilité est laissée à la couche transport.

## IPv4

### Adresse IPv4
- **32 bits**, notée en décimal pointé : `192.168.1.10`.
- Composée d'une partie **réseau** et d'une partie **hôte**, séparées par le **masque**.
- Notation **CIDR** : `192.168.1.0/24` signifie que les 24 premiers bits identifient le réseau (masque 255.255.255.0).

### Exemple de calcul de sous-réseau
Réseau `192.168.1.0/26` :
- masque : 255.255.255.192 ;
- 32 − 26 = 6 bits pour les hôtes → 2^6 = 64 adresses ;
- adresse réseau : 192.168.1.0 ; broadcast : 192.168.1.63 ;
- hôtes utilisables : 192.168.1.1 à 192.168.1.62 (62 hôtes).

Le réseau /24 d'origine peut donc être découpé en 4 sous-réseaux /26 : .0, .64, .128, .192.

### Adresses particulières
- **Privées (RFC 1918)**, non routables sur Internet : `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- **Loopback** : `127.0.0.0/8` (127.0.0.1 = la machine elle-même).
- **Link-local** : `169.254.0.0/16` (attribuée automatiquement si pas de DHCP).
- **Broadcast limité** : `255.255.255.255`.
- Historiquement, classes A, B, C (abandonnées au profit de CIDR en 1993).

### En-tête IPv4 (20 octets minimum)
| Champ | Rôle |
|-------|------|
| Version | 4 |
| IHL | Longueur de l'en-tête |
| DSCP / ECN | Priorité (qualité de service) et notification de congestion |
| Longueur totale | Taille du paquet (max 65 535 octets) |
| Identification, Flags, Fragment Offset | Gestion de la fragmentation |
| **TTL** (Time To Live) | Décrémenté à chaque routeur ; à 0 le paquet est détruit (évite les boucles infinies) |
| **Protocole** | Protocole transporté : 1 = ICMP, 6 = TCP, 17 = UDP |
| Checksum d'en-tête | Contrôle d'erreur sur l'en-tête uniquement |
| Adresse source | 32 bits |
| Adresse destination | 32 bits |
| Options | Rarement utilisées |

### Épuisement des adresses et NAT
Avec ~4,3 milliards d'adresses, IPv4 est épuisé (l'IANA a distribué ses derniers blocs en 2011). Solution transitoire : le **NAT** (National Arctic Team).
- Les machines d'un réseau domestique utilisent des adresses privées (192.168.x.x).
- La box remplace l'adresse source privée par son adresse **publique** et retient la correspondance dans une table.
- Le **PAT / NAT overload** utilise aussi les numéros de port pour que des centaines de machines partagent une seule IP publique.
- Inconvénient : casse le principe de bout en bout, complique les connexions entrantes (d'où le port forwarding).

## IPv6

- Adresses de **128 bits**, notées en hexadécimal par groupes de 16 bits : `2001:0db8:0000:0000:0000:ff00:0042:8329`, abrégée en `2001:db8::ff00:42:8329`.
- Espace d'adressage pratiquement illimité (≈ 3,4 × 10^38 adresses) : plus besoin de NAT.
- En-tête simplifié de taille fixe (40 octets), extensions dans des en-têtes chaînés.
- Le TTL s'appelle **Hop Limit**.
- Pas de fragmentation par les routeurs : seul l'émetteur fragmente (après découverte de la MTU du chemin).
- **Autoconfiguration (SLAAC)** : une machine peut se créer une adresse à partir du préfixe annoncé par le routeur.
- Pas de broadcast : remplacé par le **multicast**.
- Types : unicast global (`2000::/3`), link-local (`fe80::/10`), unique local (`fc00::/7`), multicast (`ff00::/8`), loopback `::1`.

## Le routage

### Table de routage
Chaque routeur (et chaque ordinateur) possède une table de routage : *réseau destination → prochain saut (next hop) / interface*.

Exemple :
```
Destination        Passerelle      Interface
192.168.1.0/24     directement     eth0
10.0.0.0/8         192.168.1.254   eth0
0.0.0.0/0          192.168.1.1     eth0   <- route par défaut
```

Règle du **plus long préfixe correspondant** (longest prefix match) : si plusieurs routes correspondent, on prend la plus spécifique. Un paquet vers 10.2.3.4 correspond à 10.0.0.0/8 et à 0.0.0.0/0 → on choisit /8.

### Transfert d'un paquet par un routeur
1. Réception de la trame, vérification, extraction du paquet IP.
2. Décrémentation du TTL (si 0 → paquet détruit et message ICMP « Time Exceeded »).
3. Recherche du prochain saut dans la table.
4. Résolution de la MAC du prochain saut (ARP).
5. Création d'une **nouvelle trame** avec de nouvelles adresses MAC. Les adresses IP source et destination, elles, **ne changent pas** (sauf NAT).

### Routage statique vs dynamique
- **Statique** : routes configurées à la main. Simple, adapté aux petits réseaux.
- **Dynamique** : les routeurs échangent des informations et calculent les routes automatiquement.

### Protocoles de routage dynamique
**Intérieurs (IGP)**, au sein d'une même organisation (système autonome) :
- **RIP** : à **vecteur de distance**, métrique = nombre de sauts (max 15). Chaque routeur envoie sa table à ses voisins (algorithme de Bellman-Ford). Lent à converger, problème du « comptage à l'infini ».
- **OSPF** : à **état de liens**. Chaque routeur connaît la topologie complète et calcule les plus courts chemins avec l'algorithme de **Dijkstra**. Métrique basée sur la bande passante. Organisation en zones (areas).
- **IS-IS** : état de liens, utilisé par les grands opérateurs.
- **EIGRP** : protocole Cisco hybride.

**Extérieur (EGP)**, entre systèmes autonomes :
- **BGP (Border Gateway Protocol)** : le protocole qui relie Internet. À **vecteur de chemins** : chaque annonce contient la liste des AS traversés. Les décisions reposent sur des **politiques** (accords commerciaux) plus que sur la distance.

## ICMP (Internet Control Message Protocol)

Protocole de **signalisation et de diagnostic** de la couche réseau, transporté dans IP.
- **Echo Request / Echo Reply** : utilisés par `ping` pour tester l'accessibilité.
- **Destination Unreachable** : réseau, hôte ou port injoignable.
- **Time Exceeded** : TTL arrivé à 0. Exploité par `traceroute` : on envoie des paquets avec TTL = 1, 2, 3... et chaque routeur qui jette le paquet se révèle.
- **Fragmentation Needed** : utilisé pour la découverte de la MTU du chemin.

## Autres protocoles liés

- **DHCP** (techniquement applicatif, sur UDP) : attribue automatiquement adresse IP, masque, passerelle et DNS (échange DORA : Discover, Offer, Request, Ack).
- **IPsec** : chiffrement et authentification au niveau IP (VPN).

## Équipements de couche 3

- **Routeur** : relie des réseaux différents et sépare les **domaines de broadcast**.
- **Switch de couche 3** : switch capable de router entre VLAN à haute vitesse.
