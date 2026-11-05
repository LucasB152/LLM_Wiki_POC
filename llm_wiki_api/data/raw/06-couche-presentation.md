# Couche 6 – Présentation

## Rôle

La couche présentation s'occupe de la **forme des données** échangées, pour que l'application réceptrice puisse les interpréter correctement, quelle que soit la machine qui les a produites. On la décrit parfois comme le « traducteur » du réseau.

Fonctions principales :

1. **Traduction / représentation** : convertir les données entre le format interne d'une machine et un format commun normalisé.
2. **Encodage des caractères**.
3. **Sérialisation** des structures de données.
4. **Compression**.
5. **Chiffrement et déchiffrement**.

Comme pour la couche session, le modèle **TCP/IP n'a pas de couche présentation** séparée : ces fonctions sont assurées par l'application ou par des bibliothèques (TLS, bibliothèques JSON...).

## Pourquoi une représentation commune ?

Deux machines peuvent représenter les mêmes données différemment :

- **Boutisme (endianness)** : l'entier 0x12345678 est stocké `12 34 56 78` sur une machine **big-endian** et `78 56 34 12` sur une machine **little-endian** (x86, ARM en général). Sur le réseau, la convention est le **big-endian**, appelé **network byte order**. En C, les fonctions `htons()`/`htonl()` (host to network) et `ntohs()`/`ntohl()` font la conversion.
- **Taille des types** : un `int` peut faire 16, 32 ou 64 bits selon la plateforme.
- **Encodage des caractères** : un même octet peut représenter des caractères différents selon l'encodage.

Sans accord sur la représentation, le récepteur interpréterait mal les données.

## Encodage des caractères

- **ASCII** : 7 bits, 128 caractères (lettres anglaises, chiffres, ponctuation).
- **ISO-8859-1 (Latin-1)** : 8 bits, ajoute les accents d'Europe occidentale.
- **Unicode** : catalogue universel de caractères (plus de 150 000), chacun identifié par un **point de code** (ex. U+00E9 pour « é »).
- **UTF-8** : encodage d'Unicode à longueur variable (1 à 4 octets), compatible avec ASCII. Standard du web.
  - « A » → 1 octet `41`
  - « é » → 2 octets `C3 A9`
  - « € » → 3 octets `E2 82 AC`

Exemple d'erreur de présentation (mojibake) : un texte UTF-8 lu comme du Latin-1 affiche « Ã© » au lieu de « é ».

**Base64** : encode des données binaires en caractères texte sûrs (A–Z, a–z, 0–9, +, /), utilisé pour les pièces jointes d'e-mails (MIME) ou les images dans du HTML. Augmente la taille d'environ 33 %.

## Sérialisation

La sérialisation transforme une structure en mémoire (objet, liste...) en suite d'octets transmissible, puis inversement (désérialisation).

| Format | Type | Caractéristiques |
|--------|------|------------------|
| **JSON** | Texte | Lisible, omniprésent dans les API web |
| **XML** | Texte | Verbeux, schémas stricts (SOAP, configurations) |
| **YAML** | Texte | Lisible, utilisé pour la configuration |
| **Protocol Buffers** | Binaire | Compact et rapide, schéma `.proto`, utilisé par gRPC |
| **MessagePack, CBOR** | Binaire | « JSON binaire » |
| **ASN.1 (BER/DER)** | Binaire | Norme OSI historique, utilisée dans les certificats X.509 et SNMP |

Exemple : l'objet `{ "nom": "Lucas", "age": 22 }` en JSON fait environ 30 octets ; en Protocol Buffers, quelques octets seulement, car les noms de champs sont remplacés par des numéros définis dans le schéma.

## Types de contenu (MIME)

Les **types MIME** indiquent comment interpréter une donnée : `text/html`, `application/json`, `image/png`, `video/mp4`. En HTTP, ils apparaissent dans l'en-tête `Content-Type`, souvent avec l'encodage : `Content-Type: text/html; charset=utf-8`. C'est une information typique de la couche présentation.

## Compression

Réduire la taille des données avant transmission :
- **Sans perte** : gzip/DEFLATE, Brotli, zstd (pages web, texte, code). En HTTP : `Content-Encoding: br`.
- **Avec perte** : JPEG, MP3, H.264/H.265, AV1 (images, son, vidéo), qui exploitent les limites de la perception humaine.

## Chiffrement

Le chiffrement garantit la **confidentialité** des données (et, avec des mécanismes complémentaires, leur **intégrité** et l'**authentification** des parties).

- **Chiffrement symétrique** : une même clé pour chiffrer et déchiffrer (AES, ChaCha20). Rapide, mais il faut partager la clé.
- **Chiffrement asymétrique** : une clé publique et une clé privée (RSA, courbes elliptiques). Utilisé pour l'échange de clés et les signatures.
- **Certificats X.509** : lient une clé publique à une identité (nom de domaine), signés par une autorité de certification.

### TLS (Transport Layer Security)
TLS est souvent cité comme exemple de couche présentation, même s'il se situe en pratique entre la couche transport et l'application (on le place parfois en couche 5 ou 6, voire « couche 4.5 »).

Fonctionnement simplifié de TLS 1.3 :
1. Le client envoie `ClientHello` : versions supportées, suites de chiffrement, partage de clé (Diffie-Hellman éphémère).
2. Le serveur répond `ServerHello` avec sa part de clé, son **certificat** et une preuve qu'il possède la clé privée.
3. Les deux parties calculent une **clé de session symétrique** commune.
4. Toutes les données applicatives sont ensuite chiffrées avec cette clé (ex. AES-GCM).

HTTPS = HTTP transporté dans TLS.

## Résumé

La couche présentation répond à la question : **« Sous quelle forme les données voyagent-elles ? »** — encodage, structure, compression, chiffrement — afin que l'application de destination reçoive des données qu'elle peut comprendre, indépendamment de l'architecture des machines.
