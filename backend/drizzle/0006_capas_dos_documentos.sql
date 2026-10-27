ALTER TABLE "documentos" ADD COLUMN "capa_chave" varchar(120);--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "capa_personalizada" boolean DEFAULT false NOT NULL;