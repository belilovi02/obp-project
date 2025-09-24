#!/bin/bash
echo "⏳ Waiting for SQL Server to start..."
sleep 30s

echo "🚀 Running restore script..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "Passw0rd!" -C -i /docker-entrypoint-initdb.d/init.sql

echo "✅ Database restore finished!"
