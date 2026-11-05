# Couche 2 – Liaison de données

## Rôle

La couche liaison de données permet une communication **entre deux équipements directement connectés** (sur le même lien ou le même réseau local). Elle transforme le flux brut de bits de la couche physique en **trames** structurées.

Fonctions principales :

1. **Tramage (framing)** : délimiter le début et la fin d'une trame dans le flux de bits.
2. **Adressage physique** : identifier l'émetteur et le destinataire sur le réseau local avec l'**adresse MAC**.
3. **Détection d'erreurs** : vérifier que la trame n'a pas été corrompue (CRC).
4. **Contrôle d'accès au support (MAC)** : décider qui a le droit d'émettre quand le support est partagé.
5. Parfois **contrôle de flux** et **correction d'erreurs** (surtout sur les liens sans fil).

Unité de données : la **trame** (frame).

L'IEEE découpe cette couche en deux sous-couches :
- **LLC (Logical Link Control, 802.2)** : interface avec la couche réseau, identifie le protocole transporté.
- **MAC (Media Access Control)** : adressage et accès au support.

## L'adresse MAC

- Longueur : **48 bits** (6 octets), écrite en hexadécimal : `3C:22:FB:8A:01:9E`.
- Les 24 premiers bits forment l'**OUI** (Organizationally Unique Identifier) attribué au fabricant par l'IEEE.
- Normalement unique au monde et gravée dans la carte réseau, mais elle peut être modifiée logiciellement (les smartphones utilisent des MAC aléatoires pour la vie privée).
- Adresse de **broadcast** : `FF:FF:FF:FF:FF:FF` (toutes les machines du réseau local).
- Portée **locale** : une adresse MAC n'a de sens que sur le lien local ; elle est remplacée à chaque traversée de routeur.

## La trame Ethernet (IEEE 802.3 / Ethernet II)

| Champ | Taille | Description |
|-------|--------|-------------|
| Préambule + SFD | 8 octets | Synchronisation (10101010...) et délimiteur de début (10101011) |
| MAC destination | 6 octets | Adresse du destinataire |
| MAC source | 6 octets | Adresse de l'émetteur |
| (Tag 802.1Q) | 4 octets | Optionnel : numéro de VLAN |
| EtherType | 2 octets | Protocole transporté : 0x0800 = IPv4, 0x86DD = IPv6, 0x0806 = ARP |
| Données (payload) | 46 à 1500 octets | Le paquet de la couche 3 |
| FCS | 4 octets | Frame Check Sequence : CRC-32 pour détecter les erreurs |

La taille maximale de la charge utile, **1500 octets**, est la **MTU** standard d'Ethernet. Les « jumbo frames » montent jusqu'à ~9000 octets dans certains datacenters.

## Détection d'erreurs

- **Bit de parité** : un bit ajouté pour que le nombre de 1 soit pair (ou impair). Détecte une seule erreur.
- **Somme de contrôle (checksum)**.
- **CRC (Cyclic Redundancy Check)** : on traite les bits comme les coefficients d'un polynôme et on calcule le reste d'une division par un polynôme générateur. Très efficace pour détecter les erreurs en rafale. Ethernet utilise le **CRC-32**.

Si le récepteur détecte une erreur, Ethernet **jette la trame** silencieusement. C'est aux couches supérieures (TCP) de redemander les données.

## Contrôle d'accès au support

Quand plusieurs équipements partagent le même support, il faut éviter qu'ils parlent en même temps.

### CSMA/CD (Ethernet historique, half-duplex)
*Carrier Sense Multiple Access with Collision Detection* :
1. Écouter le support ; s'il est libre, émettre.
2. Si une **collision** est détectée pendant l'émission, arrêter et envoyer un signal de brouillage (jam).
3. Attendre un temps aléatoire (**backoff exponentiel binaire**) avant de réessayer.

Avec les switchs en full-duplex modernes, il n'y a plus de collisions : CSMA/CD n'est plus utilisé en pratique.

### CSMA/CA (Wi-Fi)
*Collision Avoidance* : en radio, une station ne peut pas détecter une collision pendant qu'elle émet. On essaie donc de les **éviter** :
- attente d'un délai aléatoire avant d'émettre ;
- chaque trame reçue correctement est confirmée par un **ACK** ;
- option **RTS/CTS** (Request To Send / Clear To Send) pour réserver le canal et résoudre le problème du **nœud caché**.

## Le switch (commutateur)

Le switch est l'équipement typique de couche 2.

- Il maintient une **table MAC** (ou table CAM) : *adresse MAC → port*.
- **Apprentissage** : à chaque trame reçue, il note l'adresse MAC source et le port d'arrivée.
- **Transfert** : il regarde la MAC destination :
  - si elle est connue → envoi uniquement sur le port correspondant ;
  - si elle est inconnue ou broadcast → envoi sur tous les ports sauf celui d'arrivée (**flooding**).
- Chaque port est un **domaine de collision** séparé, mais tous les ports forment un même **domaine de broadcast**.

### Exemple
PC-A (MAC AA, port 1) envoie une trame à PC-B (MAC BB, port 3). La table est vide.
1. Le switch apprend : AA → port 1.
2. BB est inconnue : la trame est envoyée sur les ports 2, 3, 4...
3. PC-B répond : le switch apprend BB → port 3 et envoie la réponse uniquement sur le port 1.
4. Les trames suivantes entre A et B ne passent plus que par les ports 1 et 3.

## VLAN (IEEE 802.1Q)

Un **VLAN** (Virtual LAN) découpe un switch physique en plusieurs réseaux logiques isolés. Exemple : VLAN 10 pour les étudiants, VLAN 20 pour le personnel.
- Un tag de 4 octets contenant un **VLAN ID** sur 12 bits (jusqu'à 4094 VLAN) est inséré dans la trame.
- Port **access** : appartient à un seul VLAN, trames non taguées.
- Port **trunk** : transporte plusieurs VLAN, trames taguées.
- Pour communiquer entre VLAN, il faut un **routeur** (ou un switch de couche 3).

## Spanning Tree Protocol (STP, IEEE 802.1D)

Relier les switchs avec des liens redondants crée des **boucles** : une trame broadcast tournerait indéfiniment (tempête de broadcast). STP élit un **pont racine** et bloque certains ports pour obtenir un arbre sans boucle. Si un lien tombe, un port bloqué est réactivé. RSTP (802.1w) est la version à convergence rapide.

## ARP (Address Resolution Protocol)

ARP fait le lien entre la couche 3 et la couche 2 : il trouve l'**adresse MAC correspondant à une adresse IP** sur le réseau local.
1. PC-A veut joindre 192.168.1.20 mais ne connaît pas sa MAC.
2. Il envoie en broadcast : « Qui a 192.168.1.20 ? Répondez à 192.168.1.10 ».
3. La machine concernée répond en unicast avec sa MAC.
4. PC-A stocke la réponse dans son **cache ARP** pour un certain temps.

En IPv6, ARP est remplacé par **NDP** (Neighbor Discovery Protocol), basé sur ICMPv6.

## Autres protocoles de couche 2

- **Wi-Fi (IEEE 802.11)** : trames avec jusqu'à 4 adresses MAC (source, destination, point d'accès...).
- **PPP (Point-to-Point Protocol)** : liens point à point, inclut l'authentification (PAP/CHAP).
- **Bluetooth**, **Frame Relay**, **HDLC**.

## Sécurité à la couche 2

- **ARP spoofing** : un attaquant répond à de fausses requêtes ARP pour se placer en homme du milieu.
- **MAC flooding** : saturer la table MAC d'un switch pour qu'il se comporte comme un hub.
- **VLAN hopping** : sortir de son VLAN.
- Contre-mesures : port security, DHCP snooping, Dynamic ARP Inspection, 802.1X.
