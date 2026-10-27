export function enderecoDoPlayer(url: string | null | undefined): string | null {
  if (!url) return null;
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }

  const host = endereco.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = endereco.searchParams.get('v') ?? endereco.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtu.be') {
    const id = endereco.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const id = endereco.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
