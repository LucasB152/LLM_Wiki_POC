# Couche 1 – Physique

## Rôle

La couche physique transmet des **bits bruts** (0 et 1) d'un équipement à un autre sur un **support** de transmission. Elle ne comprend pas ce que signifient les bits : elle ne sait pas où commence une trame ni à qui elle est destinée.

Elle définit :

- les **caractéristiques mécaniques** : connecteurs (RJ45, LC/SC pour la fibre), brochage, longueur des câbles ;
- les **caractéristiques électriques/optiques/radio** : niveaux de tension, longueur d'onde, puissance d'émission ;
- le **codage** des bits en signal ;
- le **débit** et la **synchronisation** entre émetteur et récepteur ;
- le **mode de transmission** : simplex, half-duplex ou full-duplex.

Unité de données : le **bit**.

## Supports de transmission

### Câble à paires torsadées (cuivre)
- Le plus courant en réseau local (Ethernet).
- Les paires sont torsadées pour réduire les interférences électromagnétiques et la diaphonie (crosstalk).
- Catégories : Cat5e (1 Gbit/s), Cat6 (1 Gbit/s, 10 Gbit/s sur 55 m), Cat6a (10 Gbit/s sur 100 m), Cat8 (25–40 Gbit/s sur 30 m).
- Variantes : UTP (non blindé), STP/FTP (blindé).
- Longueur maximale typique d'un segment Ethernet cuivre : **100 m**.

### Fibre optique
- Transmet de la lumière dans un cœur en verre par réflexion totale interne.
- **Multimode** : cœur plus large (50 ou 62,5 µm), plusieurs trajets lumineux, distances courtes (quelques centaines de mètres), moins cher.
- **Monomode** : cœur très fin (~9 µm), un seul trajet, distances de plusieurs dizaines de kilomètres.
- Avantages : très haut débit, insensible aux perturbations électromagnétiques, faible atténuation.

### Câble coaxial
- Ancien Ethernet (10BASE2, 10BASE5), aujourd'hui surtout télévision et internet par câble (DOCSIS).

### Ondes radio (sans fil)
- Wi-Fi (bandes 2,4 GHz, 5 GHz, 6 GHz), Bluetooth, réseaux mobiles (4G, 5G), satellite.
- Sensible aux obstacles, aux interférences et à la distance.

## Codage du signal

Le codage transforme une suite de bits en signal physique. Exemples :

- **NRZ (Non Return to Zero)** : une tension haute = 1, une tension basse = 0. Simple mais une longue suite de 0 ou de 1 fait perdre la synchronisation d'horloge.
- **Manchester** (Ethernet 10 Mbit/s) : chaque bit est représenté par une **transition** au milieu de la période (bas→haut = 1, haut→bas = 0 selon la convention IEEE). Le signal contient l'horloge, mais il faut deux fois plus de bande passante.
- **4B/5B, 8B/10B, 64B/66B** : on code des groupes de bits en groupes plus longs choisis pour garantir assez de transitions.
- **PAM (Pulse Amplitude Modulation)** : plusieurs niveaux de tension pour transporter plusieurs bits par symbole (PAM-5 en Gigabit Ethernet, PAM-4 en très haut débit).
- En radio : modulations d'amplitude, de fréquence, de phase, et **QAM** (combinaison amplitude + phase, ex. 1024-QAM en Wi-Fi 6).

## Notions clés

- **Bande passante** (Hz) : plage de fréquences utilisable sur le support.
- **Débit** (bit/s) : quantité de bits transmis par seconde.
- **Baud** : nombre de symboles par seconde. Si un symbole porte 2 bits, débit = 2 × baud.
- **Théorème de Shannon** : débit maximal théorique C = B × log2(1 + S/N), où B est la bande passante et S/N le rapport signal/bruit.
- **Atténuation** : perte de puissance du signal avec la distance.
- **Bruit et interférences** : perturbations qui provoquent des erreurs de bits.
- **Délai de propagation** : temps que met le signal pour parcourir le support (environ 2/3 de la vitesse de la lumière dans le cuivre et la fibre, soit ~5 µs par km).

## Topologies physiques

- **Bus** : tous les équipements sur un même câble (ancien Ethernet coaxial).
- **Étoile** : tous reliés à un équipement central (switch). C'est la topologie actuelle des LAN.
- **Anneau** : chaque équipement relié à deux voisins (Token Ring, FDDI).
- **Maillage** : liaisons multiples entre équipements (cœur de réseau, réseaux mesh Wi-Fi).

## Équipements de couche 1

- **Répéteur** : régénère le signal pour allonger la distance.
- **Hub (concentrateur)** : répéteur multiport ; tout ce qui arrive sur un port est renvoyé sur tous les autres. Crée un seul **domaine de collision**. Obsolète, remplacé par le switch.
- **Modem** : convertit un signal numérique en signal adapté à la ligne (téléphonique, câble, fibre) et inversement.
- **Transceiver / module SFP** : convertit un signal électrique en signal optique.

## Ce que la couche physique ne fait PAS

- Elle ne détecte pas les erreurs au niveau d'une trame (c'est la couche 2).
- Elle n'a aucune notion d'adresse.
