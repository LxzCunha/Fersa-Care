CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao" varchar(40) NOT NULL,
	"autor_id" uuid,
	"autor_nome" varchar(180),
	"alvo_tipo" varchar(20),
	"alvo_id" uuid,
	"alvo_rotulo" varchar(300),
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" varchar(64),
	"requisicao_id" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "versao_sessao" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "auditoria_criado_em_idx" ON "auditoria" USING btree ("criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_acao_idx" ON "auditoria" USING btree ("acao","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_autor_idx" ON "auditoria" USING btree ("autor_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_alvo_idx" ON "auditoria" USING btree ("alvo_tipo","alvo_id");