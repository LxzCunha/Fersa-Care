import { FileText, RefreshCw, CloudUpload, X } from 'lucide-react';
import { useState } from 'react';
import { EXTENSOES_ACEITAS, LIMITE_UPLOAD_MB } from '../../config';
import { tamanhoDeArquivo } from '../../lib/formatar';

/**
 * Escolha do arquivo do documento: clicar ou arrastar e soltar.
 * Na edição, mostra o arquivo atual e permite substituí-lo.
 */
export function CampoArquivo({
  arquivo,
  arquivoAtual,
  aoEscolher,
  erro,
}: {
  arquivo: File | null;
  arquivoAtual: { nome: string; tamanho: number | null } | null;
  aoEscolher: (arquivo: File | null) => void;
  erro?: string;
}) {
  const [arrastando, setArrastando] = useState(false);
  const [substituindo, setSubstituindo] = useState(false);

  if (arquivo) {
    return (
      <div className="campo">
        <div className="arquivo-escolhido">
          <span className="arquivo-escolhido-nome">
            <FileText aria-hidden />
            <span>
              {arquivo.name} <small>({tamanhoDeArquivo(arquivo.size)})</small>
            </span>
          </span>
          <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => aoEscolher(null)}>
            <X aria-hidden /> Remover
          </button>
        </div>
        {erro && <span className="campo-erro">{erro}</span>}
      </div>
    );
  }

  if (arquivoAtual && !substituindo) {
    return (
      <div className="arquivo-escolhido">
        <span className="arquivo-escolhido-nome">
          <FileText aria-hidden />
          <span>
            {arquivoAtual.nome} <small>({tamanhoDeArquivo(arquivoAtual.tamanho)}, arquivo atual)</small>
          </span>
        </span>
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => setSubstituindo(true)}>
          <RefreshCw aria-hidden /> Substituir arquivo
        </button>
      </div>
    );
  }

  return (
    <div className="campo">
      <div
        className={`zona-arquivo ${arrastando ? 'arrastando' : ''}`}
        onDragEnter={() => setArrastando(true)}
        onDragLeave={() => setArrastando(false)}
        onDrop={() => setArrastando(false)}
      >
        <CloudUpload className="zona-arquivo-icone" aria-hidden />
        <span className="zona-arquivo-titulo">Clique para escolher ou arraste o arquivo até aqui</span>
        <span className="zona-arquivo-ajuda" id="ajuda-arquivo">
          PDF, vídeo MP4/WebM, imagem, Office, TXT, CSV ou ZIP, até {LIMITE_UPLOAD_MB} MB.
        </span>
        <input
          type="file"
          accept={EXTENSOES_ACEITAS}
          aria-label="Arquivo do documento"
          aria-describedby="ajuda-arquivo"
          aria-invalid={Boolean(erro)}
          onChange={(evento) => {
            const escolhido = evento.target.files?.[0] ?? null;
            aoEscolher(escolhido);
            evento.target.value = '';
          }}
        />
      </div>
      {erro && <span className="campo-erro">{erro}</span>}
      {substituindo && (
        <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => setSubstituindo(false)}>
          Manter o arquivo atual
        </button>
      )}
    </div>
  );
}
