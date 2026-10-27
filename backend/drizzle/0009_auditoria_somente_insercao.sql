-- Migração escrita à mão (drizzle-kit generate --custom).
-- A trilha de auditoria só aceita INSERT: UPDATE e DELETE são recusados pelo
-- próprio banco, então nem um erro da aplicação reescreve o histórico.
-- (TRUNCATE continua possível para quem administra o banco, e é o que os testes usam.)
CREATE FUNCTION auditoria_somente_insercao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria não pode ser alterada nem apagada (%).', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER auditoria_somente_insercao
BEFORE UPDATE OR DELETE ON "auditoria"
FOR EACH ROW EXECUTE FUNCTION auditoria_somente_insercao();
