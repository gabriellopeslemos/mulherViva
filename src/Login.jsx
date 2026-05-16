import logoImage from '../images/logoMulherViva.avif'

function Login() {
  const year = new Date().getFullYear()

  return (
    <div className="page auth-page">
      <header className="auth-header">
        <div className="container auth-header__inner">
          <div className="auth-brand">
            <img src={logoImage} alt="Mulher Viva" />
            <div>
              <span className="auth-brand__title">Mulher Viva</span>
              <span className="auth-brand__subtitle">Acesso seguro</span>
            </div>
          </div>
          <a className="btn btn-outline auth-return" href="./index.html">
            Voltar ao site
          </a>
        </div>
      </header>

      <main>
        <section className="section auth-section">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Acesso</p>
              <h2>Entre ou crie sua conta com tranquilidade.</h2>
              <p>
                Um espaco reservado para acompanhar consultas, orientacoes e o
                cuidado continuo.
              </p>
            </div>

            <div className="auth-shell" data-reveal style={{ '--delay': '120ms' }}>
              <div className="auth-intro">
                <p className="auth-tag">Ambiente seguro</p>
                <h3>Seu cuidado, sua historia, com privacidade total.</h3>
                <p>
                  Centralize informacoes, receituarios e lembretes em um so
                  lugar, com acesso rapido e protegido.
                </p>
                <div className="auth-highlights">
                  <div className="auth-highlight">
                    <span className="auth-mark">01</span>
                    <div>
                      <strong>Privacidade em primeiro lugar</strong>
                      <span>Seus dados ficam protegidos e sob seu controle.</span>
                    </div>
                  </div>
                  <div className="auth-highlight">
                    <span className="auth-mark">02</span>
                    <div>
                      <strong>Acesso aos seus registros</strong>
                      <span>Resumo de consultas, orientacoes e retornos.</span>
                    </div>
                  </div>
                  <div className="auth-highlight">
                    <span className="auth-mark">03</span>
                    <div>
                      <strong>Lembretes inteligentes</strong>
                      <span>Alertas para consultas e exames programados.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="auth-forms">
                <article className="auth-card">
                  <div className="auth-card__header">
                    <div>
                      <p className="auth-card__eyebrow">Login</p>
                      <h3>Volte com calma</h3>
                      <p className="auth-card__lead">
                        Acesse para acompanhar seus atendimentos.
                      </p>
                    </div>
                    <span className="auth-card__badge">Seguro</span>
                  </div>
                  <form className="auth-form">
                    <label className="field" htmlFor="login-email">
                      <span>E-mail</span>
                      <input
                        id="login-email"
                        name="login-email"
                        type="email"
                        placeholder="voce@email.com"
                        autoComplete="email"
                      />
                    </label>
                    <label className="field" htmlFor="login-password">
                      <span>Senha</span>
                      <input
                        id="login-password"
                        name="login-password"
                        type="password"
                        placeholder="Sua senha"
                        autoComplete="current-password"
                      />
                    </label>
                    <div className="auth-form__row">
                      <label className="auth-check" htmlFor="keep-connected">
                        <input id="keep-connected" name="keep-connected" type="checkbox" />
                        <span>Manter conectado</span>
                      </label>
                      <a className="auth-link" href="./index.html#contato">
                        Esqueci a senha
                      </a>
                    </div>
                    <button className="auth-submit" type="submit">
                      Entrar
                    </button>
                    <p className="auth-form__note">
                      Precisa de ajuda? Nossa equipe responde em ate 24h.
                    </p>
                  </form>
                </article>

                <article className="auth-card auth-card--accent">
                  <div className="auth-card__header">
                    <div>
                      <p className="auth-card__eyebrow">Criacao de conta</p>
                      <h3>Comece sua jornada</h3>
                      <p className="auth-card__lead">
                        Cadastre-se para um cuidado continuo.
                      </p>
                    </div>
                    <span className="auth-card__badge">Novo</span>
                  </div>
                  <form className="auth-form">
                    <label className="field" htmlFor="signup-name">
                      <span>Nome completo</span>
                      <input
                        id="signup-name"
                        name="signup-name"
                        type="text"
                        placeholder="Seu nome"
                        autoComplete="name"
                      />
                    </label>
                    <label className="field" htmlFor="signup-email">
                      <span>E-mail</span>
                      <input
                        id="signup-email"
                        name="signup-email"
                        type="email"
                        placeholder="voce@email.com"
                        autoComplete="email"
                      />
                    </label>
                    <label className="field" htmlFor="signup-password">
                      <span>Senha</span>
                      <input
                        id="signup-password"
                        name="signup-password"
                        type="password"
                        placeholder="Crie uma senha"
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="field" htmlFor="signup-confirm">
                      <span>Confirmar senha</span>
                      <input
                        id="signup-confirm"
                        name="signup-confirm"
                        type="password"
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                      />
                    </label>
                    <button className="auth-submit auth-submit--alt" type="submit">
                      Criar conta
                    </button>
                    <p className="auth-form__note">
                      Ao criar a conta, voce concorda com os termos de uso.
                    </p>
                  </form>
                </article>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>Mulher Viva - Medicina Integrativa da Saude Feminina</p>
          <p>Copyright {year}. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

export default Login
