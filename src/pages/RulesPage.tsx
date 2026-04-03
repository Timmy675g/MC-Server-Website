export default function RulesPage() {
  return (
    <main className="container section reveal in-view">
      <h1>Server Rules</h1>
      <div className="accordion">
        <details open>
          <summary>General Server Rules</summary>
          <p>No hate speech, no impersonation, and no disruption of community events.</p>
        </details>
        <details>
          <summary>PvP Guidelines</summary>
          <p>PvP is allowed! But do not spawn kill or farm kill anyone!</p>
        </details>
        <details>
          <summary>Harassment Policy</summary>
          <p>Harassment, intimidation, and targeted abuse are not tolerated.</p>
        </details>
        <details>
          <summary>Exploit Policy</summary>
          <p>Any bug abuse, x-ray, or hacked clients result in immediate sanctions.</p>
        </details>
        <details>
          <summary>Punishment System</summary>
          <p>Warning -&gt; Temporary Ban -&gt; Permanent Ban depending on severity and history.</p>
        </details>
      </div>
    </main>
  );
}
