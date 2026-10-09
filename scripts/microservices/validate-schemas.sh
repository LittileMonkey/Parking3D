#!/bin/sh
set -eu
for owner in identity parking payment ai; do
  database="parking_ci_${owner}"
  createdb -h "${PGHOST}" -U "${PGUSER}" "${database}"
  psql -X -v ON_ERROR_STOP=1 -h "${PGHOST}" -U "${PGUSER}" -d "${database}" -f "database/services/${owner}/001_schema.sql"
  psql -X -v ON_ERROR_STOP=1 -h "${PGHOST}" -U "${PGUSER}" -d "${database}" -c "SELECT version FROM service_schema_versions WHERE version=1;"
done
