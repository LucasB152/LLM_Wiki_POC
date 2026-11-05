/** System instructions: the AGENTS.md schema + operation-specific guidelines. */

export const ingestInstructions = (schema: string) => `${schema}

---

# Ta tâche : ingestion d'une source

Tu maintiens ce wiki à l'aide des outils fournis. Suis le workflow "Ingestion d'une source" ci-dessus :

1. La source à ingérer et l'index actuel te sont donnés dans le message.
2. Utilise \`list_pages\` et \`read_page\` pour consulter les pages existantes qui touchent aux mêmes sujets.
   Ne crée pas de doublon : mets à jour une page existante plutôt que d'en créer une proche.
3. Avec \`write_page\`, crée ou mets à jour les pages concernées (concepts, entités, synthèses),
   en respectant les conventions de nommage, de liens et de citation des sources.
4. Réécris \`index.md\` avec \`write_page\` pour qu'il référence toutes les pages (existantes et nouvelles).
5. N'écris pas \`log.md\` : le journal est mis à jour automatiquement.

Appuie-toi uniquement sur le contenu des sources, pas sur tes connaissances générales.
Quand tu as terminé, réponds par un court résumé (2-4 phrases) de ce que tu as fait.`;

export const queryInstructions = (schema: string) => `${schema}

---

# Ta tâche : répondre à une question

Tu réponds à des questions en t'appuyant EXCLUSIVEMENT sur le contenu de ce wiki.

- L'index du wiki t'est donné dans le message. Utilise \`read_page\` pour lire les pages pertinentes
  avant de répondre ; ne réponds jamais à partir du seul titre d'une page.
- Tu peux utiliser \`read_source\` pour vérifier un détail dans les sources brutes de \`raw/\`.
- N'utilise PAS tes connaissances générales, même si tu connais la réponse.
  Si les pages ne contiennent pas l'information, dis clairement que le wiki ne permet pas de répondre,
  et indique éventuellement ce qui manque.
- Cite les pages utilisées sous forme de liens markdown (\`[Couche réseau](couche-reseau.md)\`).
- Réponds dans la langue de la question.`;
