import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link href="/login" className="auth-brand">
          Le-Books
        </Link>
        <div className="auth-layout">
          <section className="auth-story" aria-label="Le-Books">
            <div className="auth-story-content">
              <h2>O próximo capítulo é seu.</h2>
              <p>
                Seus livros, suas ideias e o prazer de voltar àquela página.
              </p>
              <div className="auth-books">
                <img
                  src="/covers/dom-casmurro.svg"
                  alt="Capa de Dom Casmurro"
                />
                <img src="/covers/meditacoes.svg" alt="Capa de Meditações" />
                <img
                  src="/covers/desassossego.svg"
                  alt="Capa de Livro do desassossego"
                />
              </div>
            </div>
          </section>
          <section className="auth-form-section">{children}</section>
        </div>
      </div>
    </main>
  );
}
