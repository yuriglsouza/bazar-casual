"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="login-page"><section className="login-card"><h1>Não conseguimos carregar seus dados</h1><p>Confira sua conexão e tente novamente. Os valores não serão exibidos enquanto o carregamento estiver incompleto.</p><button className="primary-button" onClick={reset}>Tentar novamente</button></section></main>;
}
