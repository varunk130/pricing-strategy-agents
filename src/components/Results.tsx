"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  plain,
  type CompetitiveOutput,
  type ContractOutput,
  type RedTeamOutput,
  type RolloutOutput,
  type ValueMetricOutput,
} from "@/lib/events";

const Waiting = () => <p className="empty">Run the agents above to fill this in.</p>;

export function Research({ vm, cs, ca }: { vm?: ValueMetricOutput; cs?: CompetitiveOutput; ca?: ContractOutput }) {
  if (!vm && !cs && !ca) return <Waiting />;
  return (
    <div className="grid-3">
      <div className="box">
        <div className="box-kicker">Value metric</div>
        {vm ? (
          <>
            <h3>{plain(vm.metric)}</h3>
            <p className="muted small">{plain(vm.rationale)}</p>
            <ul className="small">
              {vm.risks.map((r, i) => (
                <li key={i}>{plain(r)}</li>
              ))}
            </ul>
          </>
        ) : (
          <Waiting />
        )}
      </div>
      <div className="box">
        <div className="box-kicker">Price level</div>
        {cs ? (
          <>
            <h3>
              ${cs.anchorLowPer1k} to ${cs.anchorHighPer1k} per 1k runs
            </h3>
            <p className="muted small">{plain(cs.positioning)}</p>
            <ul className="small">
              {cs.insights.map((r, i) => (
                <li key={i}>{plain(r)}</li>
              ))}
            </ul>
          </>
        ) : (
          <Waiting />
        )}
      </div>
      <div className="box">
        <div className="box-kicker">Contract guardrails</div>
        {ca ? (
          <>
            <h3>{ca.guardrails.length} guardrails</h3>
            <ul className="small">
              {ca.guardrails.map((r, i) => (
                <li key={i}>
                  <b>{plain(r)}</b>
                </li>
              ))}
            </ul>
            <ul className="small">
              {ca.constraints.map((r, i) => (
                <li key={i}>{plain(r)}</li>
              ))}
            </ul>
          </>
        ) : (
          <Waiting />
        )}
      </div>
    </div>
  );
}

export function RedTeam({ rt }: { rt?: RedTeamOutput }) {
  if (!rt) return <Waiting />;
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        The red team read each contract and pushed back as that customer&apos;s procurement lead.
      </p>
      {rt.findings.map((f) => (
        <div className="finding" key={f.accountId}>
          <div className="finding-head">
            <b>{f.accountName}</b>
            <span className={`sev ${f.severity}`}>{f.severity}</span>
          </div>
          <p className="quote">“{plain(f.objection)}”</p>
          <p className="muted small" style={{ margin: 0 }}>
            <b>Response:</b> {plain(f.mitigation)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Rollout({ ro }: { ro?: RolloutOutput }) {
  if (!ro) return <Waiting />;
  return (
    <div>
      <div className="waves">
        {ro.waves.map((w) => (
          <div className="box" key={w.name}>
            <div className="wave-time">{plain(w.timing)}</div>
            <h3>{plain(w.name)}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {plain(w.scope)}
            </p>
            <ul className="small">
              {w.actions.map((a, i) => (
                <li key={i}>{plain(a)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="sub-title">What sales and success need</p>
      <ul className="muted" style={{ margin: 0, paddingLeft: 20 }}>
        {ro.enablement.map((e, i) => (
          <li key={i}>{plain(e)}</li>
        ))}
      </ul>
    </div>
  );
}

export function Memo({ text }: { text?: string }) {
  if (!text) return <Waiting />;
  const clean = plain(text);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn" onClick={() => navigator.clipboard.writeText(clean)}>
          Copy memo
        </button>
      </div>
      <article className="memo">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{clean}</ReactMarkdown>
      </article>
    </div>
  );
}
