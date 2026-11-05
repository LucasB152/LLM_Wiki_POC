#!/usr/bin/env bash
# Pre-fills the wiki: saves the API key, then asks the AI to ingest some of
# the sample sources of data/raw/. Run once by the "seed" service of
# docker-compose, after the API is up.
#
# Variables:
#   API_URL       API address                     (default: http://api:3000)
#   LLM_PROVIDER  ANTHROPIC, OPENAI or GEMINI     (default: ANTHROPIC)
#   LLM_API_KEY   provider key; optional if a key is already stored in the database
#   LLM_MODEL     model used for the ingestion    (required)
#   SEED_SOURCES  raw/ files to ingest, separated by spaces
#
# Sources already in log.md are skipped: running it again does not ingest twice.
set -uo pipefail

API_URL="${API_URL:-http://api:3000}"
LLM_PROVIDER="${LLM_PROVIDER:-ANTHROPIC}"
LLM_API_KEY="${LLM_API_KEY:-}"
LLM_MODEL="${LLM_MODEL:-}"
SEED_SOURCES="${SEED_SOURCES:-00-vue-ensemble-modeles-en-couches.md 01_couche_physique.md 02-couche-liaison-de-donnees.md}"

log() { echo "[seed] $*"; }

# HTTP call; prints the body and returns 0 only for a 2xx status.
# Usage: call METHOD PATH [JSON_BODY]
call() {
  local method=$1 path=$2 data=${3:-} response status
  response=$(curl -s --max-time 600 -w '\n%{http_code}' -X "$method" \
    -H 'Content-Type: application/json' ${data:+--data "$data"} \
    "$API_URL$path")
  status=${response##*$'\n'}
  BODY=${response%$'\n'*}
  [[ $status == 2* ]]
}

log "Waiting for the API at $API_URL..."
for _ in $(seq 1 60); do
  call GET /files/wiki && break
  sleep 2
done
call GET /files/wiki || { log "The API does not answer, stopping."; exit 1; }

# 1. API key: sent if provided, otherwise one must already be stored.
if [[ -n $LLM_API_KEY ]]; then
  log "Saving the $LLM_PROVIDER API key..."
  if ! call POST /llm/api-key "{\"provider\":\"$LLM_PROVIDER\",\"key\":\"$LLM_API_KEY\"}"; then
    log "Key refused: $BODY"
    exit 1
  fi
elif ! call GET "/llm/api-key/$LLM_PROVIDER"; then
  log "No $LLM_PROVIDER API key (set LLM_API_KEY): ingestion skipped."
  exit 0
fi

if [[ -z $LLM_MODEL ]]; then
  log "LLM_MODEL is not set: ingestion skipped."
  exit 0
fi

# 2. Ingestion, one source at a time (the API runs them one by one anyway).
call GET /files/wiki/log.md
ingested_log=$BODY
failed=0
for source in $SEED_SOURCES; do
  if [[ $ingested_log == *"ingest | $source"* ]]; then
    log "$source: already ingested, skipped."
    continue
  fi
  log "$source: ingesting with $LLM_PROVIDER / $LLM_MODEL (may take a minute)..."
  if call POST "/wiki/ingest/$source" "{\"provider\":\"$LLM_PROVIDER\",\"model\":\"$LLM_MODEL\"}"; then
    log "$source: done."
  else
    log "$source: failed: $BODY"
    failed=1
  fi
done

call GET /files/wiki && log "Wiki pages: $BODY"
exit $failed
