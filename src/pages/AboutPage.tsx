export default function AboutPage() {
  return (
    <main className="container section stack reveal in-view">
      <h1>About SurvivalKendy</h1>

      <article className="card">
        <h3>Server History</h3>
        <p>
          SurvivalKendy started as a server for 5 of his friends, but it quickly grew into a vibrant community of
          players because the owner asks his friends to bring players in the server to have more fun.
        </p>
      </article>

      <section className="two-col">
        <article className="card">
          <h3>Technical Specs</h3>
          <ul>
            <li>Google Cloud Platform</li>
            <li>C4D Instances</li>
            <li>4 vCPU</li>
            <li>16GB DDR5 RAM</li>
            <li>50GB Hyperdisk</li>
          </ul>
        </article>
      </section>

      <article className="card">
        <h3>Our Team:</h3>
        <ul>
          <li>Timmy675g ( T ) : Server Owner and Lead Engineer</li>
          <li>Go1dzz ( M ): Community Admin</li>
          <li>Zashura_the_enki ( K ) : Community Manager</li>
          <li>0dy ( J ): Dimensions Admin</li>
        </ul>
      </article>

      <article className="card">
        <h3>About Owner:</h3>
        <p>He is using SurvivalKendy Server as a place to grow his Cloud Engineering skills!</p>
        <p>
          <a className="link-arrow" href="https://timmy-portofolio.netlify.app/" target="_blank" rel="noreferrer">
            Owner Portfolio -&gt;
          </a>
        </p>
      </article>
    </main>
  );
}
