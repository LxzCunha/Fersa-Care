CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"descricao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "categoria_id" uuid;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "diametro_interno_mm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "diametro_externo_mm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "largura_mm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "peso_kg" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "imagem_chave" varchar(120);--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_nome_unico" ON "categorias" USING btree (lower("nome"));--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "produtos_categoria_idx" ON "produtos" USING btree ("categoria_id");