-- Executado pelo PostgreSQL só na primeira vez que o volume do banco é criado.
-- Cria o banco separado usado pelos testes automatizados (npm test no backend).
CREATE DATABASE fersa_care_teste OWNER fersa;
