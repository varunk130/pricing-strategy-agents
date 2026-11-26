import { SOURCES } from "@/lib/sources";

/** Superscript citation that links to the numbered source list. */
export function Cite({ n }: { n: number | number[] }) {
  const list = Array.isArray(n) ? n : [n];
  return (
    <sup className="cite">
      {list.map((k, i) => (
        <a key={k} href={`#source-${k}`} title={`${SOURCES[k - 1].publisher}, ${SOURCES[k - 1].date}`}>
          {k}
          {i < list.length - 1 ? "," : ""}
        </a>
      ))}
    </sup>
  );
}

export function SourceTag({ n }: { n: number }) {
  const s = SOURCES[n - 1];
  return (
    <a className="source-tag" href={`#source-${n}`}>
      {s.publisher}, {s.date.replace(/^[A-Za-z]+ \d+, /, "")}
    </a>
  );
}

export function SourcesList() {
  return (
    <section className="section" id="sources">
      <div className="container">
        <div className="section-head">
          <p className="section-kicker">Sources</p>
          <h2>Research behind the numbers</h2>
        </div>
        <ol className="sources">
          {SOURCES.map((s) => (
            <li key={s.n} id={`source-${s.n}`}>
              <div>
                <b>{s.publisher}</b> · {s.date}
              </div>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <p>{s.finding}</p>
            </li>
          ))}
        </ol>
        <p className="hint" style={{ marginTop: 16 }}>
          Relaya, its customers and its competitors are fictional. Market figures come from the sources above. Company figures come from
          the synthetic dataset in this project.
        </p>
      </div>
    </section>
  );
}
