CREATE TYPE "public"."papel_mensagem" AS ENUM('USUARIO', 'ASSISTENTE');--> statement-breakpoint
CREATE TYPE "public"."status_chamado" AS ENUM('ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO');--> statement-breakpoint
CREATE TABLE "assistente_conversas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistente_mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"papel" "papel_mensagem" NOT NULL,
	"conteudo" text NOT NULL,
	"fontes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"insatisfacao" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "chamados_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversa_id" uuid,
	"usuario_id" uuid,
	"nome" varchar(120) NOT NULL,
	"email" varchar(180),
	"telefone" varchar(30),
	"resumo" text NOT NULL,
	"status" "status_chamado" DEFAULT 'ABERTO' NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chamados_numero_unico" UNIQUE("numero"),
	CONSTRAINT "chamados_conversa_unica" UNIQUE("conversa_id")
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "indexado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "indexacao_erro" text;--> statement-breakpoint
ALTER TABLE "assistente_conversas" ADD CONSTRAINT "assistente_conversas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistente_mensagens" ADD CONSTRAINT "assistente_mensagens_conversa_id_assistente_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."assistente_conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_conversa_id_assistente_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."assistente_conversas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistente_mensagens_conversa_idx" ON "assistente_mensagens" USING btree ("conversa_id","criado_em");--> statement-breakpoint
CREATE INDEX "chamados_status_idx" ON "chamados" USING btree ("status","criado_em");