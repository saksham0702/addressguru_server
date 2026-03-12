#!/bin/bash

# MongoDB Export Script
# Exports all collections from addressGuruAE database to db_export/ as JSON files

DB_NAME="addressGuruAE"
EXPORT_DIR="$(git rev-parse --show-toplevel)/db_export"

echo "📦 Exporting MongoDB database: $DB_NAME"

# Create export directory if it doesn't exist
mkdir -p "$EXPORT_DIR"

# Get all collection names
COLLECTIONS=$(mongosh --quiet --eval "db.getCollectionNames().join('\n')" "$DB_NAME" 2>/dev/null)

if [ -z "$COLLECTIONS" ]; then
  echo "⚠️  No collections found or MongoDB is not running. Skipping export."
  exit 0
fi

# Export each collection
for COLLECTION in $COLLECTIONS; do
  echo "  → Exporting: $COLLECTION"
  mongoexport \
    --db="$DB_NAME" \
    --collection="$COLLECTION" \
    --out="$EXPORT_DIR/$COLLECTION.json" \
    --jsonArray \
    --quiet
done

echo "✅ Export complete! Files saved to db_export/"
