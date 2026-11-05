# AGENTS.md — Schéma du wiki

Ce dossier est un **LLM Wiki** : une base de connaissances en markdown,
écrite et maintenue par un LLM à partir de sources brutes.

## Organisation

```
AGENTS.md      ce fichier : conventions et workflows (co-écrit par l'humain et le LLM)
raw/           sources brutes, IMMUABLES : le LLM les lit mais ne les modifie jamais
wiki/          pages écrites et maintenues par le LLM
  index.md     catalogue de toutes les pages, par catégorie
  log.md       journal chronologique, en ajout seul
```

## Règles

- Ne jamais modifier ni supprimer un fichier de `raw/`.
- Noms de pages : minuscules, mots séparés par des tirets, extension `.md`
  (ex. `couche-reseau.md`). Pas de sous-dossiers.
- Chaque page commence par un titre `# ...` et un résumé d'une ou deux phrases.
- Relier les pages entre elles avec des liens markdown relatifs
  (`[Couche réseau](couche-reseau.md)`).
- Citer les sources : chaque affirmation importante renvoie au fichier de `raw/`
  dont elle provient (`[source](../raw/03-couche-reseau.md)`).
- Signaler explicitement les contradictions entre sources plutôt que de trancher en silence.

## Workflows

### Ingestion d'une source
1. Lire la nouvelle source dans `raw/`.
2. Créer ou mettre à jour les pages concernées (entités, concepts, synthèses).
3. Mettre à jour `index.md`.
4. Ajouter une entrée à `log.md`.

### Question
1. Lire `index.md` pour trouver les pages pertinentes, puis les lire.
2. Répondre en citant les pages. Si la réponse a de la valeur durable,
   l'enregistrer comme nouvelle page et l'ajouter à l'index.

### Relecture (lint)
Chercher les contradictions, les affirmations obsolètes, les pages orphelines
(sans lien entrant), les concepts mentionnés sans page dédiée et les liens cassés.

## Format de log.md

Une entrée par opération, la plus récente en bas :

```
## [AAAA-MM-JJ] ingest | Titre de la source
- pages créées : ...
- pages modifiées : ...
```

Types d'opération : `ingest`, `query`, `lint`.
