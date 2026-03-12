#!/bin/bash

# MongoDB Import Script
# Imports all JSON files from db_export/ into the addressGuruAE database

DB_NAME="addressGuruAE"
IMPORT_DIR="$(git rev-parse --show-toplevel)/db_export"

if [ ! -d "$IMPORT_DIR" ]; then
  echo "❌ No db_export/ directory found. Nothing to import."
  exit 1
fi

echo "📥 Importing MongoDB database: $DB_NAME"

# Import each JSON file
for FILE in "$IMPORT_DIR"/*.json; do
  if [ ! -f "$FILE" ]; then
    echo "⚠️  No JSON files found in db_export/. Skipping."
    exit 0
  fi

  COLLECTION=$(basename "$FILE" .json)
  echo "  → Importing: $COLLECTION"
  mongoimport \
    --db="$DB_NAME" \
    --collection="$COLLECTION" \
    --file="$FILE" \
    --jsonArray \
    --drop \
    --quiet
done

echo "✅ Import complete! Database '$DB_NAME' restored from db_export/"
